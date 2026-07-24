"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/apiBase";

function LogoMark({ className = "h-6 w-8" }) {
  return (
    <svg viewBox="0 0 32 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3 12C6 6.5 12 4.5 18 5.5c4 .7 7 3 8 6.5-1 3.5-4 5.8-8 6.5-6 1-12-1-15-6.5Z" />
      <path d="M24.5 12 31 7.5v9L24.5 12Z" />
    </svg>
  );
}

function EyeIcon({ off = false, className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const isLogin = mode === "login";

  async function handleSubmit() {
    setError("");
    setLoading(true);
    const endpoint = isLogin ? "/auth/login" : "/auth/register";
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Ocurrió un error.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bkg p-4">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl bg-card shadow-xl">

        {/* Panel izquierdo */}
        <div
          className="relative hidden w-1/2 flex-col items-center justify-center p-12 text-center lg:flex bg-primary"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1.5px, transparent 1.5px)",
            backgroundSize: "24px 24px",
          }}
        >
          <LogoMark className="mb-6 h-12 w-16 text-bkg" />
          <h2 className="max-w-xs text-2xl font-bold text-bkg">
            Tu comunidad de código te espera
          </h2>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-bkg">
            Inicia sesión para seguir el progreso de tus proyectos favoritos y compartir el tuyo.
          </p>
        </div>

        {/* Formulario */}
        <div className="w-full p-8 sm:p-10 lg:w-1/2">

          <div className="mb-8 flex items-center gap-2">
            <LogoMark className="h-6 w-8 text-primary" />
            <span className="text-lg font-bold text-txt">J-Ceen</span>
          </div>

          <h1 className="text-2xl font-bold text-txt">
            {isLogin ? "Bienvenido de vuelta" : "Crea tu cuenta"}
          </h1>
          <p className="mt-1 text-sm text-sbtxt">
            {isLogin
              ? "Ingresa tus datos para continuar viendo videos de programación."
              : "Regístrate para compartir tus proyectos con la comunidad."}
          </p>

          <div className="mt-7 space-y-4">

            <div>
              <label htmlFor="usuario" className="mb-1.5 block text-sm font-medium text-sbtxt">
                Correo electrónico
              </label>
              <input
                id="usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="tucorreo@ejemplo.com"
                autoComplete="username"
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2.5 text-txt placeholder-sbtxt outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-sbtxt">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="••••••••"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="w-full rounded-lg border border-border bg-input-bg px-3 py-2.5 pr-10 text-txt placeholder-sbtxt outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-sbtxt hover:text-primary"
                >
                  <EyeIcon off={showPass} />
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-sbtxt">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 rounded accent-check"
                  />
                  Recordarme
                </label>
                <span className="cursor-pointer font-medium text-link hover:underline">
                  ¿Olvidaste tu contraseña?
                </span>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-bkg transition hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bkg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Procesando…" : isLogin ? "Iniciar sesión" : "Registrarme"}
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-sbtxt">
            <span className="h-px flex-1 bg-border" />
            o continúa con
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2.5">
            {["🔵 Continuar con Google", "🍎 Continuar con Apple"].map((label) => (
              <button
                key={label}
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-input-bg px-4 py-2.5 text-sm font-medium text-txt transition hover:bg-card"
              >
                {label}
              </button>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-sbtxt">
            {isLogin ? "¿Aún no tienes cuenta? " : "¿Ya tienes cuenta? "}
            <span
              onClick={() => { setMode(isLogin ? "register" : "login"); setError(""); }}
              className="cursor-pointer font-semibold text-link hover:underline"
            >
              {isLogin ? "Regístrate gratis" : "Inicia sesión"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}