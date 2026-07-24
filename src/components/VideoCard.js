import Link from "next/link";

export default function VideoCard({ video }) {
  return (
    <Link href={`/videos/${video.id}`} className="group block">
      <div className="aspect-video bg-bkg rounded-lg overflow-hidden">
        {/* Truco simple para la miniatura: mostramos un frame del propio video.
            El "#t=0.5" le pide al navegador el fotograma del segundo 0.5.
            file_path ya es una ruta pública ("/uploads/..."), no necesita prefijo. */}
        <video
          src={`${video.file_path}#t=0.5`}
          className="w-full h-full object-cover"
          preload="metadata"
          muted
        />
      </div>
      <h3 className="mt-2 font-medium group-hover:text-txt line-clamp-2">
        {video.title}
      </h3>
      <p className="text-sm text-sbtxt">{video.username || "Anónimo"}</p>
    </Link>
  );
}
