import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Clock,
  Copy,
  Cpu,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";

function formatNumber(n) {
  return new Intl.NumberFormat("id-ID").format(n || 0);
}

function formatTokens(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatTime(ts) {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const percent = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** Semicircular ring built from radial ticks, like the "Financial Balance" gauge. */
function TickGauge({ value, size = 280, ticks = 54, inner = null }) {
  const cx = size / 2;
  const cy = size / 2;
  const sweep = 250;
  const start = -90 - sweep / 2;
  const ring = (count, r1, r2, fraction, filled, track, width) =>
    Array.from({ length: count }, (_, i) => {
      const a = ((start + (sweep * i) / (count - 1)) * Math.PI) / 180;
      return (
        <line
          key={`${r1}-${i}`}
          x1={cx + r1 * Math.cos(a)}
          y1={cy + r1 * Math.sin(a)}
          x2={cx + r2 * Math.cos(a)}
          y2={cy + r2 * Math.sin(a)}
          stroke={i / (count - 1) <= fraction ? filled : track}
          strokeWidth={width}
          strokeLinecap="round"
        />
      );
    });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[300px] mx-auto" role="img" aria-label={`${value}%`}>
      {ring(ticks, size * 0.38, size * 0.49, value / 100, "rgb(var(--ac-600))", "rgb(var(--dk-600) / 0.55)", 4)}
      {inner !== null &&
        ring(Math.round(ticks * 0.8), size * 0.31, size * 0.35, inner / 100, "rgb(var(--ac-400))", "rgb(var(--dk-600) / 0.35)", 3)}
    </svg>
  );
}

function StatTile({ title, value, icon: Icon, pill, caption, highlight = false }) {
  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between min-h-[150px] ${
        highlight
          ? "bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-lg shadow-purple-600/30"
          : "bg-dark-800/70 border border-dark-700/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-base font-medium ${highlight ? "text-white" : "text-gray-300"}`}>{title}</span>
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            highlight ? "bg-white/20 text-white" : "bg-dark-900 text-gray-400"
          }`}
        >
          <Icon size={15} />
        </span>
      </div>
      <div>
        <div className={`text-3xl sm:text-4xl font-semibold tracking-tight ${highlight ? "text-white" : "text-ink"}`}>
          {value}
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {pill}
          <span className={`text-xs ${highlight ? "text-white/80" : "text-gray-400"}`}>{caption}</span>
        </div>
      </div>
    </div>
  );
}

function Delta({ up, children, onColor = false }) {
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const tone = onColor ? "bg-white/20 text-white" : up ? "pill-up" : "pill-down";
  return (
    <span className={`pill ${tone}`}>
      <Icon size={12} />
      {children}
    </span>
  );
}

function QuotaBar({ label, used, resetTime }) {
  const usedPct = Math.min(100, Math.max(0, Math.round(used * 100)));
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm mb-2">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-xs text-gray-400">reset {resetTime}</span>
      </div>
      <div className="relative h-4 rounded-full overflow-hidden stripe-track">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-purple-600"
          style={{ width: `${Math.max(usedPct, usedPct > 0 ? 4 : 0)}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-gray-400">
        <span>{usedPct}% terpakai</span>
        <span>{100 - usedPct}% tersisa</span>
      </div>
    </div>
  );
}

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure context); the value is still visible to select */
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-xl bg-dark-800/70 border border-dark-700/60 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-gray-400">{label}</div>
        <div className="font-mono text-xs text-ink truncate select-all">{value}</div>
      </div>
      <button onClick={copy} className="w-8 h-8 shrink-0 rounded-full bg-dark-900 text-gray-400 hover:text-ink flex items-center justify-center" title="Salin">
        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

