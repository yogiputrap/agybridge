import {
    LogOut,
    Rocket,
    Settings,
    KeyRound,
    Upload,
    Info,
    BarChart3,
    Terminal,
    FlaskConical,
    LayoutDashboard,
    Sun,
    Moon,
    ChevronDown,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Logo from "./components/Logo";
import api from "./api";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import OAuth from "./pages/OAuth";
import Presets from "./pages/Presets";
import Credentials from "./pages/Credentials";
import UploadPage from "./pages/Upload";
import Config from "./pages/Config";
import About from "./pages/About";
import UsageLogs from "./pages/UsageLogs";
import Playground from "./pages/Playground";

const TABS = [
  { id: "overview", label: "Ringkasan", icon: LayoutDashboard, hint: "Pantau kesehatan bridge, kredensial, dan aktivitas terbaru." },
  { id: "oauth", label: "OAuth", icon: Rocket, hint: "Hubungkan akun Google untuk menambah kredensial." },
  { id: "presets", label: "Preset", icon: Terminal, hint: "Konfigurasi siap pakai untuk coding agent." },
  { id: "credentials", label: "Kredensial", icon: KeyRound, hint: "Kelola, uji, dan pantau kuota setiap akun." },
  { id: "upload", label: "Impor", icon: Upload, hint: "Impor kredensial secara massal dari berkas." },
  { id: "playground", label: "Playground", icon: FlaskConical, hint: "Coba chat dan uji semua model yang tersedia." },
  { id: "usage-logs", label: "Log", icon: BarChart3, hint: "Riwayat permintaan, token, dan latensi." },
  { id: "config", label: "Pengaturan", icon: Settings, hint: "Atur retry, filter, proxy, dan keamanan." },
  { id: "about", label: "Tentang", icon: Info, hint: "Versi dan informasi proyek." },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = (next) => {
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* private mode: theme just won't persist */
    }
  };
  return [dark, toggle];
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => !!localStorage.getItem("panelToken"));
  const [activeTab, setActiveTab] = useState("overview");
  const [version, setVersion] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useTheme();
  const menuRef = useRef(null);

  const checkUpdate = () => {
    setCheckingUpdate(true);
    api
      .get("/version/info", { params: { check_update: "true" } })
      .then((res) => setVersion(res.data))
      .catch(() => {})
      .finally(() => setCheckingUpdate(false));
  };

  useEffect(() => {
    api
      .get("/version/info")
      .then((res) => setVersion(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const logout = () => {
    localStorage.removeItem("panelToken");
    setLoggedIn(false);
  };

  if (!loggedIn) {
    return <Login onSuccess={() => setLoggedIn(true)} />;
  }

  const current = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <div className="min-h-screen">
      {/* Top bar: brand pill, centered pill navigation, user chip */}
      <header className="sticky top-0 z-20 px-3 sm:px-5 pt-3 pb-2 bg-dark-950/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="float-pill rounded-full flex items-center gap-2.5 pl-2 pr-4 py-1.5 shrink-0">
            <div className="w-9 h-9 rounded-full bg-purple-600/10 flex items-center justify-center">
              <Logo size={22} />
            </div>
            <span className="text-lg font-bold tracking-tight text-ink">AGYBridge</span>
          </div>

          <nav className="float-pill rounded-full p-1.5 mx-auto min-w-0 hidden md:flex items-center gap-0.5 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 lg:px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "text-gray-400 hover:text-ink hover:bg-dark-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div ref={menuRef} className="relative ml-auto md:ml-0 shrink-0">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="float-pill rounded-full flex items-center gap-2.5 pl-1.5 pr-3 py-1.5"
            >
              <span className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-white font-semibold flex items-center justify-center text-sm">
                A
              </span>
              <span className="hidden sm:block text-left leading-tight">
                <span className="block text-sm font-semibold text-ink">Admin</span>
                <span className="block text-[11px] text-gray-400 max-w-[130px] truncate">
                  {window.location.host}
                </span>
              </span>
              <ChevronDown size={16} className="text-gray-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 card p-2 z-30">
                {version?.version && (
                  <div className="px-3 py-2 text-xs text-gray-400">Versi {version.version}</div>
                )}
                <button
                  onClick={() => {
                    setActiveTab("about");
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-300 hover:bg-dark-800"
                >
                  <Info size={15} /> Tentang
                </button>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-dark-800"
                >
                  <LogOut size={15} /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile navigation (the pill nav is desktop only) */}
        <nav className="md:hidden mt-2 float-pill rounded-full p-1.5 flex items-center gap-0.5 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-xs font-medium rounded-full whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === tab.id ? "bg-purple-600 text-white" : "text-gray-400"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="flex gap-4 px-3 sm:px-5 pb-8">
        {/* Floating icon rail (desktop) */}
        <aside className="hidden lg:flex sticky top-[88px] self-start flex-col items-center gap-2 float-pill rounded-full py-3 px-2 w-14 shrink-0">
          <div className="flex flex-col items-center rounded-full bg-dark-800 p-1 gap-1">
            <button
              onClick={() => setDark(false)}
              title="Tema terang"
              className={`w-8 h-8 rounded-full flex items-center justify-center ${!dark ? "bg-dark-900 text-purple-500 shadow-pill" : "text-gray-400"}`}
            >
              <Sun size={16} />
            </button>
            <button
              onClick={() => setDark(true)}
              title="Tema gelap"
              className={`w-8 h-8 rounded-full flex items-center justify-center ${dark ? "bg-dark-900 text-purple-400 shadow-pill" : "text-gray-400"}`}
            >
              <Moon size={16} />
            </button>
          </div>
          <div className="w-6 border-t border-dark-700 my-1" />
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  active ? "bg-purple-600 text-white shadow-md shadow-purple-600/30" : "text-gray-400 hover:text-ink hover:bg-dark-800"
                }`}
              >
                <Icon size={17} />
              </button>
            );
          })}
          <div className="w-6 border-t border-dark-700 my-1" />
          <button
            onClick={logout}
            title="Keluar"
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-dark-800"
          >
            <LogOut size={17} />
          </button>
        </aside>

        <main className="flex-1 min-w-0 max-w-[1760px]">
          <div className="flex items-start justify-between gap-3 mb-5 mt-1">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-ink">
                {activeTab === "overview" ? `${greeting()}, Admin` : current.label === "OAuth" ? "Autentikasi OAuth" : current.label}
              </h1>
              <p className="mt-1.5 text-sm text-gray-400">{current.hint}</p>
            </div>
            {/* Theme toggle for screens without the icon rail */}
            <button
              onClick={() => setDark(!dark)}
              title="Ganti tema"
              className="lg:hidden float-pill rounded-full w-10 h-10 flex items-center justify-center text-gray-400 shrink-0"
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>

          {activeTab === "overview" && <Overview onNavigateTab={setActiveTab} />}
          {activeTab === "oauth" && <OAuth onNavigateTab={setActiveTab} />}
          {activeTab === "presets" && <Presets />}
          {activeTab === "credentials" && <Credentials onNavigateTab={setActiveTab} />}
          {activeTab === "upload" && <UploadPage />}
          {activeTab === "playground" && <Playground />}
          {activeTab === "usage-logs" && <UsageLogs />}
          {activeTab === "config" && <Config />}
          {activeTab === "about" && (
            <About version={version} onCheckUpdate={checkUpdate} checkingUpdate={checkingUpdate} />
          )}
        </main>
      </div>
    </div>
  );
}
