import { AlertCircle, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import Logo from "../components/Logo";
import { Button, Field, IconButton, Input, Notice } from "../components/ui";
import api from "../api";

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { password });
      localStorage.setItem("panelToken", res.data.token);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || "Gagal masuk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-10">
      {/* Soft background glows */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 -left-32 w-[420px] h-[420px] rounded-full bg-purple-600/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-32 w-[420px] h-[420px] rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative w-full max-w-md min-w-0">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="float-pill rounded-full flex items-center gap-2.5 pl-2 pr-5 py-1.5">
            <span className="w-10 h-10 rounded-full bg-purple-600/10 flex items-center justify-center">
              <Logo size={24} />
            </span>
            <span className="text-xl font-bold tracking-tight text-ink">AGYBridge</span>
          </div>
          <p className="text-gray-400 mt-4 text-sm">Panel Kontrol Proksi API Antigravity</p>
        </div>

        {/* Login card */}
        <div className="card !p-6 sm:!p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <span className="w-14 h-14 rounded-full bg-purple-600/10 text-purple-500 flex items-center justify-center mb-4">
              <Lock size={24} />
            </span>
            <h1 className="text-2xl font-semibold text-ink tracking-tight">Masuk ke Panel Kontrol</h1>
            <p className="text-sm text-gray-400 mt-1.5">Masukkan kata sandi untuk melanjutkan.</p>
          </div>

          {error && (
            <Notice tone="danger" icon={AlertCircle} className="mb-4">
              {error}
            </Notice>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Kata Sandi" htmlFor="login-password">
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="!pr-12"
                  placeholder="Masukkan kata sandi panel kontrol"
                  autoComplete="current-password"
                  required
                />
                <IconButton
                  icon={showPassword ? EyeOff : Eye}
                  label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 !bg-transparent"
                />
              </div>
            </Field>

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              Masuk
            </Button>
          </form>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-gray-500 text-center">
          <ShieldCheck size={14} className="shrink-0" />
          Akses terbatas untuk administrator panel.
        </p>
      </div>
    </div>
  );
}
