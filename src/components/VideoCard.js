import Link from "next/link";

// Formatea la duración para el badge de la esquina: 1:05, 12:30, 1:02:45.
function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return h > 0
    ? `${h}:${mm}:${String(s).padStart(2, "0")}`
    : `${mm}:${String(s).padStart(2, "0")}`;
}

export default function VideoCard({ video }) {
  const duration = formatDuration(video.duration_seconds);

  return (
    <Link
      href={`/videos/${video.id}`}
      className="group block overflow-hidden rounded-card border border-border bg-card shadow-jc transition duration-200 hover:-translate-y-1 hover:border-brand-3 hover:shadow-jc-lg"
    >
      <div className="relative aspect-[16/9.5] overflow-hidden bg-brand-4">
        {video.thumbnail_path ? (
          // La miniatura se genera al subir (o la sube el usuario). Antes acá
          // había un <video> apuntando al MP4 completo: la grilla del inicio
          // bajaba todos los videos enteros para mostrar un cuadrito.
          // eslint-disable-next-line @next/next/no-img-element -- servida por el backend, sin loader de next/image
          <img
            src={video.thumbnail_path}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          // Videos subidos antes de que existieran las miniaturas.
          <div className="grid h-full w-full place-items-center text-brand-2">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden="true">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
            </svg>
          </div>
        )}

        {duration && (
          <span className="absolute bottom-[7px] right-[7px] rounded px-1.5 py-0.5 font-mono text-[10px] tracking-[0.02em] text-white bg-black/80">
            {duration}
          </span>
        )}
      </div>

      <div className="flex gap-2.5 px-3 pb-3.5 pt-2.5">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-2 to-brand-3 font-display text-[11px] font-bold text-white">
          {(video.username || "?").charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0">
          <h3 className="mb-1 line-clamp-2 text-[13px] font-semibold leading-[1.35] text-text">
            {video.title}
          </h3>
          <p className="text-[11px] text-muted">{video.username || "Anónimo"}</p>
        </div>
      </div>
    </Link>
  );
}