export default function Overview({ onNavigateTab }) {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [creds, setCreds] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, l, c] = await Promise.all([
        api.get("/usage-logs/stats"),
        api.get("/usage-logs/list", { params: { limit: 8 } }),
        api.get("/creds/status"),
      ]);
      setStats(s.data);
      setLogs(l.data.items || []);
      const items = c.data.items || [];
      setCreds(items);

      const active = items.find((i) => !i.disabled);
      if (active) {
        api
          .get(`/creds/quota/${encodeURIComponent(active.email)}`)
          .then((q) => setQuota({ email: active.email, models: q.data.models || {} }))
          .catch(() => setQuota(null));
      } else {
        setQuota(null);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Gagal memuat ringkasan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const total = stats?.total_requests || 0;
  const ok = stats?.success_count || 0;
  const fail = stats?.error_count ?? Math.max(0, total - ok);
  const rate = percent(ok, total);
  const activeCreds = creds.filter((c) => !c.disabled).length;

  const quotaBars = useMemo(() => {
    if (!quota) return [];
    const labels = { "gemini-5h": "Gemini · 5 jam", "gemini-weekly": "Gemini · mingguan", "3p-5h": "Claude & GPT · 5 jam", "3p-weekly": "Claude & GPT · mingguan" };
    return Object.entries(quota.models).map(([id, m]) => ({
      id,
      label: labels[id] || id,
      used: 1 - (m.remaining ?? 1),
      resetTime: m.resetTime || "-",
    }));
  }, [quota]);

  const fiveHour = quotaBars.find((b) => b.id === "gemini-5h");

  const filteredLogs = logs.filter((l) => {
    const q = query.trim().toLowerCase();
    return !q || `${l.model_name} ${l.credential_email} ${l.request_id}`.toLowerCase().includes(q);
  });

  const origin = window.location.origin;

  return (
    <div className="space-y-4">
      {error && <div className="card p-3 text-sm text-red-400">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Total requests + accounts */}
        <section className="card xl:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-ink">Total Permintaan</h2>
            <button onClick={load} disabled={loading} className="w-8 h-8 rounded-full bg-dark-800 text-gray-400 hover:text-ink flex items-center justify-center" title="Segarkan">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </button>
          </div>
          <div className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight text-ink">{formatNumber(total)}</div>
          <div className="mt-3 flex items-center gap-2">
            <Delta up={rate >= 90}>{rate}%</Delta>
            <span className="text-sm text-gray-400">berhasil dari seluruh permintaan</span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={() => onNavigateTab("playground")} className="btn btn-primary flex items-center justify-center gap-2 py-3">
              <Send size={15} /> Coba Chat
            </button>
            <button onClick={() => onNavigateTab("credentials")} className="btn btn-secondary flex items-center justify-center gap-2 py-3">
              <KeyRound size={15} /> Kredensial
            </button>
          </div>

          <div className="mt-5 rounded-2xl bg-dark-800/60 border border-dark-700/50 p-3">
            <div className="text-sm font-medium text-ink px-1 mb-2">
              Akun <span className="text-gray-400 font-normal">| {creds.length} terdaftar, {activeCreds} aktif</span>
            </div>
            {creds.length === 0 ? (
              <div className="text-sm text-gray-400 px-1 py-3">
                Belum ada kredensial.{" "}
                <button className="text-purple-500 hover:underline" onClick={() => onNavigateTab("oauth")}>
                  Tambah lewat OAuth
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {creds.slice(0, 4).map((c) => (
                  <div key={c.email} className="rounded-xl bg-dark-900 border border-dark-700/50 p-3 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-wide font-semibold text-gray-300">{c.tier || "akun"}</span>
                      <span className={`w-2 h-2 rounded-full ${c.disabled ? "bg-red-500" : "bg-emerald-500"}`} />
                    </div>
                    <div className="mt-1.5 text-xs text-ink truncate" title={c.email}>
                      {c.email}
                    </div>
                    <div className={`mt-1 text-xs font-medium ${c.disabled ? "text-red-400" : "text-emerald-400"}`}>
                      {c.disabled ? `Nonaktif${c.error_codes?.length ? ` · ${c.error_codes.join(",")}` : ""}` : "Aktif"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 2x2 tiles */}
        <section className="card xl:col-span-4">
          <div className="grid grid-cols-2 gap-3 h-full">
            <StatTile
              highlight
              title="Berhasil"
              icon={Zap}
              value={formatNumber(ok)}
              pill={<Delta up onColor>{rate}%</Delta>}
              caption="dari total"
            />
            <StatTile
              title="Gagal"
              icon={ArrowDownRight}
              value={formatNumber(fail)}
              pill={<Delta up={false}>{percent(fail, total)}%</Delta>}
              caption="dari total"
            />
            <StatTile
              title="Total Token"
              icon={Cpu}
              value={formatTokens(stats?.total_tokens)}
              pill={stats?.cached_tokens > 0 ? <Delta up>{formatTokens(stats.cached_tokens)}</Delta> : null}
              caption={stats?.cached_tokens > 0 ? "token cache" : "token terpakai"}
            />
            <StatTile
              title="Rata-rata Latensi"
              icon={Clock}
              value={`${(stats?.avg_use_time || 0).toFixed(1)}s`}
              pill={null}
              caption="per permintaan"
            />
          </div>
        </section>

        {/* Gauge */}
        <section className="card xl:col-span-4 flex flex-col">
          <h2 className="text-lg font-medium text-ink">Tingkat Keberhasilan</h2>
          <div className="relative mt-2 flex-1 flex items-center justify-center">
            <TickGauge value={rate} inner={fiveHour ? Math.round((1 - fiveHour.used) * 100) : null} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-5xl font-semibold tracking-tight text-ink">{rate}%</div>
              <div className="text-sm text-gray-400 mt-1">{total ? "Dari total" : "Belum ada data"}</div>
              <button onClick={() => onNavigateTab("usage-logs")} className="pointer-events-auto mt-2 px-4 py-1.5 rounded-full text-sm font-medium text-purple-500 hover:bg-purple-500/10">
                Detail
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-gray-400 pt-2">
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-[4px] bg-purple-600" /> Berhasil
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-[4px] bg-purple-400/70" /> Sisa kuota 5 jam
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-[4px] bg-dark-600/70" /> Kosong
            </span>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-4 space-y-4">
          <section className="card">
            <h2 className="text-lg font-medium text-ink mb-4">Batas Kuota</h2>
            {quotaBars.length === 0 ? (
              <div className="text-sm text-gray-400">
                {creds.some((c) => !c.disabled) ? "Memuat kuota…" : "Tambahkan kredensial aktif untuk melihat kuota."}
              </div>
            ) : (
              <div className="space-y-5">
                {quotaBars.map((b) => (
                  <QuotaBar key={b.id} label={b.label} used={b.used} resetTime={b.resetTime} />
                ))}
                {quota?.email && <div className="text-[11px] text-gray-400 truncate">Akun: {quota.email}</div>}
              </div>
            )}
          </section>

          <section className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium text-ink">Endpoint API</h2>
              <button onClick={() => onNavigateTab("presets")} className="text-xs text-purple-500 hover:underline">
                Preset agent
              </button>
            </div>
            <div className="space-y-2">
              <CopyRow label="OpenAI / Hermes (base URL)" value={`${origin}/v1`} />
              <CopyRow label="Gemini" value={`${origin}/v1beta`} />
            </div>
          </section>
        </div>

        {/* Recent activity */}
        <section className="card xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-medium text-ink">Aktivitas Terbaru</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari model / akun"
                  className="pl-8 pr-3 py-2 w-44 sm:w-56 rounded-full bg-dark-800 border border-dark-700 text-sm text-ink placeholder-gray-500"
                />
              </div>
              <button onClick={() => onNavigateTab("usage-logs")} className="btn btn-secondary py-2 flex items-center gap-1.5">
                Lihat semua
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-dark-700/60">
            <table className="min-w-[640px]">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Model</th>
                  <th>Akun</th>
                  <th>Token</th>
                  <th>Status</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-8">
                      {loading ? "Memuat…" : "Belum ada aktivitas."}
                    </td>
                  </tr>
                )}
                {filteredLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="font-mono text-xs text-gray-400">{(l.request_id || "").slice(0, 8)}</td>
                    <td className="font-medium text-ink">{l.model_name}</td>
                    <td className="text-gray-400 max-w-[160px] truncate" title={l.credential_email}>
                      {l.credential_email || "-"}
                    </td>
                    <td>{formatTokens(l.total_tokens)}</td>
                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${l.success ? "bg-emerald-500" : "bg-red-500"}`} />
                        {l.success ? "Berhasil" : `Gagal ${l.status_code}`}
                      </span>
                    </td>
                    <td className="text-gray-400 whitespace-nowrap">{formatTime(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
