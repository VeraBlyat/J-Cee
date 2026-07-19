import { serverFetch, getCurrentUser } from "@/lib/api";
import CommentForm from "@/components/CommentForm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function VideoPage({ params }) {
  // En Next 15, params es una promesa: hay que esperarla.
  const { id } = await params;

  const videoRes = await serverFetch(`/videos/${id}`);
  if (videoRes.status === 404) notFound();
  const video = await videoRes.json();

  const commentsRes = await serverFetch(`/videos/${id}/comments`);
  const comments = commentsRes.ok ? await commentsRes.json() : [];

  const user = await getCurrentUser();

  return (
    <div className="max-w-3xl mx-auto">
      {/* El navegador reproduce el MP4 directamente. controls muestra los botones.
          file_path ya es una ruta pública ("/uploads/..."), no necesita prefijo. */}
      <video
        src={video.file_path}
        controls
        className="w-full rounded-lg bg-black"
      />

      <h1 className="text-2xl font-bold mt-4">{video.title}</h1>
      <p className="text-sm text-gray-400 mt-1">
        Subido por {video.username || "Anónimo"}
      </p>

      {video.description && (
        <p className="mt-3 text-gray-300 whitespace-pre-line">
          {video.description}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-4">
          Comentarios ({comments.length})
        </h2>

        {user ? (
          <CommentForm videoId={video.id} />
        ) : (
          <p className="text-gray-400 text-sm mb-4">
            Inicia sesión para comentar.
          </p>
        )}

        <ul className="space-y-3 mt-4">
          {comments.map((c) => (
            <li key={c.id} className="border-b border-gray-800 pb-2">
              <p className="text-sm font-medium text-red-400">
                {c.username || "Anónimo"}
              </p>
              <p className="text-gray-200">{c.content}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
