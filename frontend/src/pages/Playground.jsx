import {
  CheckCircle,
  FlaskConical,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  Send,
  Square,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Select from "../components/Select";
import api from "../api";
import { getBasePath } from "../basePath";

const MAX_TOKEN_OPTIONS = [256, 512, 1024, 2048, 4096].map((n) => ({ value: n, label: `${n} token` }));

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("panelToken") || ""}`,
  };
}

/** POST to a streaming SSE endpoint and call onEvent(parsedJson) for each `data:` line. */
async function postSSE(path, body, onEvent, signal) {
  const res = await fetch(`${getBasePath()}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal,
  });
  if (res.status === 401) {
    localStorage.removeItem("panelToken");
    window.location.href = getBasePath();
    return;
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* keep the HTTP status */
    }
    throw new Error(detail);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of block.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          onEvent(JSON.parse(data));
        } catch {
          /* ignore malformed chunk */
        }
      }
    }
  }
}

function errorText(err) {
  return err?.response?.data?.detail || err?.message || "Terjadi kesalahan";
}

// ---------------------------------------------------------------- Chat tab

function ChatTab({ models, loadingModels, modelError }) {
  const [model, setModel] = useState("");
  const [stream, setStream] = useState(true);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [system, setSystem] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (!model && models.length) setModel(models[0].id);
  }, [models, model]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const patchLast = (patch) =>
    setMessages((prev) => {
      const copy = prev.slice();
      copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch(copy[copy.length - 1]) };
      return copy;
    });

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !model) return;
    setError("");
    setInput("");
    const history = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "", reasoning: "", pending: true }]);
    setBusy(true);

    const payload = {
      model,
      stream,
      max_tokens: maxTokens,
      messages: [
        ...(system.trim() ? [{ role: "system", content: system.trim() }] : []),
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ],
    };

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (stream) {
        await postSSE(
          "playground/chat",
          payload,
          (ev) => {
            if (ev.error) {
              setError(`HTTP ${ev.error.code}: ${ev.error.message}`);
              return;
            }
            if (ev.meta) {
              patchLast(() => ({ meta: ev.meta }));
              return;
            }
            const delta = ev.choices?.[0]?.delta;
            if (!delta) return;
            patchLast((m) => ({
              content: m.content + (delta.content || ""),
              reasoning: m.reasoning + (delta.reasoning_content || ""),
            }));
          },
          controller.signal
        );
      } else {
        const res = await api.post("/playground/chat", payload, { signal: controller.signal });
        patchLast(() => ({
          content: res.data.content,
          reasoning: res.data.reasoning,
          meta: { total_ms: res.data.latency_ms },
        }));
      }
    } catch (err) {
      if (err?.name !== "AbortError" && err?.code !== "ERR_CANCELED") setError(errorText(err));
    } finally {
      patchLast(() => ({ pending: false }));
      setBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();
  const clear = () => {
    stop();
    setMessages([]);
    setError("");
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-400 mb-1">Model</label>
          <Select
            value={model}
            onChange={setModel}
            disabled={loadingModels || !models.length}
            options={models.map((m) => ({ value: m.id, label: m.id }))}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Maks. output</label>
          <Select value={maxTokens} onChange={setMaxTokens} options={MAX_TOKEN_OPTIONS} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none pb-2">
          <input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} />
          Mode streaming
        </label>
        <div className="md:col-span-4">
          <label className="block text-xs text-gray-400 mb-1">System prompt (opsional)</label>
          <textarea
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            rows={2}
            maxLength={4000}
            className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
      </div>

      {modelError && <div className="card p-3 text-sm text-red-400">{modelError}</div>}

      <div className="card p-4 space-y-3 min-h-[240px] max-h-[55vh] overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-10">
            Pilih model lalu kirim pesan untuk menguji. Pesan ini lewat jalur yang sama dengan klien API.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                m.role === "user" ? "bg-purple-600 text-white" : "bg-dark-800 border border-dark-600 text-gray-200"
              }`}
            >
              {m.reasoning ? (
                <details className="mb-2 text-xs text-gray-400">
                  <summary className="cursor-pointer select-none">Thinking ({m.reasoning.length} karakter)</summary>
                  <div className="mt-1 whitespace-pre-wrap">{m.reasoning}</div>
                </details>
              ) : null}
              {m.content || (m.pending ? <Loader2 size={14} className="animate-spin text-gray-400" /> : "")}
              {m.meta && (
                <div className="mt-1 text-[11px] text-gray-500">
                  {m.meta.first_token_ms != null ? `TTFT ${m.meta.first_token_ms} ms · ` : ""}
                  total {m.meta.total_ms} ms
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <div className="card p-3 text-sm text-red-400 break-words">{error}</div>}

      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          maxLength={8000}
          placeholder="Tulis pesan… (Enter kirim, Shift+Enter baris baru)"
          className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
        {busy ? (
          <button onClick={stop} className="btn btn-danger flex items-center gap-1.5">
            <Square size={14} /> Stop
          </button>
        ) : (
          <button onClick={send} disabled={!input.trim() || !model} className="btn btn-primary flex items-center gap-1.5">
            <Send size={14} /> Kirim
          </button>
        )}
        <button onClick={clear} className="btn btn-secondary flex items-center gap-1.5" title="Bersihkan percakapan">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------- Test-all tab

function TestAllTab({ models, loadingModels }) {
  const [selected, setSelected] = useState(null); // null = all
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ids = models.map((m) => m.id);
  const chosen = selected ?? ids;

  const toggle = (id) => {
    const set = new Set(chosen);
    set.has(id) ? set.delete(id) : set.add(id);
    setSelected(ids.filter((i) => set.has(i)));
  };

  const run = async (targets) => {
    if (running || !targets.length) return;
    setError("");
    setRunning(true);
    setProgress({ done: 0, total: targets.length });
    setResults((prev) => {
      const next = { ...prev };
      targets.forEach((t) => delete next[t]);
      return next;
    });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await postSSE(
        "playground/test-models",
        { models: targets },
        (ev) => {
          if (ev.type === "result") {
            setResults((prev) => ({ ...prev, [ev.model]: ev }));
            setProgress((p) => ({ ...p, done: p.done + 1 }));
          }
        },
        controller.signal
      );
    } catch (err) {
      if (err?.name !== "AbortError") setError(errorText(err));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const runAll = () => {
    if (
      window.confirm(
        `Kirim 1 request kecil ke ${chosen.length} model? Ini memakai sedikit kuota akun dan berjalan 2 model sekaligus.`
      )
    )
      run(chosen);
  };

  const done = Object.values(results);
  const okCount = done.filter((r) => r.ok).length;

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <button
          onClick={runAll}
          disabled={running || loadingModels || !chosen.length}
          className="btn btn-primary flex items-center gap-1.5"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? `Menguji ${progress.done}/${progress.total}` : `Uji ${chosen.length} model`}
        </button>
        {running && (
          <button onClick={() => abortRef.current?.abort()} className="btn btn-danger flex items-center gap-1.5">
            <Square size={14} /> Batalkan
          </button>
        )}
        <button onClick={() => setSelected(ids)} disabled={running} className="text-xs text-purple-300 hover:underline">
          Pilih semua
        </button>
        <button onClick={() => setSelected([])} disabled={running} className="text-xs text-purple-300 hover:underline">
          Kosongkan
        </button>
        {done.length > 0 && (
          <span className="text-sm text-gray-400 ml-auto">
            <span className="text-green-400">{okCount} berhasil</span> ·{" "}
            <span className="text-red-400">{done.length - okCount} gagal</span>
          </span>
        )}
      </div>

      {error && <div className="card p-3 text-sm text-red-400 break-words">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-dark-700">
              <th className="p-3 w-8"></th>
              <th className="p-3">Model</th>
              <th className="p-3">Status</th>
              <th className="p-3">Latensi</th>
              <th className="p-3">Balasan / Error</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const r = results[id];
              return (
                <tr key={id} className="border-b border-dark-800 last:border-0">
                  <td className="p-3">
                    <input type="checkbox" checked={chosen.includes(id)} onChange={() => toggle(id)} disabled={running} />
                  </td>
                  <td className="p-3 font-mono text-xs break-all">{id}</td>
                  <td className="p-3 whitespace-nowrap">
                    {!r && running && chosen.includes(id) ? (
                      <span className="text-gray-500">menunggu…</span>
                    ) : !r ? (
                      <span className="text-gray-600">-</span>
                    ) : r.ok ? (
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle size={14} /> OK
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400">
                        <XCircle size={14} /> {r.status_code}
                      </span>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap text-gray-400">{r ? `${r.latency_ms} ms` : ""}</td>
                  <td className="p-3 text-xs text-gray-400 break-words max-w-xs">
                    {r ? (r.ok ? r.reply : r.error) : ""}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => run([id])}
                      disabled={running}
                      title="Uji ulang model ini"
                      className="text-gray-400 hover:text-white disabled:opacity-40"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Page

export default function Playground() {
  const [tab, setTab] = useState("chat");
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState("");

  const loadModels = useCallback(async (refresh = false) => {
    setLoadingModels(true);
    setModelError("");
    try {
      const res = await api.get("/playground/models", { params: { refresh } });
      setModels(res.data.models || []);
    } catch (err) {
      setModels([]);
      setModelError(errorText(err));
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    loadModels(false);
  }, [loadModels]);

  const tabs = [
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "test", label: "Uji Semua Model", icon: FlaskConical },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${
                tab === t.id ? "bg-dark-700 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          {models.length} model tersedia
          <button
            onClick={() => loadModels(true)}
            disabled={loadingModels}
            className="btn btn-secondary flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loadingModels ? "animate-spin" : ""} /> Muat Model
          </button>
        </div>
      </div>

      {tab === "chat" && <ChatTab models={models} loadingModels={loadingModels} modelError={modelError} />}
      {tab === "test" && <TestAllTab models={models} loadingModels={loadingModels} />}
    </div>
  );
}
