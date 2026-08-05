"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { login, register } from "@/store/authSlice";
import Logo from "@/components/Logo";
import http from "@/lib/http";

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
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot"
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState(""); // sólo al registrarse
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Recuperación: una vez pedido el enlace mostramos la confirmación. resetUrl
  // sólo viene fuera de producción (no hay servidor de correo), para poder
  // probar el flujo sin salir de la página.
  const [resetSent, setResetSent] = useState(false);
  const [resetUrl, setResetUrl] = useState(null);
  const router = useRouter();
  const dispatch = useDispatch();

  const isLogin = mode === "login";
  const isForgot = mode === "forgot";

  function switchMode(next) {
    setMode(next);
    setError("");
    setResetSent(false);
    setResetUrl(null);
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Recuperación de contraseña: pide el enlace y muestra la confirmación.
      // El backend responde igual exista o no el email, así que nunca sabemos
      // (ni contamos) si la cuenta existe.
      if (isForgot) {
        const { data } = await http.post("/auth/forgot-password", { email });
        setResetSent(true);
        setResetUrl(data?.resetUrl ?? null);
        return;
      }

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
          <Image
            src="/logoG.png"
            alt="J-Cee"
            width={280}
            height={175}
            priority
            className="mx-auto mb-6 h-auto w-[240px]"
          />
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
            {isForgot
              ? "Recuperar contraseña"
              : isLogin
                ? "Bienvenido de vuelta"
                : "Crea tu cuenta"}
          </h1>
          <p className="mb-7 text-[13.5px] leading-relaxed text-muted">
            {isForgot
              ? "Ingresá tu correo y te enviaremos un enlace para restablecer tu contraseña."
              : isLogin
                ? "Ingresa tus datos para continuar viendo videos de programación."
                : "Registrate para compartir tus proyectos con la comunidad."}
          </p>

          {/* Confirmación de recuperación. Reemplaza al formulario una vez
              pedido el enlace. */}
          {isForgot && resetSent ? (
            <div>
              <div className="mb-5 rounded-field border-[1.5px] border-border bg-card p-4 text-[13px] leading-relaxed text-text">
                Si hay una cuenta con ese correo, te enviamos un enlace para
                restablecer la contraseña. Revisá tu bandeja de entrada.
              </div>

              {/* Sin servidor de correo (dev): el backend devuelve el enlace
                  directamente para poder probar el flujo. */}
              {resetUrl && (
                <div className="mb-5 rounded-field border-[1.5px] border-dashed border-brand-3 bg-page-2 p-4 text-[12px] leading-relaxed text-muted">
                  <p className="mb-2 font-semibold text-text">
                    Modo desarrollo
                  </p>
                  No hay servidor de correo configurado, así que este es el
                  enlace de recuperación:
                  <Link
                    href={resetUrl.replace(/^https?:\/\/[^/]+/, "")}
                    className="mt-2 block break-all font-semibold text-brand hover:underline"
                  >
                    {resetUrl}
                  </Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => switchMode("login")}
                className="w-full rounded-field bg-brand py-[13px] text-[14.5px] font-bold tracking-[0.02em] text-white transition hover:-translate-y-px hover:bg-brand-2 hover:shadow-jc"
              >
                Volver a iniciar sesión
              </button>
            </div>
          ) : (
            <>
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
              {!isLogin && !isForgot && (
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

              {/* La contraseña no se pide al recuperar: eso pasa en la página
                  de restablecer, con el token del enlace. */}
              {!isForgot && (
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
              )}

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
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="cursor-pointer font-semibold text-brand hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              {error && <p className="mb-4 text-[13px] text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mb-5 w-full rounded-field bg-brand py-[13px] text-[14.5px] font-bold tracking-[0.02em] text-white transition hover:-translate-y-px hover:bg-brand-2 hover:shadow-jc disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Procesando…"
                  : isForgot
                    ? "Enviar enlace de recuperación"
                    : isLogin
                      ? "Iniciar sesión"
                      : "Registrarme"}
              </button>

              {isForgot ? (
                <p className="mt-[22px] text-center text-[13px] text-muted">
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="cursor-pointer font-semibold text-brand hover:underline"
                  >
                    Volver a iniciar sesión
                  </button>
                </p>
              ) : (
                <p className="mt-[22px] text-center text-[13px] text-muted">
                  {isLogin ? "¿Aún no tenés cuenta? " : "¿Ya tenés cuenta? "}
                  <button
                    type="button"
                    onClick={() => switchMode(isLogin ? "register" : "login")}
                    className="cursor-pointer font-semibold text-brand hover:underline"
                  >
                    {isLogin ? "Registrate gratis" : "Iniciá sesión"}
                  </button>
                </p>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}
