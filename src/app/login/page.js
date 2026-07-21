"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/apiBase";

// Logo simple (video + play). Si ya tienes un LogoMark propio, borra este e impórtalo.
function LogoMark({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="5" fill="currentColor" opacity="0.15" />
      <rect x="2" y="4" width="20" height="16" rx="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9.5l4 2.5-4 2.5v-5z" fill="currentColor" />
    </svg>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // "login" o "register"
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

      // Sesión iniciada: vamos al inicio y refrescamos para que el navbar cambie.
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
    <div className="flex min-h-screen w-full bg-gray-950 text-white">
      {/* Panel visual (solo desktop) */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-linear-to-br from-gray-950 via-gray-900 to-red-950 p-12 lg:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-red-600/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-red-500/10 blur-3xl" />

        <div className="relative flex items-center gap-2 text-lg font-semibold">
          <LogoMark className="h-7 w-7 text-red-500" />
          J-Ceen
        </div>

        <div className="relative max-w-md">
          {/* Firma: mini terminal, guiño a "videos de programación" */}
          <div className="mb-8 w-full max-w-sm rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-sm shadow-2xl backdrop-blur">
            <div className="mb-3 flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <p className="text-gray-400">
              <span className="text-red-400">const</span> bienvenida = () <span className="text-red-400">{"=>"}</span> {"{"}
            </p>
            <p className="pl-4 text-gray-300">
              console.<span className="text-sky-400">log</span>(<span className="text-emerald-400">"¡Hola, J-Ceen!"</span>);
            </p>
            <p className="text-gray-400">{"}"}</p>
          </div>

          <h2 className="text-3xl font-bold leading-tight">Tu comunidad de código te espera</h2>
          <p className="mt-4 text-gray-300">
            Inicia sesión para seguir el progreso de tus proyectos favoritos y compartir el tuyo.
          </p>
        </div>

        <p className="relative text-sm text-gray-400">Videos de programación, por y para estudiantes.</p>
      </div>

      {/* Formulario */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-xl font-bold">
            <LogoMark className="h-7 w-7 text-red-500" /> J-Ceen
          </div>

          <h1 className="text-2xl font-bold">{isLogin ? "Bienvenido de vuelta" : "Crea tu cuenta"}</h1>
          <p className="mt-1 text-sm text-gray-400">
            {isLogin
              ? "Ingresa tus datos para continuar viendo videos de programación."
              : "Regístrate para compartir tus proyectos con la comunidad."}
          </p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">Usuario o correo</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="tucorreo@ejemplo.com"
                autoComplete="username"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-white placeholder-gray-500 outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="••••••••"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 pr-10 text-white placeholder-gray-500 outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-lg leading-none hover:bg-gray-800"
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Visual por ahora: aún no conectado al backend */}
            {isLogin && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-gray-400">
                  <input type="checkbox" className="accent-red-600" /> Recordarme
                </label>
                <span className="cursor-pointer text-gray-400 hover:text-red-400">¿Olvidaste tu contraseña?</span>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Procesando…" : isLogin ? "Iniciar sesión" : "Registrarme"}
            </button>
          </div>

          {/* Social: visual, sin backend (tu Nest no tiene OAuth todavía) */}
          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-gray-500">
            <span className="h-px flex-1 bg-gray-800" /> o continúa con <span className="h-px flex-1 bg-gray-800" />
          </div>
          <div className="space-y-2">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-gray-800"
            >
              🔵 Continuar con Google
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-gray-800"
            >
              🍎 Continuar con Apple
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-gray-400">
            {isLogin ? "¿Aún no tienes cuenta? " : "¿Ya tienes cuenta? "}
            <span
              onClick={() => {
                setMode(isLogin ? "register" : "login");
                setError("");
              }}
              className="cursor-pointer font-medium text-red-400 hover:text-red-300"
            >
              {isLogin ? "Regístrate gratis" : "Inicia sesión"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}