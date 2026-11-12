import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  Ban,
  BarChart3,
  Brain,
  Check,
  Copy,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  Link,
  Lock,
  Network,
  Plus,
  RefreshCw,
  Repeat,
  Save,
  ScrollText,
  Search,
  Server,
  Shield,
  ShieldAlert,
  Shuffle,
  Sliders,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/Modal";
import Select from "../components/Select";
import { Button, Card, CardHeader, EmptyState, Field, IconButton, Input, Notice, Spinner, Switch, Tabs } from "../components/ui";
import api from "../api";

function CsvNumbersField({ value, onChange, placeholder, id }) {
  const [text, setText] = useState(() =>
    Array.isArray(value) ? value.join(", ") : ""
  );

  useEffect(() => {
    setText(Array.isArray(value) ? value.join(", ") : "");
  }, [value]);

  const parseToNumbers = (raw) => {
    return raw
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .map(Number)
      .filter((n) => n >= 100 && n <= 599);
  };

  const handleBlur = () => {
    const numbers = parseToNumbers(text);
    onChange(numbers);
    setText(numbers.join(", "));
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    setText(raw);
    onChange(parseToNumbers(raw));
  };

  return (
    <Input
      id={id}
      type="text"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className="font-mono"
    />
  );
}

const cleanLines = (rows) =>
  rows.map((w) => w.replace(/\s+$/, "")).filter((w) => w.trim() !== "");

const toRows = (v) => {
  if (Array.isArray(v)) return v.map((x) => String(x ?? ""));
  if (typeof v === "string" && v !== "") return v.split(/\r?\n/);
  return [];
};

/** One-entry-per-row list editor. Emits the same array of non-empty lines the old textarea did. */
function ListField({ value, onChange, placeholder, addLabel = "Tambah baris", emptyText }) {
  const [rows, setRows] = useState(() => toRows(value));
  const inputRefs = useRef([]);
  const focusIdx = useRef(null);

  useEffect(() => {
    // Re-sync only when the outside value differs from what these rows already represent.
    if (JSON.stringify(cleanLines(rows)) !== JSON.stringify(cleanLines(toRows(value)))) {
      setRows(toRows(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (focusIdx.current != null) {
      inputRefs.current[focusIdx.current]?.focus();
      focusIdx.current = null;
    }
  });

  const commit = (next) => {
    setRows(next);
    onChange(cleanLines(next));
  };

  const update = (idx, text) => commit(rows.map((r, i) => (i === idx ? text : r)));
  const remove = (idx) => commit(rows.filter((_, i) => i !== idx));
  const addAfter = (idx) => {
    const next = [...rows];
    next.splice(idx + 1, 0, "");
    focusIdx.current = idx + 1;
    setRows(next);
  };
  const handlePaste = (idx, e) => {
    const text = e.clipboardData?.getData("text") ?? "";
    if (!/\r?\n/.test(text)) return;
    e.preventDefault();
    const pasted = text.split(/\r?\n/);
    const next = [...rows];
    next.splice(idx, 1, ...pasted.map((p, i) => (i === 0 ? rows[idx] + p : p)));
    commit(next);
  };

  return (
    <div className="space-y-2">
      {rows.length === 0 && emptyText && (
        <div className="rounded-xl bg-dark-800 px-4 py-3 text-sm text-gray-400">{emptyText}</div>
      )}
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            ref={(el) => {
              inputRefs.current[idx] = el;
            }}
            type="text"
            value={row}
            onChange={(e) => update(idx, e.target.value)}
            onPaste={(e) => handlePaste(idx, e)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAfter(idx);
              }
            }}
            onBlur={() => commit(rows)}
            placeholder={placeholder}
            className="flex-1 min-w-0 font-mono"
          />
          <IconButton icon={Trash2} label="Hapus baris" tone="danger" onClick={() => remove(idx)} className="!w-10 !h-10" />
        </div>
      ))}
      <Button size="sm" variant="secondary" icon={Plus} onClick={() => addAfter(rows.length - 1)}>
        {addLabel}
      </Button>
    </div>
  );
}

