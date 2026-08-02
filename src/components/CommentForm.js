"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import http from "@/lib/http";

// Sirve para el comentario principal y para las respuestas: la diferencia es
// el parentId, que sólo viaja si existe.
export default function CommentForm({
  videoId,
  parentId,
  autoFocus = false,
  onDone,
  onCancel,
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const isReply = Boolean(parentId);

  async function handleSubmit() {
    if (!content.trim()) return;
    setLoading(true);
    setError("");

    try {
      await http.post("/comments", {
        videoId,
        content,
        // Sin el spread condicional el body llevaría "parentId: undefined";
        // así el contrato queda explícito para el comentario raíz.
        ...(isReply ? { parentId } : {}),
      });
      setContent("");
      onDone?.();
      router.refresh(); // recarga el componente de servidor y muestra lo nuevo
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo publicar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus={autoFocus}
          placeholder={
            isReply ? "Escribe una respuesta..." : "Escribe un comentario..."
          }
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-muted outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-2 disabled:opacity-50"
        >
          {loading ? "..." : isReply ? "Responder" : "Comentar"}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-text"
          >
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
