"""
Playground Route Module - Handles /playground/* HTTP requests
Lists available models, tests every model, and offers a chat sandbox (streaming or not).
All routes require the panel token; request size and concurrency are bounded.
"""

import asyncio
import json
import time
import uuid
from typing import Any, AsyncIterator, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from log import log
from src.api.antigravity import fetch_available_models, non_stream_request, stream_request
from src.converter.antigravity_fix import normalize_antigravity_request
from src.converter.openai2gemini import (
    convert_gemini_to_openai_response,
    convert_gemini_to_openai_stream,
    convert_openai_to_gemini_request,
)
from src.utils import (
    get_base_model_from_feature_model,
    is_anti_truncation_model,
    resolve_upstream_model,
    verify_panel_token,
)


router = APIRouter(prefix="/playground", tags=["playground"])

MAX_MESSAGES = 40
MAX_TOTAL_CHARS = 30000
MAX_OUTPUT_TOKENS = 4096
DEFAULT_OUTPUT_TOKENS = 1024
MAX_TEST_MODELS = 60
TEST_PROMPT = "Balas hanya dengan satu kata: OK"
TEST_MAX_TOKENS = 256
TEST_TIMEOUT = 60.0
TEST_CONCURRENCY = 2
MODEL_CACHE_TTL = 60.0

_test_lock = asyncio.Lock()
_chat_slots = asyncio.Semaphore(2)
_models_cache: Dict[str, Any] = {"at": 0.0, "ids": []}


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    model: str = Field(min_length=1, max_length=120)
    messages: List[ChatMessage]
    stream: bool = True
    max_tokens: Optional[int] = None
    temperature: Optional[float] = Field(default=None, ge=0, le=2)


class TestModelsRequest(BaseModel):
    models: Optional[List[str]] = None


def _short(text: Any, limit: int = 300) -> str:
    text = str(text or "").strip()
    return text if len(text) <= limit else text[:limit] + "…"