// 5 Kategori Terstruktur & Bersih
const CATEGORIES = [
  { id: "all", label: "Semua", icon: Sliders },
  { id: "security", label: "Keamanan & Server", icon: Shield },
  { id: "routing", label: "Jaringan & Routing", icon: Network },
  { id: "models", label: "Model & Respons", icon: Cpu },
  { id: "stability", label: "Stabilitas & Retry", icon: RefreshCw },
  { id: "logs", label: "Log & Analitik", icon: BarChart3 },
];

const CONFIG_GROUPS = [
  {
    category: "security",
    title: "Konfigurasi Host & Kunci Akses",
    icon: Server,
    description: "Pengaturan identitas jaringan dan kata sandi otorisasi akses API serta panel.",
    fields: [
      {
        key: "host",
        label: "Host Binding Server",
        type: "text",
        note: "Gunakan 0.0.0.0 untuk mendengarkan seluruh antarmuka jaringan (berlaku setelah restart)",
      },
      {
        key: "port",
        label: "Port Layanan HTTP",
        type: "number",
        note: "Port layanan web dan gateway (berlaku setelah restart)",
      },
      {
        key: "api_password",
        label: "Kunci Akses API (API Password)",
        type: "password_toggle",
        note: "Kunci akses Bearer token untuk endpoint OpenAI, Claude, dan Gemini",
      },
      {
        key: "panel_password",
        label: "Kata Sandi Panel Web",
        type: "password_toggle",
        note: "Kata sandi yang digunakan saat login ke panel dashboard ini",
      },
    ],
  },
  {
    category: "security",
    title: "Whitelist Alamat IP",
    icon: Shield,
    description: "Batasi akses masuk hanya ke alamat IP atau subnet CIDR tepercaya.",
    fields: [
      {
        key: "ip_whitelist_enabled",
        label: "Aktifkan Proteksi Whitelist IP",
        type: "bool",
        note: "Jika diaktifkan, IP di luar daftar akan langsung ditolak (HTTP 403)",
      },
      {
        key: "ip_whitelist",
        label: "Daftar Alamat IP / CIDR yang Diizinkan",
        type: "textarea",
        showIf: (cfg) => !!cfg.ip_whitelist_enabled,
        note: "Satu IP atau CIDR per baris (mendukung IPv4 dan IPv6). Contoh: 127.0.0.1 atau 192.168.1.0/24",
        placeholder: "127.0.0.1\n192.168.1.0/24\n::1",
      },
    ],
  },
  {
    category: "security",
    title: "Filter Kata Sensitif",
    icon: ShieldAlert,
    description: "Cegah kata atau frasa tertentu agar tidak memicu pembatasan upstream.",
    fields: [
      {
        key: "sensitive_words_enabled",
        label: "Aktifkan Filter Kata Sensitif",
        type: "bool",
        note: "Menyaring kata sensitif pada payload pertanyaan sebelum diteruskan",
      },
      {
        key: "sensitive_words",
        label: "Daftar Kata Sensitif",
        type: "textarea",
        showIf: (cfg) => !!cfg.sensitive_words_enabled,
        note: "Satu kata/frasa per baris (tidak membedakan huruf besar/kecil)",
        placeholder: "kata1\nkata2",
      },
    ],
  },
  {
    category: "routing",
    title: "Metode Pemilihan Kredensial (Load Balancing)",
    icon: Shuffle,
    description: "Atur strategi pemilihan akun upstream Google Antigravity untuk setiap request masuk.",
    fields: [
      {
        key: "credential_select_mode",
        label: "Strategi Rotasi Akun",
        type: "select",
        note: "Pilih metode distribusi beban antar akun Google yang terdaftar",
        options: [
          { value: "cache", label: "Pencocokan Cache Hash (Sangat Direkomendasikan)" },
          { value: "random", label: "Acak Seimbang (Random Balance)" },
          { value: "sticky", label: "Kunci Satu Akun (Sticky Mode)" },
        ],
        descriptions: {
          cache: "Cache Hash: Mengelompokkan sesi obrolan yang sama ke kredensial yang sama agar memanfaatkan prompt caching upstream Google secara optimal, menghemat token dan mempercepat respons.",
          random: "Random Balance: Memilih akun aktif secara acak pada setiap request untuk membagi beban secara merata ke seluruh akun.",
          sticky: "Sticky Mode: Mengunci seluruh request ke satu akun sampai akun tersebut terkena cooldown (429) atau dinonaktifkan.",
        },
      },
    ],
  },
  {
    category: "routing",
    title: "Koneksi Proksi & Direktori Kredensial",
    icon: Globe,
    description: "Konfigurasi rute keluar (outbound proxy) dan lokasi penyimpanan akun.",
    fields: [
      {
        key: "credentials_dir",
        label: "Direktori Berkas Kredensial",
        type: "text",
        note: "Lokasi folder penyimpanan kredensial akun JSON di server",
      },
      {
        key: "proxy",
        label: "Proksi Keluar (Outbound Proxy)",
        type: "text",
        note: "Mendukung http/https/socks5/socks5h. Kosongkan jika server terhubung langsung ke internet.",
        placeholder: "http://user:pass@proxy:port atau socks5h://127.0.0.1:1080",
      },
    ],
  },
  {
    category: "routing",
    title: "Konfigurasi Endpoint Upstream Google",
    icon: Link,
    description: "Titik akhir layanan Google APIs dan Antigravity.",
    hasRestoreButton: true,
    fields: [
      {
        key: "oauth_proxy_url",
        label: "Endpoint Google OAuth2",
        type: "text",
        note: "URL endpoint untuk pembuatan dan penyegaran access token",
      },
      {
        key: "googleapis_proxy_url",
        label: "Endpoint Google APIs",
        type: "text",
        note: "URL endpoint upstream Google APIs",
      },
      {
        key: "antigravity_api_url",
        label: "Endpoint API Antigravity",
        type: "text",
        note: "URL endpoint layanan Cloud Code / Antigravity",
      },
    ],
  },
  {
    category: "models",
    title: "Pemetaan Nama Model (Model Rewrite)",
    icon: ArrowLeftRight,
    description: "Aliaskan atau ubah nama model klien ke model upstream yang tersedia secara transparan.",
    fields: [
      {
        key: "model_rewrite_enabled",
        label: "Aktifkan Pemetaan Nama Model",
        type: "bool",
        note: "Memetakan request model dari klien (misal gpt-4o) ke model upstream (misal gemini-3.8-flash-high)",
      },
      {
        key: "model_rewrite_rules",
        label: "Daftar Aturan Regex Pemetaan",
        type: "rules",
        showIf: (cfg) => !!cfg.model_rewrite_enabled,
        note: "Format: Cocokkan Pola Regex → Gantikan dengan Model Target Upstream",
      },
    ],
  },
  {
    category: "models",
    title: "Perilaku Respons & Anti-Pemotongan",
    icon: Brain,
    description: "Pengaturan pemrosesan token penalaran dan perpanjangan respons teks panjang.",
    fields: [
      {
        key: "return_thoughts_to_frontend",
        label: "Kirim Reasoning / Thinking Process ke Klien",
        type: "bool",
        note: "Jika aktif, proses berpikir internal model disertakan pada output reasoning",
      },
      {
        key: "anti_truncation_max_attempts",
        label: "Batas Maksimal Percobaan Sambung Teks (Anti-Truncate)",
        type: "number",
        note: "Batas pengulangan penyambungan otomatis jika jawaban terpotong batas token (1 - 10)",
      },
    ],
  },
  {
    category: "stability",
    title: "Percobaan Ulang Otomatis (Retry 429)",
    icon: Repeat,
    description: "Penanganan otomatis saat menghadapi batas laju request (Rate Limit) dari Google.",
    fields: [
      {
        key: "retry_429_enabled",
        label: "Aktifkan Retry Otomatis pada HTTP 429",
        type: "bool",
        note: "Otomatis mengulangi permintaan jika terkena pembatasan laju",
      },
      {
        key: "retry_429_max_retries",
        label: "Maksimal Percobaan Pengulangan",
        type: "number",
        note: "Jumlah pengulangan maksimal sebelum mengembalikan error ke klien (1 - 10)",
      },
      {
        key: "retry_429_interval",
        label: "Jeda Waktu Antar Percobaan (Detik)",
        type: "number",
        note: "Waktu tunggu sebelum mencoba akun berikutnya (0 untuk langsung)",
      },
    ],
  },
  {
    category: "stability",
    title: "Pemblokiran Akun Otomatis (Auto-Ban)",
    icon: Ban,
    description: "Lindungi rotasi dari akun yang sudah tidak valid atau diblokir.",
    fields: [
      {
        key: "auto_ban_enabled",
        label: "Aktifkan Auto-Ban Otomatis",
        type: "bool",
        note: "Otomatis menonaktifkan kredensial jika terus-menerus mengembalikan kode error kritis",
      },
      {
        key: "auto_ban_error_codes",
        label: "Daftar Kode Status Error Pemicu Auto-Ban",
        type: "text",
        note: "Format array JSON kode error, contoh: [403, 400]",
      },
    ],
  },
  {
    category: "logs",
    title: "Pencatatan Riwayat & Debugging",
    icon: ScrollText,
    description: "Pantau penggunaan token, waktu respons, dan payload permintaan untuk audit.",
    fields: [
      {
        key: "usage_log_enabled",
        label: "Aktifkan Pencatatan Riwayat Permintaan (Usage Logs)",
        type: "bool",
        note: "Mencatat timestamp, nama model, jumlah token, dan durasi ke database SQLite",
      },
      {
        key: "request_log_enabled",
        label: "Rekam Rinci Body Permintaan saat Terjadi Error",
        type: "bool",
        note: "Berguna untuk investigasi dan debugging saat terjadi kegagalan pemanggilan API",
      },
      {
        key: "request_log_error_codes",
        label: "Kode Status Error yang Direkam Rinci",
        type: "csv_numbers",
        showIf: (cfg) => !!cfg.request_log_enabled,
        note: "Pisahkan dengan koma kode status HTTP (contoh: 400, 429)",
        placeholder: "400, 429",
      },
    ],
  },
];

