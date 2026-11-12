import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Info,
  KeyRound,
  Laptop,
  Plus,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Modal from "../components/Modal";
import { Badge, Button, Card, CardHeader, EmptyState, InfoRow, Notice, Spinner, Textarea } from "../components/ui";
import api from "../api";

export default function OAuth({ onNavigateTab }) {
  const [status, setStatus] = useState("idle"); // 'idle' | 'authenticating' | 'success' | 'error'
  const [authUrl, setAuthUrl] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [showRemoteHelper, setShowRemoteHelper] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: init, 2: wait google, 3: storing

  const popupRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Bersihkan listener dan popup saat unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    };
  }, []);

  // Listener window postMessage dari popup callback backend
  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.data?.type === "AGYBRIDGE_OAUTH_SUCCESS") {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setCurrentStep(3);
        try {
          const res = await api.post("/auth/callback", {});
          if (res.data) {
            handleAuthSuccess(res.data);
          }
        } catch (err) {
          console.error("Gagal finalisasi callback setelah postMessage:", err);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleAuthSuccess = (data) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    setSuccessData(data);
    setStatus("success");
    setCurrentStep(3);
  };

  const startOneClickAuth = async () => {
    setStatus("authenticating");
    setErrorMessage("");
    setSuccessData(null);
    setCurrentStep(1);

    try {
      const res = await api.post("/auth/start", {});
      const url = res.data.auth_url;
      setAuthUrl(url);
      setCurrentStep(2);

      // Buka popup Google OAuth di tengah layar
      const width = 560;
      const height = 720;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      popupRef.current = window.open(
        url,
        "AGYBridge_Google_OAuth",
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );

      // Mulai polling backend untuk menunggu autorisasi
      let attempts = 0;
      const maxAttempts = 60; // 60 x 1.5s = 90 detik timeout

      pollIntervalRef.current = setInterval(async () => {
        attempts += 1;
        if (attempts > maxAttempts) {
          clearInterval(pollIntervalRef.current);
          setStatus("error");
          setErrorMessage("Waktu tunggu autentikasi habis (90 detik). Silakan coba lagi.");
          return;
        }

        try {
          // Callback endpoint di backend menunggu proses code jika sedang berlangsung
          const callbackRes = await api.post("/auth/callback", {});
          if (callbackRes.data && callbackRes.data.credentials) {
            clearInterval(pollIntervalRef.current);
            handleAuthSuccess(callbackRes.data);
          }
        } catch (err) {
          // Masih menunggu, abaikan 400 error sementara sampai selesai
          const detail = err.response?.data?.detail || err.response?.data?.error || "";
          if (detail.includes("Alur autentikasi tidak ditemukan")) {
            // Flow mungkin belum diinisialisasi atau sudah kadaluarsa
          }
        }
      }, 1500);
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err.response?.data?.detail || "Gagal menghubungi server untuk memulai autentikasi Google."
      );
    }
  };

  const processCallbackUrl = async () => {
    if (!callbackUrl.trim()) {
      setErrorMessage("Tempelkan URL callback lengkap terlebih dahulu");
      return;
    }
    setStatus("authenticating");
    setCurrentStep(3);
    setErrorMessage("");

    try {
      const res = await api.post("/auth/callback-url", {
        callback_url: callbackUrl.trim(),
      });
      handleAuthSuccess(res.data);
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err.response?.data?.detail || "Gagal memproses kredensial dari URL callback yang ditempel."
      );
    }
  };

  const copyUrl = () => {
    if (!authUrl) return;
    try {
      navigator.clipboard.writeText(authUrl).catch(() => {});
    } catch {
      /* clipboard unavailable (insecure context) */
    }
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const resetFlow = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    setStatus("idle");
    setAuthUrl("");
    setCallbackUrl("");
    setSuccessData(null);
    setErrorMessage("");
    setCurrentStep(1);
  };

  const downloadBackupCreds = () => {
    if (!successData?.credentials) return;
    const blob = new Blob([JSON.stringify(successData.credentials, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `antigravity-${successData.email || "account"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const FEATURES = [
    { icon: ShieldCheck, title: "OAuth 2.0 Resmi", text: "Token langsung dari Google Cloud", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    { icon: Sparkles, title: "Deteksi Tier Otomatis", text: "Free, Pro, atau Ultra siap pakai", tone: "bg-purple-600/10 text-purple-500" },
    { icon: CheckCircle2, title: "Auto Simpan DB", text: "Tanpa repot upload berkas manual", tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  ];

  const STEPS = [
    "Inisialisasi Tautan Google OAuth",
    "Menunggu Persetujuan di Jendela Google",
    "Simpan Kredensial & Konfigurasi Akun",
  ];

  const resetButton = (
    <Button size="sm" variant="secondary" icon={RefreshCw} onClick={resetFlow}>
      Mulai Ulang
    </Button>
  );

  const callbackInput = (rows) => (
    <Textarea
      value={callbackUrl}
      onChange={(e) => setCallbackUrl(e.target.value)}
      placeholder="Tempelkan URL callback di sini (misal: http://localhost:11451/?state=xxx&code=xxx...)"
      className="font-mono text-xs break-all"
      rows={rows}
    />
  );

  return (
    <div className="space-y-4">
      {/* Modal Pesan Error jika terjadi kendala */}
      {errorMessage && (
        <Modal type="error" title="Kendala Autentikasi" onClose={() => setErrorMessage("")}>
          <div className="space-y-3">
            <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{errorMessage}</p>
            <Notice tone="info" icon={Info} title="Solusi cepat">
              Jika browser tidak dapat membuka popup atau redirect gagal di remote VPS, gunakan mode <strong>Remote Callback Helper</strong> di halaman ini.
            </Notice>
          </div>
        </Modal>
      )}

      {/* 1. IDLE: tombol utama satu klik */}
      {status === "idle" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            <Card className="lg:col-span-2 flex flex-col justify-center">
              <div className="flex flex-col items-start gap-5">
                <span className="w-14 h-14 rounded-full bg-purple-600/10 text-purple-500 flex items-center justify-center">
                  <Rocket size={26} />
                </span>
                <div className="min-w-0 max-w-xl">
                  <div className="mb-3">
                    <Badge tone="accent" icon={Rocket}>OAuth 2.0 Web Flow</Badge>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink break-words">
                    Hubungkan Akun Google Anda
                  </h2>
                  <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                    Klik tombol di bawah ini. Jendela resmi Google akan terbuka untuk meminta izin akun Antigravity. Setelah Anda setujui, akun langsung aktif tanpa unduh file JSON. Kredensial, refresh token, dan Project ID diverifikasi otomatis.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" size="lg" icon={Rocket} onClick={startOneClickAuth} className="!whitespace-normal text-center">
                    Login dengan Akun Google (Satu Klik)
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    icon={Laptop}
                    onClick={() => setShowRemoteHelper(!showRemoteHelper)}
                    aria-expanded={showRemoteHelper}
                  >
                    Mode VPS / Remote
                    <ChevronDown size={14} className={`transition-transform ${showRemoteHelper ? "rotate-180" : ""}`} />
                  </Button>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Kenapa lewat OAuth?" subtitle="Cara tercepat menambah akun." />
              <ul className="space-y-4">
                {FEATURES.map((f) => (
                  <li key={f.title} className="flex items-start gap-3 min-w-0">
                    <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${f.tone}`}>
                      <f.icon size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink">{f.title}</div>
                      <div className="text-sm text-gray-400">{f.text}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Remote / VPS Helper */}
          {showRemoteHelper && (
            <Card>
              <CardHeader
                icon={Laptop}
                title="Autentikasi Remote VPS"
                subtitle="Gunakan jika browser laptop menampilkan koneksi gagal setelah login Google."
              />
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                Saat Anda mengakses AGYBridge di VPS melalui IP publik, Google akan mencoba mengarahkan callback kembali ke{" "}
                <code className="rounded-md bg-dark-800 px-1.5 py-0.5 text-xs text-ink break-all">http://localhost:11451</code> di laptop Anda. Salin tautan dari address bar jendela tersebut lalu tempel di bawah ini.
              </p>
              <div className="space-y-3">
                {callbackInput(3)}
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" icon={Rocket} onClick={processCallbackUrl} className="!whitespace-normal text-center">
                    Proses & Simpan dari URL Callback
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* 2. AUTHENTICATING: progres */}
      {status === "authenticating" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <Card className="lg:col-span-2">
            <CardHeader
              icon={Rocket}
              title="Menghubungkan ke Akun Google..."
              subtitle="Selesaikan login dan persetujuan akun di jendela popup yang telah terbuka."
              action={resetButton}
            />
            <ol className="space-y-3">
              {STEPS.map((label, i) => {
                const n = i + 1;
                const done = n < currentStep;
                const active = n === currentStep;
                return (
                  <li
                    key={label}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm min-w-0 ${
                      active
                        ? "bg-purple-600/10 border-purple-500/30 text-ink font-medium"
                        : done
                        ? "bg-dark-800 border-dark-700/60 text-gray-300"
                        : "bg-dark-800/50 border-dark-700/40 text-gray-500"
                    }`}
                  >
                    <span
                      className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${
                        done
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : active
                          ? "bg-purple-600/10 text-purple-500"
                          : "bg-dark-700 text-gray-500"
                      }`}
                    >
                      {done ? <Check size={16} /> : active ? <Spinner size={16} className="text-purple-500" /> : n}
                    </span>
                    <span className="min-w-0 break-words">{label}</span>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card>
            <CardHeader
              icon={ExternalLink}
              title="Popup tidak muncul?"
              subtitle="Buka tautan secara manual atau tempel callback URL."
            />
            <div className="space-y-4">
              {authUrl && (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary inline-flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <ExternalLink size={15} />
                    Buka di Tab Baru
                  </a>
                  <Button variant="secondary" onClick={copyUrl} icon={copiedUrl ? Check : Copy}>
                    {copiedUrl ? "Tersalin!" : "Salin Tautan"}
                  </Button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowRemoteHelper(!showRemoteHelper)}
                className="text-sm text-purple-500 hover:underline text-left break-words"
              >
                Menggunakan Remote VPS & popup gagal redirect? Klik di sini untuk tempel callback URL
              </button>

              {showRemoteHelper && (
                <div className="space-y-3">
                  {callbackInput(3)}
                  <Button variant="primary" icon={Rocket} onClick={processCallbackUrl} className="w-full !whitespace-normal text-center">
                    Selesaikan dengan Callback URL
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* 3. SUCCESS: kartu sukses & tindakan selanjutnya */}
      {status === "success" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <Card className="lg:col-span-2">
            <div className="flex flex-col items-center text-center mb-6">
              <span className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <CheckCircle2 size={32} />
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-ink break-words">Akun Google Berhasil Terhubung!</h2>
              <p className="text-sm text-gray-400 mt-1.5 max-w-md">
                Kredensial dan refresh token telah disimpan dengan aman ke database AGYBridge.
              </p>
            </div>

            <div className="rounded-2xl bg-dark-800/60 border border-dark-700/60 px-4 py-1">
              <InfoRow label="Email Akun">
                <span className="font-mono text-xs break-all">{successData?.email || "-"}</span>
              </InfoRow>
              <InfoRow label="Langganan / Tier">
                <Badge tone="accent">{successData?.tier || "Free"}</Badge>
              </InfoRow>
              <InfoRow label="Status Rotasi">
                <Badge tone="success" dot>Aktif & siap melayani permintaan</Badge>
              </InfoRow>
            </div>
          </Card>

          <Card>
            <CardHeader title="Langkah berikutnya" subtitle="Lanjutkan pengaturan akun Anda." />
            <div className="flex flex-col gap-2">
              <Button variant="primary" icon={KeyRound} onClick={() => onNavigateTab && onNavigateTab("credentials")} className="w-full">
                Buka Daftar Kredensial
              </Button>
              <Button variant="secondary" icon={Terminal} onClick={() => onNavigateTab && onNavigateTab("presets")} className="w-full">
                Setup di Coding Agent
              </Button>
            </div>
            <div className="mt-4 pt-4 border-t border-dark-700/50 flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" icon={Plus} onClick={startOneClickAuth}>
                Hubungkan Akun Lain
              </Button>
              <Button variant="ghost" size="sm" icon={Download} onClick={downloadBackupCreds}>
                Unduh Berkas Backup JSON
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 4. ERROR: pesan lengkap tampil di modal; kartu ini menyediakan jalan keluar */}
      {status === "error" && (
        <Card>
          <EmptyState
            icon={AlertCircle}
            title="Autentikasi belum berhasil"
            hint="Terjadi kendala saat menghubungkan akun Google. Coba lagi, atau gunakan mode VPS / Remote jika popup tidak dapat dibuka."
            action={
              <Button variant="primary" icon={RefreshCw} onClick={resetFlow}>
                Mulai Ulang
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}
