"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import http from "@/lib/http";

export default function CommentForm({ videoId }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (!content.trim()) return;
    setLoading(true);

    try {
      await http.post("/comments", { videoId, content });
      setContent("");
      router.refresh(); // recarga el componente de servidor y muestra el comentario nuevo
    } finally {
      setLoading(false);
    }
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
