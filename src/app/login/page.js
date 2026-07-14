"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/apiBase";

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // "login" o "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit() {
    setError("");
    const endpoint =
      mode === "login" ? "/auth/login" : "/auth/register";

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
  }

  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-6">
        {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
      </h1>

      <div className="space-y-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Usuario"
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={handleSubmit}
          className="w-full bg-red-600 hover:bg-red-500 rounded px-4 py-2 font-medium"
        >
          {mode === "login" ? "Entrar" : "Registrarme"}
        </button>
      </div>

      <button
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        className="mt-4 text-sm text-gray-400 hover:text-red-400"
      >
        {mode === "login"
          ? "¿No tienes cuenta? Regístrate"
          : "¿Ya tienes cuenta? Inicia sesión"}
      </button>
    </div>
  );
}