const GROUP_ICON_FALLBACK = Sliders;
const WIDE_TYPES = ["bool", "textarea", "rules", "select"];

export default function Config() {
  const [config, setConfig] = useState({});
  const [envLocked, setEnvLocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPasswords, setShowPasswords] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async ({ silent = false } = {}) => {
    setLoading(true);
    try {
      const res = await api.get("/config/get");
      setConfig(res.data.config || {});
      setEnvLocked(res.data.env_locked || []);
      if (!silent) setMessage(null);
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.detail || "Gagal memuat konfigurasi server",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await api.post("/config/save", { config });
      setMessage({
        type: "success",
        text: res.data.message || "Pengaturan berhasil diperbarui dan disimpan",
      });
      await loadConfig({ silent: true });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.detail || "Gagal menyimpan perubahan pengaturan",
      });
    } finally {
      setSaving(false);
    }
  };

  const setField = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const togglePasswordVisibility = (key) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyValue = async (text, key) => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
    } catch {
      /* clipboard unavailable (insecure context): the text stays selectable */
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const OFFICIAL_ENDPOINTS = {
    oauth_proxy_url: "https://oauth2.googleapis.com",
    googleapis_proxy_url: "https://www.googleapis.com",
    antigravity_api_url: "https://daily-cloudcode-pa.googleapis.com",
  };

  const restoreOfficialUrls = () => {
    setConfig((prev) => {
      const next = { ...prev };
      for (const [key, url] of Object.entries(OFFICIAL_ENDPOINTS)) {
        if (!envLocked.includes(key)) next[key] = url;
      }
      return next;
    });
  };

  // Filter kelompok berdasarkan kategori aktif dan pencarian
  const filteredGroups = useMemo(() => {
    let groups = CONFIG_GROUPS;
    if (activeCategory !== "all") {
      groups = groups.filter((g) => g.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      groups = groups
        .map((g) => {
          const matchedFields = g.fields.filter(
            (f) =>
              f.label.toLowerCase().includes(q) ||
              f.key.toLowerCase().includes(q) ||
              (f.note && f.note.toLowerCase().includes(q))
          );
          if (
            g.title.toLowerCase().includes(q) ||
            g.description?.toLowerCase().includes(q) ||
            matchedFields.length > 0
          ) {
            return { ...g, fields: matchedFields.length > 0 ? matchedFields : g.fields };
          }
          return null;
        })
        .filter(Boolean);
    }
    return groups;
  }, [activeCategory, searchQuery]);

  const renderControl = (field) => {
    const value = config[field.key] ?? "";
    const id = `cfg-${field.key}`;

    if (field.type === "password_toggle") {
      const isVisible = !!showPasswords[field.key];
      return (
        <div className="flex items-center gap-2 min-w-0">
          <Input
            id={id}
            type={isVisible ? "text" : "password"}
            value={value}
            onChange={(e) => setField(field.key, e.target.value)}
            className="flex-1 min-w-0 font-mono"
          />
          <IconButton
            icon={isVisible ? EyeOff : Eye}
            label={isVisible ? "Sembunyikan" : "Tampilkan"}
            onClick={() => togglePasswordVisibility(field.key)}
            className="!w-10 !h-10"
          />
          <IconButton
            icon={copiedKey === field.key ? Check : Copy}
            label="Salin nilai"
            tone={copiedKey === field.key ? "accent" : "default"}
            onClick={() => copyValue(value, field.key)}
            className="!w-10 !h-10"
          />
        </div>
      );
    }

    if (field.type === "select") {
      const current = field.options.find((o) => o.value === value) || field.options[0];
      return (
        <div className="space-y-3 min-w-0">
          <Select
            value={current?.value ?? ""}
            onChange={(v) => setField(field.key, v)}
            options={field.options}
            className="w-full"
          />
          {field.descriptions && current && (
            <Notice tone="info" title="Penjelasan">
              {field.descriptions[current.value]}
            </Notice>
          )}
        </div>
      );
    }

    if (field.type === "csv_numbers") {
      return (
        <CsvNumbersField
          id={id}
          value={value}
          onChange={(v) => setField(field.key, v)}
          placeholder={field.placeholder}
        />
      );
    }

    if (field.type === "rules") {
      const rules = Array.isArray(value)
        ? value.map((r) => (Array.isArray(r) ? [String(r[0] ?? ""), String(r[1] ?? "")] : ["", ""]))
        : [];
      const updateRule = (idx, col, val) => {
        const next = rules.map((r) => [...r]);
        next[idx][col] = val;
        setField(field.key, next);
      };
      const removeRule = (idx) => {
        setField(field.key, rules.filter((_, i) => i !== idx));
      };
      const addRule = () => {
        setField(field.key, [...rules, ["", ""]]);
      };
      return (
        <div className="space-y-2 min-w-0">
          {rules.length === 0 && (
            <div className="rounded-xl bg-dark-800 px-4 py-3 text-sm text-gray-400">
              Belum ada aturan pemetaan. Klik tombol di bawah untuk menambah pemetaan nama model kustom.
            </div>
          )}
          {rules.map((rule, idx) => (
            <div key={idx} className="flex items-center gap-2 min-w-0">
              <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <Input
                  type="text"
                  value={rule[0]}
                  onChange={(e) => updateRule(idx, 0, e.target.value)}
                  placeholder="Pola Regex Klien (cth: ^gpt-4o$)"
                  aria-label="Pola regex klien"
                  className="font-mono"
                />
                <ArrowRight size={16} className="hidden sm:block text-gray-500" />
                <ArrowDown size={16} className="sm:hidden text-gray-500 mx-auto" />
                <Input
                  type="text"
                  value={rule[1]}
                  onChange={(e) => updateRule(idx, 1, e.target.value)}
                  placeholder="Model Target (cth: gemini-3.8-flash-high)"
                  aria-label="Model target upstream"
                  className="font-mono"
                />
              </div>
              <IconButton icon={Trash2} label="Hapus aturan ini" tone="danger" onClick={() => removeRule(idx)} className="!w-10 !h-10" />
            </div>
          ))}
          <Button size="sm" variant="secondary" icon={Plus} onClick={addRule}>
            Tambah Aturan Pemetaan
          </Button>
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <ListField
          value={value}
          onChange={(v) => setField(field.key, v)}
          placeholder={field.placeholder}
          addLabel={field.key === "ip_whitelist" ? "Tambah IP / CIDR" : "Tambah kata"}
          emptyText={field.key === "ip_whitelist" ? "Belum ada alamat IP. Tambahkan satu per baris." : "Belum ada kata sensitif. Tambahkan satu per baris."}
        />
      );
    }

    return (
      <Input
        id={id}
        type={field.type}
        value={value}
        onChange={(e) =>
          setField(
            field.key,
            field.type === "number" ? Number(e.target.value) : e.target.value
          )
        }
        placeholder={field.placeholder}
      />
    );
  };

  const renderField = (field) => {
    const isLocked = envLocked.includes(field.key);
    const wide = WIDE_TYPES.includes(field.type);
    const id = `cfg-${field.key}`;
    const span = wide ? "md:col-span-2" : "";

    if (field.type === "bool" && !isLocked) {
      const value = !!config[field.key];
      return (
        <div key={field.key} className={`${span} flex items-center justify-between gap-4 rounded-2xl bg-dark-800 px-4 py-3 min-w-0`}>
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink break-words">{field.label}</div>
            {field.note && <p className="mt-0.5 text-xs text-gray-500 break-words">{field.note}</p>}
          </div>
          <Switch
            id={id}
            checked={value}
            onChange={(v) => setField(field.key, v)}
            label={value ? "Aktif" : "Nonaktif"}
          />
        </div>
      );
    }

    return (
      <Field
        key={field.key}
        label={field.label}
        htmlFor={id}
        hint={field.note}
        className={span}
      >
        {isLocked ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <Lock size={14} className="shrink-0" />
            <span className="min-w-0 break-words">Nilai ini dikunci melalui variabel lingkungan (.env / OS).</span>
          </div>
        ) : (
          renderControl(field)
        )}
      </Field>
    );
  };

  return (
    <div className="space-y-4">
      {/* Bar atas: pencarian, kategori, aksi */}
      <Card className="!p-4 sm:!p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pengaturan..."
              aria-label="Cari pengaturan"
              className="!pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button icon={RefreshCw} loading={loading} disabled={loading || saving} onClick={() => loadConfig()}>
              Segarkan
            </Button>
            <Button variant="primary" icon={Save} loading={saving} disabled={saving || loading} onClick={saveConfig}>
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </div>
        <Tabs
          tabs={CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon }))}
          value={activeCategory}
          onChange={setActiveCategory}
        />
      </Card>

      {/* Modal Notifikasi */}
      {message && (
        <Modal
          type={message.type}
          title={message.type === "success" ? "Berhasil Disimpan" : "Gagal Memperbarui"}
          onClose={() => setMessage(null)}
        >
          <span className="whitespace-pre-wrap break-all text-sm">{message.text}</span>
        </Modal>
      )}

      {loading ? (
        <Card className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <Spinner size={30} />
          <p className="text-sm">Memuat pengaturan dari database...</p>
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="Pengaturan tidak ditemukan"
            hint={searchQuery.trim() ? `Tidak ada pengaturan yang cocok dengan kata kunci "${searchQuery}".` : "Tidak ada pengaturan pada kategori ini."}
            action={
              <Button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                }}
              >
                Reset Filter Pencarian
              </Button>
            }
          />
        </Card>
      ) : (
        filteredGroups.map((group) => (
          <Card key={group.title}>
            <CardHeader
              icon={group.icon || GROUP_ICON_FALLBACK}
              title={group.title}
              subtitle={group.description}
              action={
                group.hasRestoreButton && (
                  <Button size="sm" icon={RefreshCw} onClick={restoreOfficialUrls}>
                    Kembalikan Endpoint Resmi
                  </Button>
                )
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">
              {group.fields.filter((field) => !field.showIf || field.showIf(config)).map(renderField)}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
