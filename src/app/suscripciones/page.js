import { serverFetch, getCurrentUser } from "@/lib/api";
import VideoCard from "@/components/VideoCard";
import SectionTitle from "@/components/SectionTitle";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  // El feed es personal: sin sesión no hay nada que mostrar.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [feedRes, channelsRes] = await Promise.all([
    serverFetch("/subscriptions/feed"),
    serverFetch("/subscriptions"),
  ]);

  const videos = feedRes.ok ? await feedRes.json() : [];
  const channels = channelsRes.ok ? await channelsRes.json() : [];

  return (
    <div>
      <SectionTitle>Tus suscripciones</SectionTitle>

      {channels.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {channels.map((channel) => (
            <Link
              key={channel.id}
              href={`/canal/${encodeURIComponent(channel.username)}`}
              className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-4 text-[13px] font-semibold text-text transition hover:border-brand-3 hover:bg-surface"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-3 font-display text-[11px] font-bold text-white">
                {channel.username.charAt(0).toUpperCase()}
              </span>
              @{channel.username}
            </Link>
          ))}
        </div>
      )}

      {videos.length === 0 ? (
        <div className="scales grid min-h-[280px] place-items-center rounded-panel border border-border bg-surface text-center">
          <div className="px-6">
            <p className="font-display text-[17px] font-bold text-text">
              {channels.length === 0
                ? "Todavía no seguís ningún canal"
                : "Sin videos nuevos"}
            </p>
            <p className="mt-1.5 text-[13px] text-muted">
              {channels.length === 0
                ? "Suscribite a alguno para ver sus videos acá."
                : "Los canales que seguís todavía no subieron videos."}
            </p>
            {channels.length === 0 && (
              <Link
                href="/"
                className="mt-5 inline-block rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-brand-2"
              >
                Explorar videos
              </Link>
            )}
          </div>
        </div>
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
