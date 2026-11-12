import {
  AlertCircle,
  Ban,
  BarChart3,
  CheckCircle,
  Clock,
  Download,
  KeyRound,
  Plus,
  RefreshCw,
  Rocket,
  Shield,
  Snowflake,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Modal from "../components/Modal";
import Select from "../components/Select";
import { Badge, Button, Card, CodeBlock, EmptyState, Notice, Spinner, StatCard } from "../components/ui";
import api from "../api";

export default function Credentials({ onNavigateTab }) {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, normal: 0, disabled: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState("all");
  const [errorCodeFilter, setErrorCodeFilter] = useState("all");
  const [cooldownFilter, setCooldownFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [message, setMessage] = useState(null);
  const [errorModal, setErrorModal] = useState(null);
  const [busyFiles, setBusyFiles] = useState(new Set());
  const [now, setNow] = useState(Date.now() / 1000);
  // Status modal kuota
  const [quotaModal, setQuotaModal] = useState(null); // { email }
  const [quotaCache, setQuotaCache] = useState({}); // Cache kuota { email: { claude, gemini } | { error } }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchCreds = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      const res = await api.get("/creds/status", {
        params: {
          offset,
          limit: pageSize,
          status_filter: statusFilter,
          error_code_filter: errorCodeFilter,
          cooldown_filter: cooldownFilter,
          tier_filter: tierFilter,
        },
      });
      setItems(res.data.items);
      setTotal(res.data.total);
      setStats(res.data.stats || { total: 0, normal: 0, disabled: 0 });
      setSelected(new Set());
    } catch (err) {
      showMessage("error", err.response?.data?.detail || "Gagal memuat kredensial");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, errorCodeFilter, cooldownFilter, tierFilter]);

  useEffect(() => {
    fetchCreds();
  }, [fetchCreds]);

  const showMessage = useCallback((type, text, title) => {
    setMessage({ type, text, title: title || (type === "success" ? "Berhasil" : type === "error" ? "Gagal" : "Informasi") });
  }, []);

  const setBusy = (email, busy) => {
    setBusyFiles((prev) => {
      const next = new Set(prev);
      if (busy) next.add(email);
      else next.delete(email);
      return next;
    });
  };

  const doAction = async (email, action) => {
    setBusy(email, true);
    try {
      const res = await api.post("/creds/action", { email, action });
      showMessage("success", res.data.message);
      fetchCreds();
    } catch (err) {
      showMessage("error", err.response?.data?.detail || "Gagal menjalankan tindakan");
    } finally {
      setBusy(email, false);
    }
  };

  const doBatchAction = async (action) => {
    if (selected.size === 0) return;
    setBusy("__batch__", true);
    try {
      const res = await api.post("/creds/batch-action", {
        action,
        emails: Array.from(selected),
      });
      showMessage(res.data.errors?.length ? "error" : "success", res.data.message);
      fetchCreds();
    } catch (err) {
      showMessage("error", err.response?.data?.detail || "Gagal menjalankan tindakan massal");
    } finally {
      setBusy("__batch__", false);
    }
  };

  const verifyProject = async (email) => {
    setBusy(email, true);
    try {
      const res = await api.post(`/creds/verify-project/${encodeURIComponent(email)}`);
      if (res.data.success) {
        showMessage(
          "success",
          `Project ID: ${res.data.project_id}, Tier: ${res.data.subscription_tier}`,
          `Verifikasi Berhasil: ${email}`
        );
      } else {
        showMessage("error", res.data.message || res.data.error || "Verifikasi gagal", `Verifikasi Gagal: ${email}`);
      }
      fetchCreds();
    } catch (err) {
      showMessage(
        "error",
        err.response?.data?.detail || err.response?.data?.error || err.response?.data?.message || "Verifikasi gagal",
        `Verifikasi Gagal: ${email}`
      );
    } finally {
      setBusy(email, false);
    }
  };

  const testCredential = async (email) => {
    setBusy(email, true);
    try {
      const res = await api.post(`/creds/test/${encodeURIComponent(email)}`);
      showMessage(
        "success",
        res.data.message || (res.status === 429 ? "Kredensial terkena batas laju (429), namun masih valid" : "Kredensial berfungsi normal"),
        `Uji Coba Berhasil: ${email}`
      );
      fetchCreds();
    } catch (err) {
      const data = err.response?.data || {};
      const status = err.response?.status;
      const upstreamError = data.error || data.detail || data.message || "Uji coba gagal";
      showMessage(
        status === 429 ? "info" : "error",
        `HTTP ${status}\n${upstreamError}`,
        `Uji Coba Gagal: ${email}`
      );
      fetchCreds();
    } finally {
      setBusy(email, false);
    }
  };

  const openQuotaModal = async (email) => {
    setQuotaModal({ email });
    setBusy(email, true);
    try {
      const res = await api.get(`/creds/quota/${encodeURIComponent(email)}`);
      if (res.data.success) {
        const aggregated = aggregateQuota(res.data.quotaGroups || []);
        setQuotaCache((prev) => ({ ...prev, [email]: aggregated }));
      } else {
        setQuotaCache((prev) => ({ ...prev, [email]: { error: res.data.error || "Gagal mengambil data kuota" } }));
      }
    } catch (err) {
      setQuotaCache((prev) => ({
        ...prev,
        [email]: { error: err.response?.data?.detail || err.response?.data?.error || "Gagal mengambil data kuota" },
      }));
    } finally {
      setBusy(email, false);
    }
  };

  const aggregateQuota = (groups) => {
    const result = {
      claude: { remaining: 0, count: 0, resetTime: "" },
      gemini: { remaining: 0, count: 0, resetTime: "" },
    };

    groups.forEach((group) => {
      const name = (group.displayName || "").toLowerCase();
      const target = name.includes("claude") ? result.claude : result.gemini;
      target.count += 1;

      let minPct = null;
      let minResetTime = "";
      (group.buckets || []).forEach((bucket) => {
        const pct = (bucket.remainingFraction || 0) * 100;
        if (minPct === null || pct < minPct) {
          minPct = pct;
          minResetTime = bucket.resetTime || "";
        }
      });

      if (minPct !== null) {
        target.remaining += Math.round(minPct * 10) / 10;
        if (!target.resetTime && minResetTime) {
          try {
            target.resetTime = new Date(minResetTime).toLocaleString("id-ID");
          } catch {
            target.resetTime = minResetTime;
          }
        }
      }
    });

    if (result.claude.count > 1)
      result.claude.remaining = Math.round(result.claude.remaining / result.claude.count);
    if (result.gemini.count > 1)
      result.gemini.remaining = Math.round(result.gemini.remaining / result.gemini.count);

    return result;
  };

  const getQuotaColor = (remaining) => {
    if (remaining >= 80) return { bar: "bg-green-500", text: "text-green-400" };
    if (remaining >= 40) return { bar: "bg-yellow-500", text: "text-yellow-400" };
    if (remaining >= 20) return { bar: "bg-orange-500", text: "text-orange-400" };
    return { bar: "bg-red-500", text: "text-red-400" };
  };

  const exportCredential = async (email) => {
    try {
      const res = await api.get(`/creds/export/${encodeURIComponent(email)}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${email}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMessage("success", `Kredensial ${email}.json berhasil diunduh`);
    } catch (err) {
      showMessage("error", err.response?.data?.detail || "Gagal mengekspor kredensial");
    }
  };

  const downloadAll = async () => {
    setBusy("__batch__", true);
    try {
      const res = await api.get("/creds/download-all", {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "antigravity_credentials.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showMessage("error", err.response?.data?.detail || "Gagal mengunduh arsip");
    } finally {
      setBusy("__batch__", false);
    }
  };

  const openErrors = async (email) => {
    try {
      const res = await api.get(`/creds/errors/${encodeURIComponent(email)}`);
      setErrorModal(res.data);
    } catch (err) {
      showMessage("error", err.response?.data?.detail || "Gagal memuat detail kesalahan");
    }
  };

  const toggleSelect = (email) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.email)));
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const formatTime = (ts) => {
    if (!ts) return "-";
    return new Date(ts * 1000).toLocaleString("id-ID");
  };

  const getCooldownText = (cooldowns) => {
    const active = Object.entries(cooldowns || {}).filter(
      ([, until]) => until > now
    );
    if (!active.length) return null;
    const longest = Math.max(...active.map(([, until]) => until));
    const remain = longest - now;
    const h = Math.floor(remain / 3600);
    const m = Math.floor((remain % 3600) / 60);
    const s = Math.floor(remain % 60);
    return h > 0 ? `${h}j ${m}m` : m > 0 ? `${m}m ${s}d` : `${s}d`;
  };

  const tierTone = (tier) => (tier === "ultra" ? "accent" : tier === "pro" ? "info" : "neutral");

  const filtersActive =
    statusFilter !== "all" || errorCodeFilter !== "all" || cooldownFilter !== "all" || tierFilter !== "all";

  const batchBusy = busyFiles.has("__batch__");
  const noneSelected = selected.size === 0;
  const allSelected = selected.size === items.length && items.length > 0;

  const quotaEmail = quotaModal?.email;
  const quotaData = quotaEmail ? quotaCache[quotaEmail] : null;
  const quotaLoading = quotaEmail ? busyFiles.has(quotaEmail) : false;

  const QuotaRow = ({ label, tone, data }) => {
    const color = getQuotaColor(data.remaining);
    return (
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <Badge tone={tone}>{label}</Badge>
          <span className={`text-sm font-semibold ${color.text}`}>{data.remaining.toFixed(1)}%</span>
        </div>
        <div className="bg-dark-800 border border-dark-700/60 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full ${color.bar}`}
            style={{ width: `${Math.max(0, Math.min(data.remaining, 100))}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Modal Pesan */}
      {message && (
        <Modal type={message.type} title={message.title} onClose={() => setMessage(null)}>
          <span className="whitespace-pre-wrap break-words">{message.text}</span>
        </Modal>
      )}

      {/* Ringkasan Statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} tone="accent" label="Total Akun" value={stats.total} />
        <StatCard icon={CheckCircle} tone="success" label="Aktif" value={stats.normal} />
        <StatCard icon={Ban} tone="danger" label="Nonaktif" value={stats.disabled} />
      </div>

      {/* Tombol Aksi + Filter + Aksi Massal */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {onNavigateTab && (
              <Button variant="primary" icon={Plus} onClick={() => onNavigateTab("oauth")}>
                Tambah Akun (Google OAuth)
              </Button>
            )}
            <Button icon={RefreshCw} onClick={fetchCreds} disabled={loading} loading={loading}>
              Segarkan Status
            </Button>
            <Button icon={Download} onClick={downloadAll} disabled={batchBusy}>
              Ekspor Semua (ZIP)
            </Button>
          </div>
          {onNavigateTab && (
            <Button variant="ghost" icon={Rocket} onClick={() => onNavigateTab("presets")} className="text-purple-500">
              Preset Coding Agent
            </Button>
          )}
        </div>

        {/* Filter Kredensial */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-dark-700/60">
          <Select
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            className="w-[calc(50%-0.25rem)] sm:w-44"
            options={[
              { value: "all", label: "Status: Semua" },
              { value: "enabled", label: "Hanya Aktif" },
              { value: "disabled", label: "Hanya Nonaktif" },
            ]}
          />
          <Select
            value={errorCodeFilter}
            onChange={(v) => {
              setErrorCodeFilter(v);
              setPage(1);
            }}
            className="w-[calc(50%-0.25rem)] sm:w-44"
            options={[
              { value: "all", label: "Error: Semua" },
              { value: "none", label: "Tanpa Error" },
              { value: "400", label: "HTTP 400" },
              { value: "403", label: "HTTP 403" },
              { value: "429", label: "HTTP 429" },
              { value: "500", label: "HTTP 500" },
            ]}
          />
          <Select
            value={cooldownFilter}
            onChange={(v) => {
              setCooldownFilter(v);
              setPage(1);
            }}
            className="w-[calc(50%-0.25rem)] sm:w-44"
            options={[
              { value: "all", label: "Cooldown: Semua" },
              { value: "in_cooldown", label: "Sedang CD" },
              { value: "no_cooldown", label: "Tanpa CD" },
            ]}
          />
          <Select
            value={tierFilter}
            onChange={(v) => {
              setTierFilter(v);
              setPage(1);
            }}
            className="w-[calc(50%-0.25rem)] sm:w-40"
            options={[
              { value: "all", label: "Tier: Semua" },
              { value: "free", label: "Free" },
              { value: "pro", label: "Pro" },
              { value: "ultra", label: "Ultra" },
            ]}
          />
          <Select
            value={pageSize}
            onChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
            className="w-[calc(50%-0.25rem)] sm:w-36"
            options={[20, 50, 100, 200, 500, 1000].map((n) => ({
              value: n,
              label: `${n} baris`,
            }))}
          />
        </div>

        {/* Aksi Massal */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 border-t border-dark-700/60">
          <label className="flex items-center gap-2.5 text-sm text-gray-300 cursor-pointer select-none min-h-9">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            Pilih Semua
          </label>
          <span className="text-sm text-gray-400">{selected.size} akun dipilih</span>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button size="sm" className="min-h-9" onClick={() => doBatchAction("enable")} disabled={noneSelected || batchBusy}>
              Aktifkan Terpilih
            </Button>
            <Button size="sm" className="min-h-9" onClick={() => doBatchAction("disable")} disabled={noneSelected || batchBusy}>
              Nonaktifkan Terpilih
            </Button>
            <Button size="sm" variant="danger" className="min-h-9" onClick={() => doBatchAction("delete")} disabled={noneSelected || batchBusy}>
              Hapus Terpilih
            </Button>
          </div>
        </div>
      </Card>

      {/* Daftar Kartu Kredensial */}
      {loading ? (
        <Card className="flex items-center justify-center py-12">
          <Spinner size={28} className="text-purple-500" />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={KeyRound}
            title={filtersActive ? "Tidak ada kredensial yang cocok" : "Belum ada kredensial tersimpan"}
            hint={
              filtersActive
                ? "Ubah atau atur ulang filter untuk melihat akun lainnya."
                : "Silakan hubungkan akun via tab Autentikasi OAuth atau Impor Massal."
            }
            action={
              onNavigateTab && !filtersActive ? (
                <Button variant="primary" icon={Plus} onClick={() => onNavigateTab("oauth")}>
                  Tambah Akun (Google OAuth)
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((cred) => {
            const cooldownText = getCooldownText(cred.model_cooldowns);
            const busy = busyFiles.has(cred.email);
            const hasErrors = !!cred.error_codes?.length;
            const initial = (cred.email || "?").trim().charAt(0).toUpperCase() || "?";
            return (
              <Card
                key={cred.email}
                className={`!p-4 sm:!p-5 flex flex-col gap-4 transition-colors ${
                  cred.disabled ? "!border-red-500/30" : ""
                } ${selected.has(cred.email) ? "ring-2 ring-purple-500/30" : ""}`}
              >
                {/* Header Kartu */}
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-base font-semibold ${
                      cred.disabled ? "bg-red-500/10 text-red-500" : "bg-purple-600/10 text-purple-500"
                    }`}
                    aria-hidden="true"
                  >
                    {initial}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate" title={cred.email}>
                      {cred.email}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={tierTone(cred.tier)} className="capitalize">
                        {cred.tier || "pro"}
                      </Badge>
                      {cred.disabled ? (
                        <Badge tone="danger" dot>
                          Nonaktif
                        </Badge>
                      ) : (
                        <Badge tone="success" dot>
                          Aktif
                        </Badge>
                      )}
                    </div>
                  </div>
                  <label className="w-9 h-9 -my-1 shrink-0 flex items-center justify-center cursor-pointer" title="Pilih akun">
                    <input
                      type="checkbox"
                      aria-label={`Pilih ${cred.email}`}
                      checked={selected.has(cred.email)}
                      onChange={() => toggleSelect(cred.email)}
                    />
                  </label>
                </div>

                {/* Area Info */}
                <div className="rounded-xl bg-dark-800 px-3.5 py-3 space-y-2 text-xs min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-400 flex items-center gap-1.5 shrink-0">
                      <Snowflake size={13} /> Cooldown
                    </span>
                    {cooldownText ? (
                      <span className="text-cyan-400 font-medium truncate">CD {cooldownText}</span>
                    ) : (
                      <span className="text-gray-500 truncate">Siap</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <span className="text-gray-400 flex items-center gap-1.5 shrink-0">
                      <AlertCircle size={13} /> Error
                    </span>
                    {hasErrors ? (
                      <button
                        type="button"
                        onClick={() => openErrors(cred.email)}
                        className="min-w-0 max-w-full rounded-full hover:opacity-80 transition-opacity"
                        title="Lihat detail kesalahan"
                      >
                        <Badge tone="danger" icon={AlertCircle}>
                          Err: {cred.error_codes.join(", ")}
                        </Badge>
                      </button>
                    ) : (
                      <span className="text-gray-500 truncate">Normal</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <span className="text-gray-400 flex items-center gap-1.5 shrink-0">
                      <Clock size={13} /> Terakhir sukses
                    </span>
                    <span className="text-gray-300 truncate min-w-0" title={formatTime(cred.last_success)}>
                      {formatTime(cred.last_success)}
                    </span>
                  </div>
                </div>

                {/* Tombol Aksi */}
                <div className="flex flex-wrap items-center gap-2 pt-4 mt-auto border-t border-dark-700/60">
                  <Button
                    size="sm"
                    className="min-h-9"
                    icon={Shield}
                    disabled={busy}
                    onClick={() => verifyProject(cred.email)}
                    title="Verifikasi Project ID & Tier (Mengatasi error 403)"
                  >
                    Cek
                  </Button>
                  <Button
                    size="sm"
                    className="min-h-9"
                    icon={Zap}
                    disabled={busy}
                    onClick={() => testCredential(cred.email)}
                    title="Uji coba koneksi kredensial"
                  >
                    Uji
                  </Button>
                  <Button
                    size="sm"
                    className="min-h-9"
                    icon={BarChart3}
                    disabled={busy || cred.disabled}
                    onClick={() => openQuotaModal(cred.email)}
                    title="Lihat sisa kuota akun"
                  >
                    Kuota
                  </Button>
                  <Button
                    size="sm"
                    className="min-h-9"
                    icon={Download}
                    disabled={busy}
                    onClick={() => exportCredential(cred.email)}
                    title="Ekspor berkas JSON"
                  >
                    Ekspor
                  </Button>
                  <Button
                    size="sm"
                    className={`min-h-9 ${cred.disabled ? "!text-emerald-600 dark:!text-emerald-400" : "!text-amber-700 dark:!text-amber-400"}`}
                    icon={cred.disabled ? CheckCircle : Ban}
                    disabled={busy}
                    onClick={() => doAction(cred.email, cred.disabled ? "enable" : "disable")}
                    title={cred.disabled ? "Aktifkan kredensial" : "Nonaktifkan kredensial"}
                  >
                    {cred.disabled ? "Aktifkan" : "Nonaktif"}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    className="min-h-9"
                    icon={Trash2}
                    disabled={busy}
                    onClick={() => doAction(cred.email, "delete")}
                    title="Hapus kredensial"
                  >
                    Hapus
                  </Button>
                  {busy && <Spinner size={16} className="text-purple-500" />}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Navigasi Halaman */}
      {total > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-gray-400 min-w-0">
            Total {total} kredensial, halaman {page} dari {totalPages}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="min-h-9" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Sebelumnya
            </Button>
            <span className="text-sm text-gray-400 px-1">
              {page} / {totalPages}
            </span>
            <Button size="sm" className="min-h-9" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Berikutnya
            </Button>
          </div>
        </div>
      )}

      {/* Modal Kuota */}
      {quotaModal && (
        <Modal type="info" title={`Status Kuota Akun - ${quotaModal.email}`} onClose={() => setQuotaModal(null)}>
          {quotaLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-gray-400">
              <Spinner size={16} />
              Memuat data kuota...
            </div>
          ) : quotaData?.error ? (
            <Notice tone="danger" icon={AlertCircle}>
              {quotaData.error}
            </Notice>
          ) : quotaData ? (
            <div className="space-y-4">
              {quotaData.claude?.count > 0 && <QuotaRow label="Claude" tone="accent" data={quotaData.claude} />}
              {quotaData.gemini?.count > 0 && <QuotaRow label="Gemini" tone="info" data={quotaData.gemini} />}
              {!quotaData.claude?.count && !quotaData.gemini?.count && (
                <div className="text-center py-3 text-gray-400">Data kuota belum tersedia</div>
              )}
              {(quotaData.claude?.resetTime || quotaData.gemini?.resetTime) && (
                <div className="text-xs text-gray-400 text-right">
                  Waktu Reset: {quotaData.claude?.resetTime || quotaData.gemini?.resetTime}
                </div>
              )}
              <Button
                className="w-full"
                icon={RefreshCw}
                onClick={() => openQuotaModal(quotaModal.email)}
                disabled={quotaLoading}
              >
                Segarkan Kuota
              </Button>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400">Memuat...</div>
          )}
        </Modal>
      )}

      {/* Modal Detail Kesalahan */}
      {errorModal && (
        <Modal type="error" title={`Detail Kesalahan - ${errorModal.email}`} onClose={() => setErrorModal(null)}>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-400 mb-1.5">Kode Status Error</div>
              <div className="flex flex-wrap gap-1.5">
                {(errorModal.error_codes || []).length ? (
                  errorModal.error_codes.map((c) => (
                    <Badge key={c} tone="danger">
                      {c}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-gray-300">Tidak ada</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-400 mb-1.5">Pesan Error</div>
              <CodeBlock maxHeight={224}>{JSON.stringify(errorModal.error_messages, null, 2)}</CodeBlock>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  verifyProject(errorModal.email);
                  setErrorModal(null);
                }}
              >
                Perbaiki (Sinkronisasi Project ID)
              </Button>
              <Button
                onClick={() => {
                  testCredential(errorModal.email);
                  setErrorModal(null);
                }}
              >
                Uji Kredensial
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
