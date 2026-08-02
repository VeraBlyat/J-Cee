"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import Link from "next/link";
import http from "@/lib/http";
import CommentForm from "@/components/CommentForm";

// Tiene que coincidir con MAX_DEPTH del backend: si dejáramos ver el botón
// "Responder" en el último nivel, el backend rechazaría con un 400.
const MAX_DEPTH = 3;

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  const tramos = [
    [31536000, "año", "años"],
    [2592000, "mes", "meses"],
    [604800, "semana", "semanas"],
    [86400, "día", "días"],
    [3600, "hora", "horas"],
    [60, "minuto", "minutos"],
  ];

  for (const [segundos, singular, plural] of tramos) {
    const n = Math.floor(seconds / segundos);
    if (n >= 1) return `hace ${n} ${n === 1 ? singular : plural}`;
  }
  return "recién";
}

function ThumbIcon({ down = false, filled = false, className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className={`${className} ${down ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4.5-7a2.5 2.5 0 0 1 2.4 3.2L13 10h5.6a2 2 0 0 1 2 2.5l-1.7 7A2 2 0 0 1 17 21H7" />
    </svg>
  );
}

function Comment({ comment, videoId, depth }) {
  const user = useSelector((state) => state.auth.user);
  const router = useRouter();

  // Los votos se manejan localmente para que el botón responda al instante:
  // esperar un router.refresh() completo para ver un like se siente lento.
  const [votes, setVotes] = useState({
    likes: comment.likes,
    dislikes: comment.dislikes,
    my_vote: comment.my_vote,
  });
  const [replying, setReplying] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const isOwn = user && user.username === comment.username;
  const canDelete = isOwn || user?.is_admin;
  const canReply = depth < MAX_DEPTH;

  async function vote(value) {
    if (!user) {
      router.push("/login");
      return;
    }

    // Volver a tocar el botón que ya está activo saca el voto.
    const next = votes.my_vote === value ? 0 : value;
    try {
      const { data } = await http.post(`/comments/${comment.id}/vote`, {
        value: next,
      });
      // Se usan los totales que devuelve el backend en vez de sumar de a uno:
      // si alguien más votó mientras tanto, el número queda correcto igual.
      setVotes(data);
    } catch {
      // Si falló, el estado no cambia y el botón sigue mostrando la realidad.
    }
  }

  async function remove() {
    if (!confirm("¿Borrar este comentario y sus respuestas?")) return;
    try {
      await http.delete(`/comments/${comment.id}`);
      setDeleted(true);
      router.refresh();
    } catch {
      // sin cambios
    }
  }

  if (deleted) return null;

  return (
    <li>
      <div className="flex gap-2.5">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
          {(comment.username || "?").charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm">
            {comment.username ? (
              <Link
                href={`/canal/${encodeURIComponent(comment.username)}`}
                className="font-medium text-text hover:text-brand"
              >
                @{comment.username}
              </Link>
            ) : (
              <span className="font-medium text-muted">Anónimo</span>
            )}
            <span className="ml-2 text-xs text-muted">
              {timeAgo(comment.created_at)}
            </span>
          </p>

          <p className="mt-0.5 whitespace-pre-line break-words text-sm text-text">
            {comment.content}
          </p>

          <div className="mt-1 flex items-center gap-1 text-xs text-muted">
            <button
              onClick={() => vote(1)}
              aria-label="Me gusta"
              aria-pressed={votes.my_vote === 1}
              className={`flex items-center gap-1 rounded px-1.5 py-1 transition hover:text-brand ${
                votes.my_vote === 1 ? "text-brand" : ""
              }`}
            >
              <ThumbIcon filled={votes.my_vote === 1} />
              {votes.likes > 0 && <span>{votes.likes}</span>}
            </button>

            <button
              onClick={() => vote(-1)}
              aria-label="No me gusta"
              aria-pressed={votes.my_vote === -1}
              className={`flex items-center gap-1 rounded px-1.5 py-1 transition hover:text-red-500 ${
                votes.my_vote === -1 ? "text-red-500" : ""
              }`}
            >
              <ThumbIcon down filled={votes.my_vote === -1} />
              {votes.dislikes > 0 && <span>{votes.dislikes}</span>}
            </button>

            {canReply && (
              <button
                onClick={() => setReplying((v) => !v)}
                className="rounded px-2 py-1 font-medium transition hover:text-text"
              >
                Responder
              </button>
            )}

            {canDelete && (
              <button
                onClick={remove}
                className="rounded px-2 py-1 font-medium transition hover:text-red-500"
              >
                Borrar
              </button>
            )}
          </div>

          {replying && (
            <div className="mt-2">
              <CommentForm
                videoId={videoId}
                parentId={comment.id}
                autoFocus
                onDone={() => setReplying(false)}
                onCancel={() => setReplying(false)}
              />
            </div>
          )}

          {comment.replies?.length > 0 && (
            // El borde izquierdo hace visible la jerarquía del hilo.
            <ul className="mt-3 space-y-3 border-l border-border pl-3">
              {comment.replies.map((reply) => (
                <Comment
                  key={reply.id}
                  comment={reply}
                  videoId={videoId}
                  depth={depth + 1}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

// Cuenta el hilo completo, no sólo las raíces: si un video tiene 2 comentarios
// con 5 respuestas cada uno, "Comentarios (2)" se leería mal.
function countAll(comments) {
  return comments.reduce((n, c) => n + 1 + countAll(c.replies || []), 0);
}

export default function CommentThread({ videoId, comments }) {
  const user = useSelector((state) => state.auth.user);
  const total = countAll(comments);

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-semibold text-text">
        {total} {total === 1 ? "comentario" : "comentarios"}
      </h2>

      {user ? (
        <CommentForm videoId={videoId} />
      ) : (
        <p className="text-sm text-muted">
          <Link href="/login" className="font-medium text-brand hover:underline">
            Inicia sesión
          </Link>{" "}
          para comentar.
        </p>
      )}

      <ul className="mt-6 space-y-5">
        {comments.map((comment) => (
          <Comment
            key={comment.id}
            comment={comment}
            videoId={videoId}
            depth={1}
          />
        ))}
      </ul>
    </section>
  );
}
