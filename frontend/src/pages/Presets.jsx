import {
  Check,
  Code2,
  Copy,
  Cpu,
  Download,
  Eye,
  EyeOff,
  Globe,
  Layers,
  RefreshCw,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import api from "../api";
import Select from "../components/Select";
import { Button, Card, CardHeader, CodeBlock, IconButton, Input, Notice, Spinner, Switch, Tabs } from "../components/ui";

/** Numbered setup steps as tidy rows with round number chips. */
function Steps({ items }) {
  return (
    <ol className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
      {items.map((step, i) => (
        <li key={step.title} className="min-w-0 flex items-start gap-3 rounded-2xl bg-dark-800 border border-dark-700/60 p-4">
          <span className="w-7 h-7 shrink-0 rounded-full bg-purple-600 text-white text-xs font-semibold flex items-center justify-center">
            {i + 1}
          </span>
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-semibold text-ink break-words">{step.title}</div>
            <p className="text-sm text-gray-400 break-words">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A labelled snippet: caption + optional action on top, CodeBlock below. */
function Snippet({ label, action, children, maxHeight = 340, className = "" }) {
  return (
    <div className={`min-w-0 space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
        <div className="text-sm text-gray-300 min-w-0 break-words">{label}</div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      <CodeBlock maxHeight={maxHeight}>{children}</CodeBlock>
    </div>
  );
}

function Kbd({ children }) {
  return <kbd className="px-1.5 py-0.5 rounded-md bg-dark-700 text-gray-300 text-xs font-mono">{children}</kbd>;
}

function Code({ children, className = "" }) {
  return <code className={`font-mono text-xs break-all text-purple-500 ${className}`}>{children}</code>;
}

export default function Presets() {
  const [loading, setLoading] = useState(true);
  const [configData, setConfigData] = useState({
    api_password: "",
    port: 7861,
    host: "0.0.0.0",
    default_local_base_url: "http://127.0.0.1:7861/",
    models: [],
  });

  const [activeAgent, setActiveAgent] = useState("cursor");
  const [urlMode, setUrlMode] = useState("local"); // 'local' | 'origin' | 'custom'
  const [customUrl, setCustomUrl] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-3.8-flash-high");
  const [showPassword, setShowPassword] = useState(false);
  const [enableCaveman, setEnableCaveman] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const fetchPresetsConfig = async () => {
    setLoading(true);
    try {
      const res = await api.get("/config/presets");
      setConfigData(res.data);
      if (res.data.models && res.data.models.length > 0) {
        setSelectedModel(res.data.models[0].id);
      }
    } catch (err) {
      console.error("Gagal memuat preset konfigurasi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresetsConfig();
  }, []);

  const apiKey = configData.api_password || "sk-";

  // Calculate Base URL
  const baseUrl = useMemo(() => {
    let raw = "";
    if (urlMode === "local") {
      raw = configData.default_local_base_url || `http://127.0.0.1:${configData.port || 7861}/`;
    } else if (urlMode === "origin") {
      raw = `${window.location.protocol}//${window.location.host}/`;
    } else {
      raw = customUrl.trim() || `http://127.0.0.1:${configData.port || 7861}/`;
    }
    return raw.endsWith("/") ? raw : `${raw}/`;
  }, [urlMode, customUrl, configData]);

  const v1Url = `${baseUrl}v1`;

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadFile = (filename, content, mime = "text/plain") => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Agent tabs list
  const agents = [
    { id: "cursor", name: "Cursor", badge: "Populer", icon: Code2 },
    { id: "claude-code", name: "Claude Code", badge: "CLI Pro", icon: Terminal },
    { id: "cline", name: "Cline / Roo Code", badge: "VS Code", icon: Layers },
    { id: "continue", name: "Continue.dev", badge: "Open Source", icon: Cpu },
    { id: "aider-sdk", name: "Aider & SDK", badge: "Multi-Tool", icon: Sparkles },
  ];

  // Templates generation
  const cursorRulesContent = `# Cursor Rules - AGYBridge Integration
# Model: ${selectedModel}
# Endpoint: ${v1Url}

You are an expert AI software engineer connected via AGYBridge.
- Code style: Modern, concise, and clean.
- Always write high-quality code with proper error handling.
${enableCaveman ? "- Mode Caveman: Kompres jawaban, hemat token, langsung beri solusi kode tanpa basa-basi berlebih." : ""}
`;

  const cursorSettingsJson = JSON.stringify(
    {
      "cursor.general.customOpenAIBaseUrl": v1Url,
      "cursor.general.customOpenAIKey": apiKey,
      "cursor.general.defaultModel": selectedModel,
    },
    null,
    2
  );

  const claudeCodeBash = `# Setup Claude Code CLI dengan AGYBridge
export ANTHROPIC_BASE_URL="${v1Url}"
export ANTHROPIC_AUTH_TOKEN="${apiKey}"
export CLAUDE_MODEL="${selectedModel}"

# Jalankan Claude Code di terminal proyek Anda
claude
`;

  const claudeCodePowerShell = `# Setup Claude Code di Windows PowerShell
$env:ANTHROPIC_BASE_URL="${v1Url}"
$env:ANTHROPIC_AUTH_TOKEN="${apiKey}"
$env:CLAUDE_MODEL="${selectedModel}"

# Jalankan Claude Code
claude
`;

  const clineSettingsJson = JSON.stringify(
    {
      "apiProvider": "openai-native",
      "openAiBaseUrl": v1Url,
      "openAiApiKey": apiKey,
      "openAiModelId": selectedModel,
      "customModelId": selectedModel,
    },
    null,
    2
  );

  const continueConfigJson = JSON.stringify(
    {
      "models": [
        {
          "title": `AGYBridge - ${selectedModel}`,
          "provider": "openai",
          "model": selectedModel,
          "apiKey": apiKey,
          "apiBase": v1Url,
        },
        {
          "title": "AGYBridge - Claude Sonnet 4.6",
          "provider": "openai",
          "model": "claude-sonnet-4-6",
          "apiKey": apiKey,
          "apiBase": v1Url,
        },
        {
          "title": "AGYBridge - Gemini 3.8 Flash High",
          "provider": "openai",
          "model": "gemini-3.8-flash-high",
          "apiKey": apiKey,
          "apiBase": v1Url,
        },
      ],
      "tabAutocompleteModel": {
        "title": "AGYBridge Autocomplete",
        "provider": "openai",
        "model": "gemini-3.8-flash-high",
        "apiKey": apiKey,
        "apiBase": v1Url,
      },
    },
    null,
    2
  );

  const aiderCommand = `aider --openai-api-base "${v1Url}" --openai-api-key "${apiKey}" --model "openai/${selectedModel}"`;

  const pythonSdkSnippet = `from openai import OpenAI

# Inisialisasi klien OpenAI yang diarahkan ke AGYBridge
client = OpenAI(
    base_url="${v1Url}",
    api_key="${apiKey}"
)

response = client.chat.completions.create(
    model="${selectedModel}",
    messages=[
        {"role": "system", "content": "Anda adalah asisten AI yang cerdas dan solutif.${enableCaveman ? ' Mode Caveman: berikan jawaban ringkas & padat.' : ''}"},
        {"role": "user", "content": "Halo! Tuliskan contoh fungsi Python untuk parsing JSON."}
    ],
    temperature=0.7
)

print(response.choices[0].message.content)
`;

  const curlSnippet = `curl -X POST "${v1Url}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "${selectedModel}",
    "messages": [
      {"role": "user", "content": "Halo AGYBridge!"}
    ]
  }'`;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
        <Spinner size={32} className="text-purple-500" />
        <p className="text-sm">Memuat preset konfigurasi agent...</p>
      </div>
    );
  }

  const copyBtn = (text, key, label, variant = "secondary") => (
    <Button size="sm" variant={variant} onClick={() => copyToClipboard(text, key)} icon={copiedKey === key ? Check : Copy}>
      {label}
    </Button>
  );
  const downloadBtn = (filename, content, label) => (
    <Button size="sm" variant="primary" onClick={() => downloadFile(filename, content)} icon={Download}>
      {label}
    </Button>
  );

  const URL_MODES = [
    { id: "local", title: "Local (127.0.0.1)", hint: "Satu PC / VPS lokal" },
    { id: "origin", title: `Web Host (${window.location.hostname})`, hint: "Akses remote / IP publik" },
    { id: "custom", title: "Kustom", hint: "Domain atau IP sendiri" },
  ];

  const modelOptions = (configData.models || []).map((m) => ({ value: m.id, label: `${m.name} (${m.badge})` }));

  return (
    <div className="space-y-4">
      {/* Pengaturan global */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="!p-5 space-y-4">
          <CardHeader className="!mb-0" icon={Globe} title="Target Base URL" subtitle="Alamat endpoint untuk agent" />
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Target Base URL">
            {URL_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={urlMode === m.id}
                onClick={() => setUrlMode(m.id)}
                title={m.hint}
                className={`h-10 px-4 max-w-full rounded-full text-sm font-medium border transition-colors truncate ${
                  urlMode === m.id
                    ? "bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "bg-dark-800 border-dark-700 text-gray-400 hover:text-ink"
                }`}
              >
                {m.title}
              </button>
            ))}
          </div>
          {urlMode === "custom" && (
            <Input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="http://domain-atau-ip:7861/"
            />
          )}
          <p className="text-xs text-gray-500 break-all" title={baseUrl}>
            {baseUrl}
          </p>
        </Card>

        <Card className="!p-5 space-y-4">
          <CardHeader
            className="!mb-0"
            icon={Sparkles}
            title="API Key"
            subtitle="Kata sandi API"
            action={
              <Button size="sm" variant="secondary" onClick={fetchPresetsConfig} icon={RefreshCw}>
                Segarkan Kunci
              </Button>
            }
          />
          <div className="flex items-center gap-2 min-w-0">
            <Input
              type={showPassword ? "text" : "password"}
              readOnly
              value={apiKey}
              className="min-w-0 flex-1 font-mono text-purple-500 select-all"
            />
            <IconButton
              icon={showPassword ? EyeOff : Eye}
              label={showPassword ? "Sembunyikan" : "Tampilkan"}
              onClick={() => setShowPassword(!showPassword)}
            />
            <IconButton
              icon={copiedKey === "apiKey" ? Check : Copy}
              label="Salin API Key"
              tone={copiedKey === "apiKey" ? "accent" : "default"}
              onClick={() => copyToClipboard(apiKey, "apiKey")}
            />
          </div>
        </Card>

        <Card className="!p-5 space-y-4">
          <CardHeader className="!mb-0" icon={Cpu} title="Model Utama" subtitle="Auto-Failover" />
          <Select value={selectedModel} onChange={setSelectedModel} options={modelOptions} />
          <Switch
            checked={enableCaveman}
            onChange={setEnableCaveman}
            label={
              <>
                Aktifkan instruksi <strong>Caveman</strong> (Hemat token)
              </>
            }
          />
        </Card>
      </div>

      {/* Pemilih agent */}
      <Tabs
        tabs={agents.map((a) => ({ id: a.id, label: a.name, icon: a.icon, badge: a.badge }))}
        value={activeAgent}
        onChange={setActiveAgent}
      />

      {/* Konten agent */}
      {activeAgent === "cursor" && (
        <Card>
          <CardHeader
            icon={Code2}
            title="Konfigurasi Cursor IDE"
            subtitle="Gunakan AGYBridge sebagai OpenAI-compatible provider kustom di Cursor."
            action={
              <>
                {copyBtn(cursorRulesContent, "cursorRules", "Salin .cursorrules")}
                {downloadBtn(".cursorrules", cursorRulesContent, "Unduh .cursorrules")}
              </>
            }
          />
          <Steps
            items={[
              {
                title: "Buka Settings Cursor",
                body: (
                  <>
                    Tekan <Kbd>Ctrl/Cmd + Shift + J</Kbd> lalu pilih tab <strong>Models</strong>.
                  </>
                ),
              },
              {
                title: "Override OpenAI Base URL",
                body: (
                  <>
                    Aktifkan <strong>OpenAI API Key</strong>, masukkan Base URL: <Code className="block mt-1">{v1Url}</Code>
                  </>
                ),
              },
              {
                title: "Tambah Model Kustom",
                body: (
                  <>
                    Tambahkan nama model: <Code className="!text-emerald-600 dark:!text-emerald-400">{selectedModel}</Code> atau
                    model lainnya.
                  </>
                ),
              },
            ]}
          />
          <div className="space-y-5">
            <Snippet
              label={
                <>
                  Pratinjau berkas <code>.cursorrules</code> (simpan di root project):
                </>
              }
            >
              {cursorRulesContent}
            </Snippet>
            <Snippet
              label={
                <>
                  Konfigurasi <code>.cursor/settings.json</code> atau <code>settings.json</code>:
                </>
              }
              action={copyBtn(cursorSettingsJson, "cursorSettings", "Salin JSON")}
            >
              {cursorSettingsJson}
            </Snippet>
          </div>
        </Card>
      )}

      {activeAgent === "claude-code" && (
        <Card>
          <CardHeader
            icon={Terminal}
            title="Anthropic Claude Code CLI"
            subtitle="Hubungkan CLI resmi Claude Code ke AGYBridge menggunakan variabel lingkungan."
            action={
              <>
                {copyBtn(claudeCodeBash, "claudeBash", "Salin Bash")}
                {downloadBtn(".env.claude", claudeCodeBash, "Unduh .env.claude")}
              </>
            }
          />
          <div className="space-y-5">
            <Snippet label={<span className="font-semibold">Linux / macOS / Git Bash:</span>}>{claudeCodeBash}</Snippet>
            <Snippet
              label={<span className="font-semibold">Windows PowerShell:</span>}
              action={copyBtn(claudeCodePowerShell, "claudePs", "Salin PowerShell")}
            >
              {claudeCodePowerShell}
            </Snippet>
            <Notice tone="info" icon={Sparkles}>
              <strong>Tips Claude Code:</strong> Anda dapat menggunakan model <code>claude-sonnet-4-6</code> atau{" "}
              <code>gemini-3.8-flash-high</code>. AGYBridge secara transparan menerjemahkan format request dan response
              sehingga semua fitur Claude Code CLI berjalan mulus.
            </Notice>
          </div>
        </Card>
      )}

      {activeAgent === "cline" && (
        <Card>
          <CardHeader
            icon={Layers}
            title="Cline & Roo Code (VS Code Extension)"
            subtitle="Ekstensi autonomous coding agent terbaik untuk Visual Studio Code."
            action={
              <>
                {copyBtn(clineSettingsJson, "clineSettings", "Salin Pengaturan")}
                {downloadBtn("cline_settings.json", clineSettingsJson, "Unduh JSON")}
              </>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {[
              { label: "API Provider", value: "OpenAI-Compatible" },
              { label: "Base URL", value: v1Url, mono: true },
              { label: "API Key", value: showPassword ? apiKey : "••••••••••••••••", mono: true },
              { label: "Model ID", value: selectedModel, mono: true },
            ].map((row) => (
              <div key={row.label} className="min-w-0 rounded-2xl bg-dark-800 border border-dark-700/60 px-4 py-3">
                <div className="text-xs text-gray-500 mb-1">{row.label}:</div>
                <div className={`text-sm font-semibold text-ink break-all ${row.mono ? "font-mono" : ""}`}>{row.value}</div>
              </div>
            ))}
          </div>
          <Snippet label="Nilai konfigurasi siap tempel:">{clineSettingsJson}</Snippet>
        </Card>
      )}

      {activeAgent === "continue" && (
        <Card>
          <CardHeader
            icon={Cpu}
            title="Continue.dev (VS Code & JetBrains)"
            subtitle="Asisten AI open source untuk autocomplete dan chat di editor favorit Anda."
            action={
              <>
                {copyBtn(continueConfigJson, "continueConfig", "Salin config.json")}
                {downloadBtn("config.json", continueConfigJson, "Unduh config.json")}
              </>
            }
          />
          <div className="space-y-4">
            <Notice tone="info">
              Lokasi berkas: Simpan atau gabungkan ke <code>~/.continue/config.json</code> di komputer lokal Anda.
            </Notice>
            <CodeBlock maxHeight={380}>{continueConfigJson}</CodeBlock>
          </div>
        </Card>
      )}

      {activeAgent === "aider-sdk" && (
        <Card>
          <CardHeader
            icon={Sparkles}
            title="Aider & SDK"
            subtitle="Aider AI Pair Programming, Python (OpenAI SDK) dan cURL langsung."
          />
          <div className="space-y-6">
            <Snippet
              label={<span className="font-semibold text-ink">Aider AI Pair Programming</span>}
              action={copyBtn(aiderCommand, "aiderCmd", "Salin Perintah")}
              maxHeight={200}
            >
              {aiderCommand}
            </Snippet>
            <Snippet
              className="pt-6 border-t border-dark-700/60"
              label={<span className="font-semibold text-ink">Python (OpenAI SDK)</span>}
              action={
                <>
                  {copyBtn(pythonSdkSnippet, "pySdk", "Salin Kode Python")}
                  {downloadBtn("test_agybridge.py", pythonSdkSnippet, "Unduh .py")}
                </>
              }
            >
              {pythonSdkSnippet}
            </Snippet>
            <Snippet
              className="pt-6 border-t border-dark-700/60"
              label={<span className="font-semibold text-ink">Direct cURL Request</span>}
              action={copyBtn(curlSnippet, "curlCmd", "Salin cURL")}
            >
              {curlSnippet}
            </Snippet>
          </div>
        </Card>
      )}
    </div>
  );
}
