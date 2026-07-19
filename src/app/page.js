import { serverFetch } from "@/lib/api";
import VideoCard from "@/components/VideoCard";

// Forzamos render dinámico para que la lista se actualice al subir videos.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Este componente corre en el SERVIDOR y pide la lista al backend Nest.
  const res = await serverFetch("/videos");
  const videos = res.ok ? await res.json() : [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Videos recientes</h1>

      {videos.length === 0 ? (
        <p className="text-lpg">
          Todavía no hay videos. ¡Sé el primero en subir uno!
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
