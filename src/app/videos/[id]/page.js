import { serverFetch } from "@/lib/api";
import CommentThread from "@/components/CommentThread";
import VideoPlayer from "@/components/VideoPlayer";
import SubscribeButton from "@/components/SubscribeButton";
import LikeButton from "@/components/LikeButton";
import UpNext from "@/components/UpNext";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function plural(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export default async function VideoPage({ params }) {
  // En Next 15, params es una promesa: hay que esperarla.
  const { id } = await params;

  const videoRes = await serverFetch(`/videos/${id}`);
  if (videoRes.status === 404) notFound();
  const video = await videoRes.json();

  const commentsRes = await serverFetch(`/videos/${id}/comments`);
  const comments = commentsRes.ok ? await commentsRes.json() : [];

  // Datos del canal, para el botón de suscripción. Sólo si el video tiene
  // autor: los videos de usuarios borrados quedan sin username.
  let channel = null;
  if (video.username) {
    const channelRes = await serverFetch(
      `/channels/${encodeURIComponent(video.username)}`
    );
    if (channelRes.ok) channel = await channelRes.json();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        {/* Reproductor propio sobre HLS: los segmentos los genera el backend
            bajo demanda y hls.js va cambiando de calidad según la conexión.
            Los videos subidos antes de la Fase 2 no tienen metadata de
            streaming, así que para esos caemos al MP4 original. */}
        {video.duration_seconds ? (
          <VideoPlayer videoId={video.id} title={video.title} />
        ) : (
          <video
            src={video.file_path}
            controls
            className="aspect-video w-full rounded-card bg-black shadow-jc-lg"
          />
        )}

        <h1 className="mb-1.5 mt-4 font-display text-xl font-bold leading-tight text-text">
          {video.title}
        </h1>

        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">
            {video.hashtags?.length > 0 && (
              <span className="mr-1">
                {video.hashtags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/?hashtag=${encodeURIComponent(tag)}`}
                    className="mr-1.5 text-brand hover:underline"
                  >
                    #{tag}
                  </Link>
                ))}
              </span>
            )}
          </p>
        </div>

        {/* Fila del canal, con el botón de suscripción al lado del autor: es
            donde se decide seguir a alguien, justo después de ver su video. */}
        <div className="mb-3.5 flex items-center gap-3 border-y border-border py-3.5">
          {video.username ? (
            <>
              <Link
                href={`/canal/${encodeURIComponent(video.username)}`}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-3 font-display font-bold text-white"
              >
                {video.username.charAt(0).toUpperCase()}
              </Link>
              <div className="min-w-0">
                <Link
                  href={`/canal/${encodeURIComponent(video.username)}`}
                  className="block text-sm font-bold text-text hover:text-brand"
                >
                  @{video.username}
                </Link>
                {channel && (
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    {plural(channel.subscriber_count, "suscriptor", "suscriptores")}
                  </p>
                )}
              </div>
            </>
          ) : (
            <span className="text-sm text-muted">Anónimo</span>
          )}

          {/* Acciones del video: like siempre; suscribirse sólo si el video
              tiene canal con datos cargados. */}
          <div className="ml-auto flex items-center gap-2.5">
            <LikeButton
              videoId={video.id}
              initialLikes={video.like_count}
              initialLiked={video.liked}
            />
            {video.username && channel && (
              <SubscribeButton
                username={video.username}
                initialSubscribed={channel.is_subscribed === true}
                initialCount={channel.subscriber_count}
              />
            )}
          </div>
        </div>

        {video.description && (
          <div className="mb-[22px] whitespace-pre-line rounded-field border border-border bg-card p-3.5 text-[12.5px] leading-relaxed text-muted">
            {video.description}
          </div>
        )}

        {/* El hilo es de cliente: los votos y el formulario de respuesta tienen
            que responder sin recargar. Los datos ya vienen resueltos del
            servidor, con my_vote calculado para este visitante. */}
        <CommentThread videoId={video.id} comments={comments} />
      </div>

      <UpNext currentId={video.id} />
    </div>
  );
}
