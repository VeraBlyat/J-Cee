"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import http from "@/lib/http";

// Botón de suscripción. Arranca con el estado que resolvió el servidor y
// después lo maneja solo, sin recargar la página.
export default function SubscribeButton({
  username,
  initialSubscribed,
  initialCount,
}) {
  const user = useSelector((state) => state.auth.user);
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [hovering, setHovering] = useState(false);
  const router = useRouter();

  // Nadie se suscribe a su propio canal (el backend también lo rechaza).
  const isOwnChannel = user?.username === username;

  async function toggle() {
    // Sin sesión no tiene sentido el botón: mandamos al login.
    if (!user) {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const { data } = subscribed
        ? await http.delete(`/channels/${encodeURIComponent(username)}/subscribe`)
        : await http.post(`/channels/${encodeURIComponent(username)}/subscribe`);

      // El backend devuelve el total actualizado, así que no hay que
      // adivinarlo sumando o restando de a uno.
      setSubscribed(data.is_subscribed);
      setCount(data.subscriber_count);
    } catch {
      // Si falló, el estado no cambia: el botón sigue reflejando la realidad.
    } finally {
      setLoading(false);
    }
  }

  if (isOwnChannel) {
    return (
      <span className="rounded-full bg-card px-4 py-2 text-sm font-medium text-muted">
        Tu canal
      </span>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
        subscribed
          ? "bg-card text-text hover:bg-red-600 hover:text-white"
          : "bg-brand text-white hover:bg-brand-2"
      }`}
    >
      {subscribed
        ? // Al pasar el mouse avisamos qué va a pasar si hace clic.
          hovering
          ? "Cancelar suscripción"
          : "Suscrito"
        : "Suscribirse"}
      <span className="ml-1.5 font-normal opacity-80">{count}</span>
    </button>
  );
}
