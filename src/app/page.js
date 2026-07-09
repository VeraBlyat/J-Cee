import { query } from "@/lib/db";
import VideoCard from "@/components/VideoCard";

// Forzamos render dinámico para que la lista se actualice al subir videos.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Este componente corre en el SERVIDOR, así que puede consultar la BD directo.
  const result = await query(
    `SELECT v.id, v.title, v.file_path, u.username
       FROM videos v
       LEFT JOIN users u ON u.id = v.user_id
      ORDER BY v.created_at DESC`
  );
  const videos = result.rows;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Videos recientes</h1>

      {videos.length === 0 ? (
        <p className="text-gray-400">
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
