"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import http from "@/lib/http";

function HeartIcon({ filled = false, className = "h-[18px] w-[18px]" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 20.5s-7.5-4.6-9.5-9.1C1.2 8.1 3 5 6.2 5 8 5 9.3 6 12 8.5 14.7 6 16 5 17.8 5 21 5 22.8 8.1 21.5 11.4 19.5 15.9 12 20.5 12 20.5Z" />
    </svg>
  );
}

// Botón de "me gusta" del video. Arranca con el estado que resolvió el
// servidor (likes totales y si el que mira ya dio like) y después se maneja
// solo, sin recargar. Mismo criterio que SubscribeButton.
export default function LikeButton({ videoId, initialLikes, initialLiked }) {
  const user = useSelector((state) => state.auth.user);
  const [likes, setLikes] = useState(initialLikes ?? 0);
  const [liked, setLiked] = useState(Boolean(initialLiked));
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function toggle() {
    // Sin sesión no se puede dar like: al login.
    if (!user) {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const { data } = liked
        ? await http.delete(`/videos/${videoId}/like`)
        : await http.post(`/videos/${videoId}/like`);

      // Usamos el total que devuelve el backend en vez de sumar de a uno: si
      // alguien más dio like mientras tanto, el número queda correcto.
      setLiked(data.liked);
      setLikes(data.like_count);
    } catch {
      // Si falló, el estado no cambia y el botón sigue mostrando la realidad.
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-pressed={liked}
      aria-label={liked ? "Quitar me gusta" : "Me gusta"}
      className={`flex items-center gap-2 rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
        liked
          ? "border-brand bg-brand/10 text-brand"
          : "border-border bg-card text-text hover:border-brand-3"
      }`}
    >
      <HeartIcon filled={liked} />
      <span className="tabular-nums">{likes}</span>
    </button>
  );
}
