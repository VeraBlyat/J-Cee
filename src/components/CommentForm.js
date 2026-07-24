"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/apiBase";

export default function CommentForm({ videoId }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (!content.trim()) return;
    setLoading(true);

    await fetch(`${API_URL}/comments`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, content }),
    });

    setContent("");
    setLoading(false);
    router.refresh(); // recarga el componente de servidor y muestra el comentario nuevo
  }

  return (
    <div className="flex gap-2">
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Escribe un comentario..."
        className="flex-1 bg-surface rounded px-3 py-2 text-sm text-bkg"
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="text-txt bg-primary hover:bg-card rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "..." : "Comentar"}
      </button>
    </div>
  );
}
