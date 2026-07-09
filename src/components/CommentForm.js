"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CommentForm({ videoId }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (!content.trim()) return;
    setLoading(true);

    await fetch("/api/comments", {
      method: "POST",
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
        className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="bg-red-600 hover:bg-red-500 rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "..." : "Comentar"}
      </button>
    </div>
  );
}
