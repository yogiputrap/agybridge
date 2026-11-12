import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  FileText,
  History,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Modal from "../components/Modal";
import Select from "../components/Select";
import { Badge, Button, Card, CardHeader, CodeBlock, EmptyState, Field, IconButton, InfoRow, Spinner, StatCard, TableShell } from "../components/ui";
import api from "../api";

const PAGE_SIZES = [20, 50, 100, 200].map((n) => ({ value: n, label: `${n} baris` }));

function formatTokens(n) {
  if (n === null || n === undefined) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** `created_at` is epoch SECONDS (float) from the API; ISO strings are tolerated too. */
function formatTime(ts) {
  if (ts === null || ts === undefined || ts === "") return "-";
  try {
    const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return String(ts);
  }
}

const FORMAT_LABELS = { openai: "OpenAI", gemini: "Gemini", anthropic: "Claude" };
const formatLabel = (f) => FORMAT_LABELS[f] || f || "?";

/** Overlay dialog used for the request detail and the payload viewer. */
function Dialog({ title, onClose, actions, wide = false, z = "z-50", children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={`fixed inset-0 ${z} !m-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]`} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`card !p-0 w-full ${wide ? "max-w-4xl" : "max-w-lg"} max-h-[88vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4 border-b border-dark-700/60">
          <h3 className="flex-1 min-w-0 text-base font-semibold text-ink break-words">{title}</h3>
          {actions}
          <IconButton icon={X} label="Tutup" onClick={onClose} />
        </div>
        <div className="p-5 overflow-y-auto min-w-0">{children}</div>
      </div>
    </div>
  );
}

function StatusBadge({ item }) {
  return item.success ? (
    <Badge tone="success" icon={CheckCircle}>Berhasil</Badge>
  ) : (
    <Badge tone="danger" icon={XCircle}>{item.status_code || "Gagal"}</Badge>
  );
}

function ModelCell({ item }) {
  const name = item.model_name || "(unknown)";
  return (
    <div className="min-w-0">
      <div className="text-sm font-medium text-ink truncate" title={name}>{name}</div>
      {item.upstream_model_name && item.upstream_model_name !== item.model_name && (
        <div className="text-xs text-gray-500 truncate" title={`Model Upstream: ${item.upstream_model_name}`}>
          → {item.upstream_model_name}
        </div>
      )}
    </div>
  );
}

function TagBadges({ item }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge>{formatLabel(item.api_format)}</Badge>
      {item.is_stream && <Badge tone="info">Streaming</Badge>}
      {item.request_log_file && <Badge tone="warning">Rinci</Badge>}
    </div>
  );
}

function TokenCell({ item }) {
  return (
    <div className="text-xs text-gray-400">
      <div className="text-sm text-ink">{formatTokens(item.total_tokens)} token</div>
      <div>
        ↑{formatTokens(item.prompt_tokens)} ↓{formatTokens(item.completion_tokens)}
      </div>
      {item.cached_tokens > 0 && (
        <div className="text-emerald-600 dark:text-emerald-400" title="Token yang terkena prompt cache">
          ⚡ Cache {formatTokens(item.cached_tokens)}
        </div>
      )}
    </div>
  );
}

function formatMaybeJson(text) {
  if (!text) return "-";
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

export default function UsageLogs() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detail, setDetail] = useState(null);
  const [detailBody, setDetailBody] = useState(null);
  const [detailBodyLoading, setDetailBodyLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState(null);
  const [rangeHours, setRangeHours] = useState(24);
  const [statusFilter, setStatusFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [statusCodeFilter, setStatusCodeFilter] = useState("");
  const [message, setMessage] = useState(null);

  const getStartTimestamp = useCallback(() => {
    if (!rangeHours || rangeHours <= 0) return null;
    return Math.floor(Date.now() / 1000) - rangeHours * 3600;
  }, [rangeHours]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      const start = getStartTimestamp();
      const params = {
        offset,
        limit: pageSize,
        status: statusFilter,
        api_format: formatFilter || undefined,
        model_name: modelFilter.trim() || undefined,
        status_code: statusCodeFilter.trim() ? Number(statusCodeFilter.trim()) : undefined,
        start_timestamp: start ?? undefined,
      };
      const res = await api.get("/usage-logs/list", { params });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Gagal memuat log" });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, formatFilter, modelFilter, statusCodeFilter, getStartTimestamp]);

  const loadStats = useCallback(async () => {
    try {
      const start = getStartTimestamp();
      const params = start ? { start_timestamp: start } : {};
      const res = await api.get("/usage-logs/stats", { params });
      setStats(res.data);
    } catch {
      /* non-blocking */
    }
  }, [getStartTimestamp]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const refresh = () => {
    loadLogs();
    loadStats();
  };

  const clearLogs = async () => {
    if (!window.confirm("Apakah Anda yakin ingin membersihkan log panggilan API yang lebih lama dari 3 hari?")) return;
    setClearing(true);
    try {
      const res = await api.post("/usage-logs/clear", null, { params: { days: 3 } });
      setMessage({ type: "success", text: res.data.message || "Log berhasil dibersihkan" });
      refresh();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Gagal membersihkan log" });
    } finally {
      setClearing(false);
    }
  };

  const truncateLogs = async () => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus SELURUH riwayat log panggilan API? Tindakan ini permanen.")) return;
    setClearing(true);
    try {
      const res = await api.post("/usage-logs/clear", null, { params: { days: 0 } });
      setMessage({ type: "success", text: res.data.message || "Seluruh log berhasil dihapus" });
      refresh();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Gagal menghapus log" });
    } finally {
      setClearing(false);
    }
  };

  const openRequestBody = async () => {
    if (!detail?.request_log_file) return;
    setDetailBodyLoading(true);
    setCopyStatus(null);
    try {
      const res = await api.get(`/usage-logs/body/${encodeURIComponent(detail.request_log_file)}`);
      setDetailBody(res.data);
    } catch (err) {
      setDetailBody({ __missing: true, __message: err.response?.data?.detail || "Berkas log detail tidak ditemukan atau telah dibersihkan" });
    } finally {
      setDetailBodyLoading(false);
    }
  };

  const copyDetailBody = async () => {
    if (!detailBody || detailBody.__missing) return;
    const text = JSON.stringify(detailBody, null, 2);
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    setCopyStatus(ok ? "ok" : "fail");
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const openDetail = (item) => {
    setDetail(item);
    setDetailBody(null);
  };

  const detailRows = detail
    ? [
        ["Waktu", formatTime(detail.created_at)],
        ["ID Permintaan", detail.request_id || "-"],
        ["Status", detail.success ? "Berhasil" : `Gagal (${detail.status_code})`],
        ["Format API", detail.api_format || "-"],
        ["IP Klien", detail.client_ip || "-"],
        ["Model Diminta", detail.model_name || "-"],
        ["Model Upstream", detail.upstream_model_name || detail.model_name || "-"],
        ["Akun / Kredensial", detail.credential_email || "-"],
        ["Streaming (SSE)", detail.is_stream ? "Ya" : "Tidak"],
        ["Durasi", `${(detail.use_time || 0).toFixed(2)} detik`],
        ["Total Token", `${formatTokens(detail.total_tokens)} (Masuk: ${formatTokens(detail.prompt_tokens)}, Keluar: ${formatTokens(detail.completion_tokens)})`],
        ...(detail.cached_tokens > 0 ? [["Token Cache", String(detail.cached_tokens)]] : []),
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Ringkasan metrik */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon={Database} label="Total Permintaan" value={stats.total_requests} />
          <StatCard icon={CheckCircle} tone="success" label="Berhasil" value={stats.success_count} />
          <StatCard icon={XCircle} tone="danger" label="Gagal" value={stats.error_count} />
          <StatCard
            icon={Cpu}
            tone="neutral"
            label="Total Token"
            value={formatTokens(stats.total_tokens)}
            caption={stats.cached_tokens > 0 ? `Cache ${formatTokens(stats.cached_tokens)}` : undefined}
          />
        </div>
      )}

      {/* Modal notifikasi */}
      {message && (
        <Modal type={message.type} title={message.type === "success" ? "Berhasil" : "Gagal"} onClose={() => setMessage(null)}>
          <span className="whitespace-pre-wrap break-all">{message.text}</span>
        </Modal>
      )}

      <Card>
        <CardHeader
          icon={History}
          title="Riwayat Permintaan"
          subtitle={total > 0 ? `${total} log sesuai filter` : "Panggilan API yang lewat gateway"}
          action={
            <>
              <Button size="sm" icon={RefreshCw} onClick={refresh} disabled={loading} className={loading ? "[&_svg]:animate-spin" : ""}>
                Segarkan
              </Button>
              <Button size="sm" icon={Trash2} onClick={clearLogs} loading={clearing}>
                Bersihkan &gt; 3 Hari
              </Button>
              <Button size="sm" variant="danger" icon={Trash2} onClick={truncateLogs} disabled={clearing}>
                Hapus Semua
              </Button>
            </>
          }
        />

        {/* Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          <Field label="Rentang waktu">
            <Select
              value={rangeHours}
              onChange={(v) => { setRangeHours(Number(v)); setPage(1); }}
              options={[
                { value: 1, label: "1 Jam Terakhir" },
                { value: 6, label: "6 Jam Terakhir" },
                { value: 24, label: "24 Jam Terakhir" },
                { value: 24 * 7, label: "7 Hari Terakhir" },
                { value: 24 * 30, label: "30 Hari Terakhir" },
                { value: 0, label: "Semua Waktu" },
              ]}
            />
          </Field>
          <Field label="Status">
            <Select
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              options={[
                { value: "all", label: "Semua" },
                { value: "success", label: "Hanya Berhasil" },
                { value: "error", label: "Hanya Gagal" },
              ]}
            />
          </Field>
          <Field label="Format">
            <Select
              value={formatFilter}
              onChange={(v) => { setFormatFilter(v); setPage(1); }}
              options={[
                { value: "", label: "Semua" },
                { value: "openai", label: "OpenAI" },
                { value: "gemini", label: "Gemini" },
                { value: "anthropic", label: "Claude" },
              ]}
            />
          </Field>
          <Field label="Model">
            <input
              value={modelFilter}
              onChange={(e) => { setModelFilter(e.target.value); setPage(1); }}
              placeholder="Cari model..."
              className="input"
            />
          </Field>
          <Field label="Status HTTP">
            <input
              value={statusCodeFilter}
              onChange={(e) => { setStatusCodeFilter(e.target.value); setPage(1); }}
              placeholder="mis. 429"
              inputMode="numeric"
              className="input"
            />
          </Field>
          <Field label="Per halaman">
            <Select value={pageSize} onChange={(v) => { setPageSize(Number(v)); setPage(1); }} options={PAGE_SIZES} />
          </Field>
        </div>

        {/* Daftar */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size={28} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={History} title="Belum ada riwayat log permintaan" hint="Permintaan yang masuk ke gateway akan muncul di sini." />
        ) : (
          <>
            {/* Desktop: tabel */}
            <TableShell className="hidden md:block">
              <table className="w-full text-sm min-w-[860px]">
                <thead>
                  <tr className="text-left text-sm text-gray-400 bg-dark-800/60">
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Waktu</th>
                    <th className="px-4 py-3 font-medium">Latensi</th>
                    <th className="px-4 py-3 font-medium">Token</th>
                    <th className="px-4 py-3 font-medium">Akun</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => openDetail(item)}
                      onKeyDown={(e) => { if (e.key === "Enter") openDetail(item); }}
                      tabIndex={0}
                      className="border-t border-dark-700/50 hover:bg-dark-800/60 cursor-pointer align-top focus:outline-none focus:bg-dark-800/60"
                    >
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge item={item} /></td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <ModelCell item={item} />
                        <div className="mt-1.5"><TagBadges item={item} /></div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-300">{formatTime(item.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-300">{(item.use_time || 0).toFixed(2)}s</td>
                      <td className="px-4 py-3 whitespace-nowrap"><TokenCell item={item} /></td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="truncate text-gray-300" title={item.credential_email || ""}>{item.credential_email || "-"}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>

            {/* Mobile: kartu */}
            <div className="md:hidden space-y-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openDetail(item)}
                  className="w-full text-left rounded-2xl bg-dark-800/60 border border-dark-700/60 p-4 space-y-3 min-w-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1"><ModelCell item={item} /></div>
                    <StatusBadge item={item} />
                  </div>
                  <TagBadges item={item} />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock size={12} />{formatTime(item.created_at)}</span>
                    <span>{(item.use_time || 0).toFixed(2)}s</span>
                  </div>
                  <TokenCell item={item} />
                  <div className="text-xs text-gray-500 truncate" title={item.credential_email || ""}>{item.credential_email || "-"}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Paginasi */}
        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 text-sm text-gray-400">
            <span>Total {total} log</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Sebelumnya
              </Button>
              <span className="px-1">{page} / {totalPages}</span>
              <Button size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Berikutnya
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Rincian permintaan */}
      {detail && (
        <Dialog title="Rincian Permintaan" onClose={() => setDetail(null)}>
          <div>
            {detailRows.map(([k, v]) => (
              <InfoRow key={k} label={k}>
                <span className="font-mono text-xs sm:text-sm [overflow-wrap:anywhere]">{v}</span>
              </InfoRow>
            ))}
          </div>
          {detail.error_message && (
            <div className="mt-4">
              <div className="text-sm text-gray-400 mb-1.5">Pesan Kesalahan</div>
              <div className="rounded-2xl bg-red-500/10 border border-red-500/25 p-3 text-xs text-red-700 dark:text-red-300 break-all">
                {detail.error_message}
              </div>
            </div>
          )}
          {detail.request_log_file && (
            <div className="mt-4 rounded-2xl bg-dark-800 border border-dark-700/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-ink">Log Rinci Payload</div>
                <Button size="sm" icon={FileText} onClick={openRequestBody} loading={detailBodyLoading}>
                  Lihat Payload Rinci
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Payload lengkap (header dan body) disimpan untuk memudahkan investigasi error upstream (seperti 400).
              </p>
            </div>
          )}
        </Dialog>
      )}

      {/* Payload rinci */}
      {detailBody && (
        <Dialog
          wide
          z="z-[60]"
          title={detailBody.__missing ? "Payload Tidak Tersedia" : "Payload Permintaan Rinci"}
          onClose={() => setDetailBody(null)}
          actions={
            !detailBody.__missing && (
              <div className="flex flex-wrap items-center gap-2">
                {copyStatus === "ok" && <Badge tone="success">Tersalin</Badge>}
                {copyStatus === "fail" && <Badge tone="danger">Gagal menyalin</Badge>}
                <Button size="sm" onClick={copyDetailBody}>Salin JSON</Button>
              </div>
            )
          }
        >
          {detailBody.__missing ? (
            <EmptyState
              icon={AlertTriangle}
              title={detailBody.__message}
              hint="Berkas log di disk kemungkinan telah dibersihkan atau dihapus manual."
              className="!py-8"
            />
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-400 mb-1.5">URL Permintaan</div>
                <CodeBlock maxHeight={160} className="break-all">{detailBody.url || "-"}</CodeBlock>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1.5">Header Permintaan (Tersanitasi)</div>
                <CodeBlock maxHeight={240}>{JSON.stringify(detailBody.request_headers || {}, null, 2)}</CodeBlock>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1.5">Body Permintaan</div>
                <CodeBlock maxHeight={360}>{JSON.stringify(detailBody.request_body ?? {}, null, 2)}</CodeBlock>
              </div>
              {detailBody.response_body && (
                <div>
                  <div className="text-sm text-gray-400 mb-1.5">Respons Upstream</div>
                  <CodeBlock maxHeight={360}>{formatMaybeJson(detailBody.response_body)}</CodeBlock>
                </div>
              )}
              {detailBody.error_message && (
                <div>
                  <div className="text-sm text-gray-400 mb-1.5">Ringkasan Error</div>
                  <CodeBlock maxHeight={200} className="!bg-red-500/10 !border-red-500/25 !text-red-700 dark:!text-red-300">
                    {detailBody.error_message}
                  </CodeBlock>
                </div>
              )}
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