def _sse(payload: Dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _available_base_models(force: bool = False) -> List[str]:
    """Base (non anti-truncate) model ids reported by upstream, cached briefly."""
    now = time.time()
    if not force and _models_cache["ids"] and now - _models_cache["at"] < MODEL_CACHE_TTL:
        return list(_models_cache["ids"])
    data = await fetch_available_models()
    ids = [m["id"] for m in data if isinstance(m, dict) and m.get("id")]
    if ids:
        _models_cache.update({"at": now, "ids": ids})
    return ids


def _validate_chat(req: ChatRequest) -> int:
    if not req.messages:
        raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong")
    if len(req.messages) > MAX_MESSAGES:
        raise HTTPException(status_code=400, detail=f"Maksimal {MAX_MESSAGES} pesan per percakapan")
    if sum(len(m.content) for m in req.messages) > MAX_TOTAL_CHARS:
        raise HTTPException(status_code=400, detail=f"Total isi pesan melebihi {MAX_TOTAL_CHARS} karakter")
    if req.messages[-1].role != "user":
        raise HTTPException(status_code=400, detail="Pesan terakhir harus dari pengguna")
    if req.max_tokens is None:
        return DEFAULT_OUTPUT_TOKENS
    return max(1, min(int(req.max_tokens), MAX_OUTPUT_TOKENS))


async def _build_api_request(
    model: str, messages: List[Dict[str, str]], max_tokens: int, temperature: Optional[float], stream: bool
) -> Dict[str, Any]:
    """Build the upstream body through the same conversion pipeline as /v1/chat/completions."""
    real_model = resolve_upstream_model(model)
    openai_dict: Dict[str, Any] = {
        "model": real_model,
        "messages": messages,
        "max_tokens": max_tokens,
        "stream": stream,
    }
    if temperature is not None:
        openai_dict["temperature"] = temperature

    try:
        gemini_dict = await convert_openai_to_gemini_request(openai_dict)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    gemini_dict["model"] = real_model
    gemini_dict = await normalize_antigravity_request(gemini_dict)
    return {"model": gemini_dict.pop("model"), "request": gemini_dict}


def _log_ctx(request: Optional[Request], model: str) -> Dict[str, Any]:
    return {
        "api_format": "panel-playground",
        "client_ip": request.client.host if request and request.client else "",
        "client_model": model,
    }


async def _run_once(
    model: str, messages: List[Dict[str, str]], max_tokens: int,
    temperature: Optional[float], request: Optional[Request],
) -> Dict[str, Any]:
    """Run a non-streaming completion and return a normalized result dict."""
    started = time.time()
    api_request = await _build_api_request(model, messages, max_tokens, temperature, stream=False)
    response = await non_stream_request(body=api_request, log_ctx=_log_ctx(request, model))
    status_code = getattr(response, "status_code", 200)
    body = getattr(response, "body", None) or getattr(response, "content", b"")
    body = body.decode() if isinstance(body, bytes) else str(body)
    latency_ms = int((time.time() - started) * 1000)

    if status_code != 200:
        return {"ok": False, "status_code": status_code, "latency_ms": latency_ms, "error": _short(body)}

    try:
        openai_response = convert_gemini_to_openai_response(json.loads(body), model, status_code)
        message = openai_response["choices"][0]["message"]
    except Exception as exc:
        return {"ok": False, "status_code": 502, "latency_ms": latency_ms,
                "error": f"Respons tidak dapat diparse: {_short(exc, 120)}"}

    return {
        "ok": True,
        "status_code": 200,
        "latency_ms": latency_ms,
        "content": message.get("content") or "",
        "reasoning": message.get("reasoning_content") or "",
        "usage": openai_response.get("usage") or {},
    }


@router.get("/models")
async def list_models(refresh: bool = False, _token: str = Depends(verify_panel_token)):
    """List models available from upstream (base models plus anti-truncate variants)."""
    ids = await _available_base_models(force=refresh)
    if not ids:
        raise HTTPException(status_code=503, detail="Tidak dapat mengambil daftar model (tidak ada kredensial valid)")
    return JSONResponse(content={
        "models": [{"id": i, "anti_truncate": f"anti-truncate-{i}"} for i in ids],
        "total": len(ids),
    })


@router.post("/test-models")
async def test_models(req: TestModelsRequest, request: Request, _token: str = Depends(verify_panel_token)):
    """
    Test models one by one (max TEST_CONCURRENCY at a time) with a tiny fixed prompt.
    Streams one SSE event per finished model, then a summary event.
    """
    available = await _available_base_models()
    if not available:
        raise HTTPException(status_code=503, detail="Tidak dapat mengambil daftar model (tidak ada kredensial valid)")

    targets = req.models if req.models else available
    targets = list(dict.fromkeys(get_base_model_from_feature_model(m) for m in targets))
    unknown = [m for m in targets if m not in available]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Model tidak tersedia: {', '.join(unknown[:5])}")
    if len(targets) > MAX_TEST_MODELS:
        raise HTTPException(status_code=400, detail=f"Maksimal {MAX_TEST_MODELS} model per uji")

    if _test_lock.locked():
        raise HTTPException(status_code=409, detail="Uji model lain sedang berjalan, coba lagi nanti")

    messages = [{"role": "user", "content": TEST_PROMPT}]

    async def one(model: str, gate: asyncio.Semaphore) -> Dict[str, Any]:
        async with gate:
            try:
                result = await asyncio.wait_for(
                    _run_once(model, messages, TEST_MAX_TOKENS, None, request), timeout=TEST_TIMEOUT
                )
            except asyncio.TimeoutError:
                result = {"ok": False, "status_code": 504, "latency_ms": int(TEST_TIMEOUT * 1000), "error": "Timeout"}
            except HTTPException as exc:
                result = {"ok": False, "status_code": exc.status_code, "latency_ms": 0, "error": _short(exc.detail)}
            except Exception as exc:
                log.error(f"[PLAYGROUND] Test failed for {model}: {exc}")
                result = {"ok": False, "status_code": 500, "latency_ms": 0, "error": _short(exc, 120)}
        result["model"] = model
        result["reply"] = _short(result.pop("content", ""), 80)
        result.pop("reasoning", None)
        return result

    async def event_stream() -> AsyncIterator[str]:
        async with _test_lock:
            yield _sse({"type": "start", "total": len(targets)})
            gate = asyncio.Semaphore(TEST_CONCURRENCY)
            tasks = [asyncio.create_task(one(m, gate)) for m in targets]
            ok = 0
            try:
                for finished in asyncio.as_completed(tasks):
                    result = await finished
                    ok += 1 if result["ok"] else 0
                    yield _sse({"type": "result", **result})
            finally:
                for task in tasks:
                    task.cancel()
            yield _sse({"type": "done", "total": len(targets), "ok": ok, "failed": len(targets) - ok})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/chat")
async def chat(req: ChatRequest, request: Request, _token: str = Depends(verify_panel_token)):
    """Chat sandbox: streaming (SSE, OpenAI chunk format) or a single JSON answer."""
    max_tokens = _validate_chat(req)

    available = await _available_base_models()
    if not available:
        raise HTTPException(status_code=503, detail="Tidak dapat mengambil daftar model (tidak ada kredensial valid)")
    if get_base_model_from_feature_model(req.model) not in available:
        raise HTTPException(status_code=400, detail="Model tidak tersedia")

    if _chat_slots.locked():
        raise HTTPException(status_code=429, detail="Terlalu banyak chat berjalan bersamaan, coba lagi sebentar")

    messages = [m.model_dump() for m in req.messages]

    if not req.stream:
        async with _chat_slots:
            result = await _run_once(req.model, messages, max_tokens, req.temperature, request)
        return JSONResponse(content=result, status_code=200 if result["ok"] else result["status_code"])

    api_request = await _build_api_request(req.model, messages, max_tokens, req.temperature, stream=True)
    if is_anti_truncation_model(req.model):
        log.info("[PLAYGROUND] Anti-truncation prefix ignored in playground streaming")

    async def event_stream() -> AsyncIterator[str]:
        async with _chat_slots:
            response_id = f"chatcmpl-{uuid.uuid4()}"
            started = time.time()
            first_token_ms: Optional[int] = None
            try:
                async for chunk in stream_request(body=api_request, native=False, log_ctx=_log_ctx(request, req.model)):
                    if isinstance(chunk, Response):
                        body = chunk.body.decode() if isinstance(chunk.body, bytes) else str(chunk.body or "")
                        yield _sse({"error": {"code": chunk.status_code, "message": _short(body)}})
                        break
                    if isinstance(chunk, bytes):
                        chunk = chunk.decode("utf-8")
                    for line in chunk.strip().split("\n"):
                        line = line.strip()
                        if line == "data: [DONE]":
                            break
                        if not line.startswith("data: "):
                            continue
                        out = convert_gemini_to_openai_stream(line, req.model, response_id)
                        if out:
                            if first_token_ms is None and '"content"' in out:
                                first_token_ms = int((time.time() - started) * 1000)
                            yield out
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                log.error(f"[PLAYGROUND] Stream error: {exc}")
                yield _sse({"error": {"code": 500, "message": _short(exc, 120)}})
            yield _sse({"meta": {"first_token_ms": first_token_ms, "total_ms": int((time.time() - started) * 1000)}})
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
