"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import http from "@/lib/http";
import ReelPlayer from "@/components/ReelPlayer";

const PAGE_SIZE = 10;

// Marco de teléfono con el reel adentro, como en los mockups: el contenido
// vertical se lee mejor acotado que ocupando una pantalla ancha entera.
function ReelStage({ reel, index, total, muted, onToggleMute }) {
  return (
    <div className="relative h-[570px] w-[300px] shrink-0 overflow-hidden rounded-[40px] bg-[#0b1a08] shadow-[0_24px_60px_rgba(0,0,0,0.5),0_0_0_8px_#111]">
      <ReelPlayer
        videoId={reel.id}
        active
        muted={muted}
        onToggleMute={onToggleMute}
      />

      {/* Barritas de progreso: una por reel de la tanda */}
      <div className="pointer-events-none absolute inset-x-3.5 top-4 z-[4] flex gap-[5px]">
        {Array.from({ length: Math.min(total, 12) }).map((_, i) => (
          <span
            key={i}
            className={`h-[2px] flex-1 rounded ${
              i < index ? "bg-white" : i === index ? "bg-white/80" : "bg-white/35"
            }`}
          />
        ))}
      </div>

      {/* Pie con autor, título y hashtags */}
      <div className="pointer-events-none absolute bottom-[22px] left-3.5 right-[66px] z-[3] text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.7)]">
        {reel.username && (
          <Link
            href={`/canal/${encodeURIComponent(reel.username)}`}
            className="pointer-events-auto mb-1.5 flex items-center gap-[7px] font-display text-[13.5px] font-bold hover:underline"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full border-[1.5px] border-white bg-gradient-to-br from-brand-2 to-brand-3 text-[10px]">
              {reel.username.charAt(0).toUpperCase()}
            </span>
            @{reel.username}
          </Link>
        )}

        <Link
          href={`/videos/${reel.id}`}
          className="pointer-events-auto block text-[12.5px] leading-snug opacity-95 hover:underline"
        >
          {reel.title}
        </Link>

        {reel.hashtags?.length > 0 && (
          <div className="pointer-events-auto mt-1 flex flex-wrap gap-x-2 text-[11.5px] opacity-80">
            {reel.hashtags.map((tag) => (
              <Link key={tag} href={`/?hashtag=${encodeURIComponent(tag)}`} className="hover:underline">
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Acciones laterales */}
      <div className="absolute bottom-7 right-3 z-[3] flex flex-col items-center gap-5 text-white">
        <Link href={`/videos/${reel.id}`} className="flex flex-col items-center gap-1">
          <span className="grid h-[42px] w-[42px] place-items-center rounded-full bg-white/[0.14] backdrop-blur-sm transition hover:bg-white/25">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.9-5a8.2 8.2 0 0 1-.9-3.7 8.4 8.4 0 0 1 9-8.3 8.4 8.4 0 0 1 8 7.5Z" />
            </svg>
          </span>
          <span className="font-mono text-[10px]">{reel.comment_count ?? 0}</span>
        </Link>
      </div>
    </div>
  );
}

// Tarjeta de la cola lateral.
function ReelCard({ reel, active, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full gap-2.5 rounded-card border-[1.5px] p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-jc ${
        active ? "border-brand bg-surface" : "border-border bg-card"
      }`}
    >
      <div className="relative aspect-[9/16] w-[60px] shrink-0 overflow-hidden rounded-field bg-brand-4">
        {reel.thumbnail_path ? (
          // eslint-disable-next-line @next/next/no-img-element -- servida por el backend
          <img src={reel.thumbnail_path} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : null}
        <span className="absolute inset-0 grid place-items-center bg-black/20 text-white">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
          </svg>
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="mb-1 line-clamp-2 text-[12.5px] font-semibold leading-[1.35] text-text">
          {reel.title}
        </p>
        <p className="text-[11px] text-muted">@{reel.username || "anónimo"}</p>
      </div>
    </button>
  );
}

export default function ReelsFeed({ initialReels }) {
  const [reels, setReels] = useState(initialReels);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(false);
  // Cuando el backend devuelve menos de una página, ya no hay más.
  const [hasMore, setHasMore] = useState(initialReels.length >= PAGE_SIZE);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const { data } = await http.get("/videos/reels", {
        params: { limit: PAGE_SIZE, offset: reels.length },
      });
      setReels((prev) => [...prev, ...data]);
      if (data.length < PAGE_SIZE) setHasMore(false);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, reels.length]);

  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  // Al acercarse al final de la cola pedimos la página siguiente, para que
  // pasar al reel que sigue nunca se frene esperando la respuesta.
  function select(index) {
    setActiveIndex(index);
    if (index >= reels.length - 3) loadMoreRef.current();
  }

  // Flechas para pasar de reel sin usar el mouse.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        setActiveIndex((i) => {
          const next = Math.min(i + 1, reels.length - 1);
          if (next >= reels.length - 3) loadMoreRef.current();
          return next;
        });
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reels.length]);

  if (reels.length === 0) {
    return (
      <div className="scales grid min-h-[420px] place-items-center rounded-panel border border-border bg-surface text-center">
        <div className="px-6">
          <p className="font-display text-[17px] font-bold text-text">
            Todavía no hay reels
          </p>
          <p className="mt-1.5 text-[13px] text-muted">
            Subí un video vertical de menos de 90 segundos y aparece acá.
          </p>
          <Link
            href="/upload"
            className="mt-5 inline-block rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-brand-2"
          >
            Subir video
          </Link>
        </div>
      </div>
    );
  }

  const active = reels[activeIndex];

  return (
    <div className="flex flex-wrap items-start justify-center gap-12">
      <ReelStage
        key={active.id}
        reel={active}
        index={activeIndex}
        total={reels.length}
        muted={muted}
        onToggleMute={() => setMuted((v) => !v)}
      />

      <div className="w-[320px] max-w-full">
        <h2 className="mb-3.5 flex items-center gap-2 font-display text-[15px] font-bold text-text">
          <span className="h-[7px] w-[7px] rounded-full bg-brand" />
          En cola
        </h2>

        <div className="flex max-h-[570px] flex-col gap-2.5 overflow-y-auto pr-1">
          {reels.map((reel, index) => (
            <ReelCard
              key={reel.id}
              reel={reel}
              active={index === activeIndex}
              onSelect={() => select(index)}
            />
          ))}

          {loading && (
            <p className="py-3 text-center text-[13px] text-muted">Cargando…</p>
          )}
        </div>
      </div>
    </div>
  );
}
