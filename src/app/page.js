import { serverFetch } from "@/lib/api";
import VideoCard from "@/components/VideoCard";
import SectionTitle from "@/components/SectionTitle";
import Link from "next/link";

// Forzamos render dinámico para que la lista se actualice al subir videos.
export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }) {
  // En Next 15, searchParams es una promesa: hay que esperarla.
  const { hashtag, q } = await searchParams;

  // Este componente corre en el SERVIDOR y pide la lista al backend Nest.
  // El filtro por hashtag lo resuelve el backend con un JOIN indexado.
  const query = hashtag ? `?hashtag=${encodeURIComponent(hashtag)}` : "";
  const res = await serverFetch(`/videos${query}`);
  const todos = res.ok ? await res.json() : [];

  // La búsqueda por texto todavía se filtra acá: el backend no tiene endpoint
  // de búsqueda y no queríamos inventar la API desde el frontend.
  const termino = q?.trim().toLowerCase();
  const videos = termino
    ? todos.filter((v) => v.title.toLowerCase().includes(termino))
    : todos;

  const titulo = hashtag ? `#${hashtag}` : q ? `Resultados de "${q}"` : "Videos recientes";

  return (
    <div>
      <SectionTitle
        action={
          (hashtag || q) && (
            <Link href="/" className="text-xs font-semibold text-brand hover:underline">
              Ver todos
            </Link>
          )
        }
      >
        {titulo}
      </SectionTitle>

      {videos.length === 0 ? (
        <div className="scales grid min-h-[320px] place-items-center rounded-panel border border-border bg-surface text-center">
          <div className="px-6">
            <p className="font-display text-[17px] font-bold text-text">
              {hashtag
                ? `Todavía no hay videos con #${hashtag}`
                : q
                  ? "Sin resultados"
                  : "Todavía no hay videos"}
            </p>
            <p className="mt-1.5 text-[13px] text-muted">
              {q
                ? "Probá con otras palabras."
                : "Subí el primero y arrancamos la comunidad."}
            </p>
            {!q && !hashtag && (
              <Link
                href="/upload"
                className="mt-5 inline-block rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-brand-2"
              >
                Subir video
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
