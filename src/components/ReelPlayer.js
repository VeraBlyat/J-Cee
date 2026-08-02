"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/apiBase";

// Reproductor para un solo reel. Distinto del VideoPlayer de la página de
// video: sin controles a la vista, en loop, y arranca silenciado porque los
// navegadores bloquean el autoplay con sonido.
//
// La clave está en `active`: sólo el reel visible carga hls.js y reproduce.
// Sin eso, un feed de 10 reels abriría 10 instancias de hls.js bajando
// segmentos en paralelo, y cada segmento dispara un FFmpeg en el backend.
export default function ReelPlayer({ videoId, active, muted, onToggleMute }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [paused, setPaused] = useState(false);

  // Espejo del estado en refs, para poder consultarlo desde los listeners del
  // <video> sin re-suscribirlos en cada cambio.
  const wantsToPlay = useRef(false);
  useEffect(() => {
    wantsToPlay.current = active && !paused;
  }, [active, paused]);

  // Carga y descarga el stream según el reel esté a la vista o no.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Al salir de pantalla liberamos todo: hls.js sigue bajando segmentos en
    // segundo plano si no se lo destruye.
    if (!active) {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
      return;
    }

    let cancelled = false;
    const src = `${API_URL}/videos/${videoId}/hls/master.m3u8`;

    async function setup() {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        return;
      }

      const { default: Hls } = await import("hls.js");
      if (cancelled || !Hls.isSupported()) return;

      const hls = new Hls({ fragLoadingTimeOut: 30000 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
    }

    setup();

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [videoId, active]);

  // Arranca en cuanto hay algo que reproducir. Se engancha al evento del
  // <video> en vez de a un estado "ready" propio: el navegador ya avisa
  // cuándo puede reproducir, no hace falta duplicar ese dato en React.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onCanPlay = () => {
      if (wantsToPlay.current) video.play().catch(() => {});
    };
    video.addEventListener("canplay", onCanPlay);
    return () => video.removeEventListener("canplay", onCanPlay);
  }, []);

  // Reproduce o pausa según corresponda.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (active && !paused) {
      // El play() puede ser rechazado (por ejemplo si el usuario ya scrolleó
      // a otro reel): no es un error que valga la pena mostrar.
      video.play().catch(() => {});
    } else {
      video.pause();
      // Al salir de pantalla lo dejamos en el principio, así al volver
      // arranca de cero en vez de retomar por la mitad.
      if (!active) video.currentTime = 0;
    }
  }, [active, paused]);

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        muted={muted}
        loop
        playsInline
        onClick={() => setPaused((v) => !v)}
        className="h-full w-full cursor-pointer object-contain"
      />

      {/* Ícono de pausa, sólo cuando el usuario pausó a propósito */}
      {active && paused && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-black/50">
            <svg viewBox="0 0 24 24" fill="white" className="ml-1 h-7 w-7" aria-hidden="true">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
            </svg>
          </span>
        </div>
      )}

      <button
        onClick={onToggleMute}
        aria-label={muted ? "Activar sonido" : "Silenciar"}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
          <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
          {muted ? (
            <>
              <line x1="17" y1="9" x2="22" y2="15" />
              <line x1="22" y1="9" x2="17" y2="15" />
            </>
          ) : (
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          )}
        </svg>
      </button>
    </div>
  );
}
