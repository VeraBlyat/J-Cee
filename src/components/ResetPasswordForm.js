"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import http from "@/lib/http";

const FIELD =
  "focus-glow w-full rounded-field border-[1.5px] border-border bg-card px-4 py-3 text-sm text-text outline-none transition placeholder:text-muted";

const MIN_LENGTH = 8;

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

// El token llega en la URL del enlace de recuperación y lo resuelve el
// componente de servidor, así que acá sólo lo recibimos por prop.
export default function ResetPasswordForm({ token }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Validaciones del lado del cliente para dar feedback inmediato; el backend
    // igual las repite (nunca confiamos sólo en el navegador).
    if (password.length < MIN_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await http.post("/auth/reset-password", { token, password });
      setDone(true);
      // Damos un momento para leer el mensaje y mandamos al login.
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      const message = err?.response?.data?.error;
      setError(
        typeof message === "string"
          ? message
          : "No se pudo restablecer la contraseña."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-60px)] items-center justify-center bg-surface px-6 py-12">
      <div className="w-full max-w-[360px]">
        <Logo tone="page" size={28} className="mb-7" />

        {done ? (
          <div>
            <h1 className="mb-1.5 font-display text-[26px] font-extrabold text-text">
              Contraseña actualizada
            </h1>
            <p className="mb-7 text-[13.5px] leading-relaxed text-muted">
              Ya podés iniciar sesión con tu nueva contraseña. Te estamos
              llevando al login…
            </p>
            <Link
              href="/login"
              className="block w-full rounded-field bg-brand py-[13px] text-center text-[14.5px] font-bold text-white transition hover:bg-brand-2"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        ) : !token ? (
          <div>
            <h1 className="mb-1.5 font-display text-[26px] font-extrabold text-text">
              Enlace inválido
            </h1>
            <p className="mb-7 text-[13.5px] leading-relaxed text-muted">
              Este enlace de recuperación no es válido. Pedí uno nuevo desde el
              inicio de sesión.
            </p>
            <Link
              href="/login"
              className="block w-full rounded-field bg-brand py-[13px] text-center text-[14.5px] font-bold text-white transition hover:bg-brand-2"
            >
              Volver al login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h1 className="mb-1.5 font-display text-[26px] font-extrabold text-text">
              Nueva contraseña
            </h1>
            <p className="mb-7 text-[13.5px] leading-relaxed text-muted">
              Elegí una contraseña nueva para tu cuenta.
            </p>

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
                  autoComplete="new-password"
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
              <p className="mt-1.5 text-[11px] text-muted">Mínimo 8 caracteres.</p>
            </div>

            <div className="mb-[18px]">
              <label htmlFor="confirm" className="mb-1.5 block text-xs font-semibold text-text">
                Repetir contraseña
              </label>
              <input
                id="confirm"
                type={showPass ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className={FIELD}
              />
            </div>

            {error && <p className="mb-4 text-[13px] text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-field bg-brand py-[13px] text-[14.5px] font-bold tracking-[0.02em] text-white transition hover:-translate-y-px hover:bg-brand-2 hover:shadow-jc disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Procesando…" : "Cambiar contraseña"}
            </button>

            <p className="mt-[22px] text-center text-[13px] text-muted">
              <Link href="/login" className="font-semibold text-brand hover:underline">
                Volver a iniciar sesión
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
