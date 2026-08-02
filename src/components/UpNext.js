import Link from "next/link";
import { serverFetch } from "@/lib/api";

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

// Barra lateral "A continuación". Componente de servidor: no necesita
// interactividad, así que se resuelve junto con la página.
export default async function UpNext({ currentId }) {
  const res = await serverFetch("/videos");
  const todos = res.ok ? await res.json() : [];

  // Sin el video que se está viendo, y sólo los primeros: es una sugerencia,
  // no un catálogo.
  const videos = todos.filter((v) => v.id !== currentId).slice(0, 8);

  if (videos.length === 0) return null;

  return (
    <aside className="min-w-0">
      <h2 className="mb-3.5 border-b border-border pb-2.5 font-display text-sm font-bold text-text">
        A continuación
      </h2>

      <ul>
        {videos.map((video) => {
          const duration = formatDuration(video.duration_seconds);

          return (
            <li key={video.id}>
              <Link
                href={`/videos/${video.id}`}
                className="mb-3.5 flex gap-2.5 rounded-field p-2 transition hover:bg-surface"
              >
                <div className="relative aspect-[16/10] w-[110px] shrink-0 overflow-hidden rounded-field bg-brand-4">
                  {video.thumbnail_path ? (
                    // eslint-disable-next-line @next/next/no-img-element -- servida por el backend
                    <img
                      src={video.thumbnail_path}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-brand-2">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                        <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                      </svg>
                    </div>
                  )}

                  {duration && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-px font-mono text-[9px] text-white">
                      {duration}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="mb-1 line-clamp-2 text-[12.5px] font-semibold leading-[1.35] text-text">
                    {video.title}
                  </p>
                  <p className="text-[10.5px] text-muted">
                    {video.username || "Anónimo"}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
