"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { login, register } from "@/store/authSlice";
import Logo from "@/components/Logo";

// Logo grande del panel izquierdo: el mismo dibujo que la marca, a escala de
// ilustración.
function LogoHero() {
  return (
    <svg viewBox="0 0 300 200" className="mx-auto mb-6 w-[200px]" aria-hidden="true">
      <path d="M20 20 L210 100 L20 180 Z" fill="var(--jc-brand-2)" />
      <path d="M20 20 L210 100 L20 180 Z" fill="rgba(255,255,255,0.08)" />
      <path d="M170 70 L280 30 L265 100 L280 170 L170 130 Z" fill="var(--jc-brand-3)" />
      <circle cx="80" cy="88" r="24" fill="#fff" />
      <circle cx="87" cy="93" r="11" fill="#101a0c" />
      <circle cx="92" cy="85" r="4" fill="#fff" />
    </svg>
  );
}

function EyeIcon({ off = false }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

const FIELD =
  "focus-glow w-full rounded-field border-[1.5px] border-border bg-card px-4 py-3 text-sm text-text outline-none transition placeholder:text-muted";

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState(""); // sólo al registrarse
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const dispatch = useDispatch();

  const isLogin = mode === "login";

  async function handleSubmit(e) {
    e?.preventDefault();
    setError("");
    setLoading(true);

    try {
      // El thunk (Axios) hace login/register y guarda el usuario en el store.
      // unwrap() lanza si el backend rechazó, con el mensaje de rejectWithValue.
      // Al entrar sólo hace falta el email; al registrarse va también el
      // nombre público del canal.
      const action = isLogin
        ? login({ email, password })
        : register({ email, username, password });
      await dispatch(action).unwrap();

      // Sesión iniciada: el navbar ya reaccionó vía Redux; vamos al inicio y
      // refrescamos para re-sincronizar los componentes de servidor.
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(typeof err === "string" ? err : "No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="-mx-7 -my-7 grid min-h-[calc(100vh-60px)] lg:grid-cols-2">
      {/* Panel visual */}
      <div className="relative hidden flex-col items-center justify-center overflow-hidden bg-header px-10 py-12 lg:flex">
        {/* Huellas del fondo, del mockup */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 15% 20%, var(--jc-brand-2) 0 4px, transparent 5px),
              radial-gradient(ellipse at 65% 12%, var(--jc-brand-2) 0 3px, transparent 4px),
              radial-gradient(ellipse at 35% 68%, var(--jc-brand-2) 0 4px, transparent 5px),
              radial-gradient(ellipse at 80% 55%, var(--jc-brand-2) 0 3px, transparent 4px),
              radial-gradient(ellipse at 8% 82%, var(--jc-brand-2) 0 3px, transparent 4px)`,
            backgroundSize: "200px 200px",
          }}
        />

        <div className="relative z-10 text-center">
          <LogoHero />
          <h2 className="mb-2.5 font-display text-2xl leading-tight text-header-text">
            Tu comunidad de código te espera
          </h2>
          <p className="mx-auto max-w-[300px] text-[13.5px] leading-relaxed text-header-text/70">
            Inicia sesión para seguir el progreso de tus proyectos favoritos y
            compartir el tuyo.
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center bg-surface px-6 py-12 sm:px-10">
        <form onSubmit={handleSubmit} className="w-full max-w-[360px]">
          <Logo tone="page" size={28} className="mb-7" />

          <h1 className="mb-1.5 font-display text-[26px] font-extrabold text-text">
            {isLogin ? "Bienvenido de vuelta" : "Crea tu cuenta"}
          </h1>
          <p className="mb-7 text-[13.5px] leading-relaxed text-muted">
            {isLogin
              ? "Ingresa tus datos para continuar viendo videos de programación."
              : "Registrate para compartir tus proyectos con la comunidad."}
          </p>

          <div className="mb-[18px]">
            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-text">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              autoComplete="email"
              className={FIELD}
            />
          </div>

          {/* El nombre del canal es público y sólo se elige al registrarse;
              para entrar alcanza con el email. */}
          {!isLogin && (
            <div className="mb-[18px]">
              <label htmlFor="username" className="mb-1.5 block text-xs font-semibold text-text">
                Nombre de usuario
              </label>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tu_canal"
                autoComplete="username"
                className={FIELD}
              />
              <p className="mt-1.5 text-[11px] text-muted">
                Así te van a ver en tus videos y comentarios.
              </p>
            </div>
          )}

          <div className="mb-[18px]">
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-text">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={isLogin ? "current-password" : "new-password"}
                className={`${FIELD} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted opacity-70 transition hover:opacity-100"
              >
                <EyeIcon off={showPass} />
              </button>
            </div>
            {!isLogin && (
              <p className="mt-1.5 text-[11px] text-muted">Mínimo 8 caracteres.</p>
            )}
          </div>

          {isLogin && (
            <div className="mb-[22px] flex items-center justify-between text-[12.5px]">
              <label className="flex cursor-pointer items-center gap-2 text-muted">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded"
                  style={{ accentColor: "var(--jc-brand)" }}
                />
                Recordarme
              </label>
              <span className="cursor-pointer font-semibold text-brand hover:underline">
                ¿Olvidaste tu contraseña?
              </span>
            </div>
          )}

          {error && <p className="mb-4 text-[13px] text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mb-5 w-full rounded-field bg-brand py-[13px] text-[14.5px] font-bold tracking-[0.02em] text-white transition hover:-translate-y-px hover:bg-brand-2 hover:shadow-jc disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Procesando…" : isLogin ? "Iniciar sesión" : "Registrarme"}
          </button>

          <div className="mb-[18px] flex items-center gap-2.5 text-[11.5px] text-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
            o continúa con
          </div>

          {["Continuar con Google", "Continuar con Apple"].map((label) => (
            <button
              key={label}
              type="button"
              className="mb-2.5 flex w-full items-center justify-center gap-2.5 rounded-field border-[1.5px] border-border bg-card py-[11px] text-[13.5px] font-semibold text-text transition hover:border-brand-3 hover:bg-page-2"
            >
              {label}
            </button>
          ))}

          <p className="mt-[22px] text-center text-[13px] text-muted">
            {isLogin ? "¿Aún no tenés cuenta? " : "¿Ya tenés cuenta? "}
            <button
              type="button"
              onClick={() => {
                setMode(isLogin ? "register" : "login");
                setError("");
              }}
              className="cursor-pointer font-semibold text-brand hover:underline"
            >
              {isLogin ? "Registrate gratis" : "Iniciá sesión"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
