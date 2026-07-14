import Link from "next/link";
import { API_URL } from "@/lib/apiBase";

export default function VideoCard({ video }) {
  return (
    <Link href={`/videos/${video.id}`} className="group block">
      <div className="aspect-video bg-black rounded-lg overflow-hidden">
        {/* Truco simple para la miniatura: mostramos un frame del propio video.
            El "#t=0.5" le pide al navegador el fotograma del segundo 0.5. */}
        <video
          src={`${API_URL}${video.file_path}#t=0.5`}
          className="w-full h-full object-cover"
          preload="metadata"
          muted
        />
      </div>
      <h3 className="mt-2 font-medium group-hover:text-red-400 line-clamp-2">
        {video.title}
      </h3>
      <p className="text-sm text-gray-400">{video.username || "Anónimo"}</p>
    </Link>
  );
}
