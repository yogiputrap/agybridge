import {
  Bot,
  CheckCircle,
  FlaskConical,
  MessageSquare,
  Play,
  RefreshCw,
  Send,
  Settings2,
  Square,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Select from "../components/Select";
import { Badge, Button, Card, CardHeader, EmptyState, Field, IconButton, Notice, Spinner, Switch, Tabs, TableShell, Textarea } from "../components/ui";
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
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
      <Card className="xl:col-span-1">
        <CardHeader icon={Settings2} title="Pengaturan" subtitle="Model dan parameter permintaan" />
        <div className="space-y-4">
          <Field label="Model" hint={model || undefined}>
            <Select
              value={model}
              onChange={setModel}
              disabled={loadingModels || !models.length}
              options={models.map((m) => ({ value: m.id, label: m.id }))}
            />
          </Field>
          <Field label="Maks. output">
            <Select value={maxTokens} onChange={setMaxTokens} options={MAX_TOKEN_OPTIONS} />
          </Field>
          <Switch checked={stream} onChange={setStream} label="Mode streaming" />
          <Field label="System prompt (opsional)" htmlFor="pg-system">
            <Textarea id="pg-system" value={system} onChange={(e) => setSystem(e.target.value)} rows={3} maxLength={4000} />
          </Field>
        </div>
      </Card>

      <div className="xl:col-span-2 space-y-4 min-w-0">
        {modelError && <Notice tone="danger">{modelError}</Notice>}

        <Card className="!p-0 flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-dark-700/60">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 shrink-0 rounded-full bg-purple-600/10 text-purple-500 flex items-center justify-center">
                <MessageSquare size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-ink leading-tight">Percakapan</h2>
                <p className="text-sm text-gray-400 truncate" title={model}>{model || "Belum ada model"}</p>
              </div>
            </div>
            <Button size="sm" icon={Trash2} onClick={clear} title="Bersihkan percakapan">
              Bersihkan
            </Button>
          </div>

          <div className="px-4 sm:px-5 py-5 space-y-4 min-h-[320px] max-h-[60vh] overflow-y-auto">
            {messages.length === 0 && (
              <EmptyState
                icon={Bot}
                title="Mulai percakapan"
                hint="Pilih model lalu kirim pesan untuk menguji. Pesan ini lewat jalur yang sama dengan klien API."
              />
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] sm:max-w-[80%] min-w-0 px-4 py-3 text-sm whitespace-pre-wrap break-words ${
                    m.role === "user"
                      ? "bg-purple-600 text-white rounded-2xl rounded-br-md"
                      : "bg-dark-800 border border-dark-700/60 text-ink rounded-2xl rounded-bl-md"
                  }`}
                >
                  {m.reasoning ? (
                    <details className="mb-2 rounded-xl bg-dark-900/60 border border-dark-700/60 px-3 py-2 text-xs text-gray-400">
                      <summary className="cursor-pointer select-none">Thinking ({m.reasoning.length} karakter)</summary>
                      <div className="mt-2 whitespace-pre-wrap break-words">{m.reasoning}</div>
                    </details>
                  ) : null}
                  {m.content || (m.pending ? <Spinner size={14} /> : "")}
                  {m.meta && (
                    <div className={`mt-2 text-xs ${m.role === "user" ? "text-white/70" : "text-gray-500"}`}>
                      {m.meta.first_token_ms != null ? `TTFT ${m.meta.first_token_ms} ms · ` : ""}
                      total {m.meta.total_ms} ms
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {error && (
            <div className="px-4 sm:px-5 pb-3">
              <Notice tone="danger">{error}</Notice>
            </div>
          )}

          <div className="border-t border-dark-700/60 bg-dark-800/40 p-4 flex flex-wrap items-end gap-3">
            <Textarea
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
              className="flex-1 min-w-[200px] !h-[72px] !resize-none"
            />
            {busy ? (
              <Button variant="danger" icon={Square} onClick={stop}>
                Stop
              </Button>
            ) : (
              <Button variant="primary" icon={Send} onClick={send} disabled={!input.trim() || !model}>
                Kirim
              </Button>
            )}
          </div>
        </Card>
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
    <Card>
      <CardHeader
        icon={FlaskConical}
        title="Uji Semua Model"
        subtitle="Kirim 1 request kecil ke tiap model terpilih dan lihat hasilnya."
        action={
          <>
            {done.length > 0 && (
              <>
                <Badge tone="success" dot>{okCount} berhasil</Badge>
                <Badge tone="danger" dot>{done.length - okCount} gagal</Badge>
              </>
            )}
            <Button size="sm" onClick={() => setSelected(ids)} disabled={running}>
              Pilih semua
            </Button>
            <Button size="sm" onClick={() => setSelected([])} disabled={running}>
              Kosongkan
            </Button>
            {running && (
              <Button size="sm" variant="danger" icon={Square} onClick={() => abortRef.current?.abort()}>
                Batalkan
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={Play}
              loading={running}
              onClick={runAll}
              disabled={loadingModels || !chosen.length}
            >
              {running ? `Menguji ${progress.done}/${progress.total}` : `Uji ${chosen.length} model`}
            </Button>
          </>
        }
      />

      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}

      {ids.length === 0 ? (
        <EmptyState icon={FlaskConical} title="Belum ada model" hint="Tekan Muat Model untuk mengambil daftar model." />
      ) : (
        <TableShell>
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-sm text-gray-400 bg-dark-800/60">
                <th className="px-4 py-3 w-12"></th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Latensi</th>
                <th className="px-4 py-3 font-medium">Balasan / Error</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                const r = results[id];
                return (
                  <tr key={id} className="border-t border-dark-700/50 align-middle hover:bg-dark-800/40">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Pilih ${id}`}
                        className="w-4 h-4 accent-purple-600 cursor-pointer"
                        checked={chosen.includes(id)}
                        onChange={() => toggle(id)}
                        disabled={running}
                      />
                    </td>
                    <td className="px-4 py-3 max-w-[300px] font-mono text-xs text-ink break-all">{id}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {!r && running && chosen.includes(id) ? (
                        <Badge>menunggu…</Badge>
                      ) : !r ? (
                        <span className="text-gray-500">-</span>
                      ) : r.ok ? (
                        <Badge tone="success" icon={CheckCircle}>OK</Badge>
                      ) : (
                        <Badge tone="danger" icon={XCircle}>{r.status_code}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-300">{r ? `${r.latency_ms} ms` : ""}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 break-words max-w-[320px]">
                      {r ? (r.ok ? r.reply : r.error) : ""}
                    </td>
                    <td className="px-4 py-3">
                      <IconButton icon={RefreshCw} label="Uji ulang model ini" onClick={() => run([id])} disabled={running} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}
    </Card>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
          <span>{models.length} model tersedia</span>
          <Button size="sm" icon={RefreshCw} onClick={() => loadModels(true)} disabled={loadingModels} className={loadingModels ? "[&_svg]:animate-spin" : ""}>
            Muat Model
          </Button>
        </div>
      </div>

      {tab === "chat" && <ChatTab models={models} loadingModels={loadingModels} modelError={modelError} />}
      {tab === "test" && <TestAllTab models={models} loadingModels={loadingModels} />}
    </div>
  );
}
