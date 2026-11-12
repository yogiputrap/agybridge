import {
  Activity,
  BarChart3,
  ExternalLink,
  Info,
  Layers,
  Plug,
  RefreshCw,
  Repeat,
  Scissors,
  Server,
  Shield,
  Smartphone,
  Snowflake,
} from "lucide-react";
import Logo from "../components/Logo";
import { Badge, Button, Card, CardHeader, CopyButton, InfoRow } from "../components/ui";
import { getBasePath } from "../basePath.js";

const FEATURES = [
  { icon: Layers, title: "Kompatibilitas Multi-Format", text: "Mendukung format OpenAI, Gemini, dan Claude." },
  { icon: Repeat, title: "Rotasi Cerdas", text: "Penyeimbangan beban otomatis dengan isolasi akun yang terkena limit." },
  { icon: Shield, title: "Proteksi Otomatis", text: "Mendeteksi error kritis dan menonaktifkan kredensial bermasalah." },
  { icon: Snowflake, title: "Cooldown Tingkat Model", text: "Menangani error 429 secara independen per keluarga model." },
  { icon: Scissors, title: "Anti-Pemotongan Respons", text: "Mencegah teks terpotong di tengah jalan pada respon panjang." },
  { icon: BarChart3, title: "Log & Metrik Real-time", text: "Pelacakan token, latensi, dan histori panggilan API lengkap." },
  { icon: Smartphone, title: "Desain Responsif", text: "Tampilan optimal di perangkat desktop maupun seluler." },
];

export default function About({ version, onCheckUpdate, checkingUpdate }) {
  const apiBase = `${window.location.origin}${getBasePath()}`;
  const apiEndpoints = [
    { label: "Format OpenAI", value: `${apiBase}v1/chat/completions` },
    { label: "Format Gemini", value: `${apiBase}v1beta/models` },
    { label: "Format Claude", value: `${apiBase}v1/messages` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ringkasan proyek */}
        <Card>
          <div className="flex items-center gap-4 mb-4">
            <span className="w-14 h-14 shrink-0 rounded-2xl bg-purple-600/10 flex items-center justify-center">
              <Logo size={32} />
            </span>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold text-ink tracking-tight">AGYBridge</h2>
              <p className="text-sm text-gray-400 break-words">
                {version?.version ? `Versi ${version.version}` : "Layanan Proksi Gateway API"}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            Gateway proksi berkinerja tinggi untuk menjembatani Google Antigravity ke antarmuka standar OpenAI,
            Gemini, dan Anthropic Claude. Dilengkapi sistem manajemen multi-akun, rotasi beban otomatis,
            pencegahan batas laju (rate-limit cooldown), dan pemantauan penggunaan kuota secara real-time.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <Button variant="primary" icon={RefreshCw} onClick={onCheckUpdate} loading={checkingUpdate}>
              {checkingUpdate ? "Memeriksa..." : "Periksa Pembaruan"}
            </Button>
            {version?.check_update && version?.has_update && (
              <Badge tone="success" icon={Info}>Versi baru tersedia: {version.latest_version}</Badge>
            )}
            {version?.check_update && version?.has_update === false && (
              <Badge tone="neutral" icon={Info}>Sistem menggunakan versi terbaru</Badge>
            )}
          </div>
        </Card>

        {/* Informasi sistem */}
        <Card>
          <CardHeader icon={Server} title="Informasi Sistem" subtitle="Detail build yang sedang berjalan" />
          {version ? (
            <div>
              <InfoRow label="Versi Saat Ini">{version.version || "-"}</InfoRow>
              <InfoRow label="Commit Hash">
                <span className="font-mono text-xs break-all">{version.full_hash || "-"}</span>
              </InfoRow>
              <InfoRow label="Status Build">{version.message || "-"}</InfoRow>
              <InfoRow label="Tanggal Rilis">{version.date || "-"}</InfoRow>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Informasi versi belum tersedia.</p>
          )}
        </Card>
      </div>

      {/* Endpoint API */}
      <Card>
        <CardHeader icon={Plug} title="Endpoint API" subtitle="Gunakan salah satu endpoint ini di klien Anda. Tekan Salin untuk menyalin." />
        <div className="space-y-3">
          {apiEndpoints.map((ep) => (
            <div
              key={ep.label}
              className="rounded-2xl bg-dark-800 border border-dark-700/60 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0"
            >
              <span className="text-sm font-medium text-gray-300 sm:w-32 shrink-0">{ep.label}</span>
              <code className="flex-1 min-w-0 text-xs sm:text-sm font-mono text-ink break-all">{ep.value}</code>
              <CopyButton value={ep.value} className="self-start sm:self-center" />
            </div>
          ))}
        </div>
      </Card>

      {/* Fitur unggulan */}
      <Card>
        <CardHeader icon={Activity} title="Fitur Unggulan" subtitle="Yang membuat gateway ini nyaman dipakai" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-dark-800 border border-dark-700/60 p-4 flex gap-3 min-w-0">
              <span className="w-9 h-9 shrink-0 rounded-full bg-purple-600/10 text-purple-500 flex items-center justify-center">
                <Icon size={16} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink break-words">{title}</div>
                <p className="text-sm text-gray-400 mt-0.5 break-words">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Atribusi */}
      <p className="text-center text-xs text-gray-500 pt-2 pb-4 break-words">
        AGYBridge • Fork dari{" "}
        <a
          href="https://github.com/su-kaka/agy2api"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-500 hover:underline inline-flex items-center gap-0.5"
        >
          agy2api <ExternalLink size={11} />
        </a>{" "}
        dengan modernisasi dan peningkatan performa • Lisensi MIT
      </p>
    </div>
  );
}
