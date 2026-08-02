import { serverFetch } from "@/lib/api";
import VideoCard from "@/components/VideoCard";
import SubscribeButton from "@/components/SubscribeButton";
import SectionTitle from "@/components/SectionTitle";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function plural(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export default async function ChannelPage({ params }) {
  const { username } = await params;

  // serverFetch reenvía la cookie, así que el backend puede decirnos si el
  // visitante ya está suscrito y el botón sale con el estado correcto desde
  // el primer render, sin parpadeo.
  const res = await serverFetch(`/channels/${encodeURIComponent(username)}`);
  if (res.status === 404) notFound();
  const channel = await res.json();

  const videosRes = await serverFetch(
    `/channels/${encodeURIComponent(username)}/videos`
  );
  const videos = videosRes.ok ? await videosRes.json() : [];

  return (
    <div>
      {/* Portada con la textura de escamas de la marca */}
      <header className="scales mb-8 overflow-hidden rounded-panel border border-border bg-surface">
        <div className="h-24 bg-gradient-to-r from-header to-brand-2" />

        <div className="flex flex-wrap items-center gap-5 px-6 pb-6">
          <div className="-mt-10 grid h-20 w-20 shrink-0 place-items-center rounded-full border-4 border-surface bg-gradient-to-br from-brand to-brand-3 font-display text-3xl font-extrabold text-white shadow-jc">
            {channel.username.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1 pt-2">
            <h1 className="font-display text-2xl font-extrabold text-text">
              @{channel.username}
            </h1>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {plural(channel.subscriber_count, "suscriptor", "suscriptores")}
              {" · "}
              {plural(channel.video_count, "video", "videos")}
            </p>
          </div>

          <div className="pt-2">
            <SubscribeButton
              username={channel.username}
              // is_subscribed viene null si el visitante no tiene sesión; para
              // el botón eso es lo mismo que "no suscrito".
              initialSubscribed={channel.is_subscribed === true}
              initialCount={channel.subscriber_count}
            />
          </div>
        </div>
      </header>

      <SectionTitle>Videos</SectionTitle>

      {videos.length === 0 ? (
        <p className="text-[13px] text-muted">
          Este canal todavía no subió videos.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
