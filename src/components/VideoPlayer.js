"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/apiBase";

// Reproductor propio: <video> nativo (sin el atributo controls) manejado por
// hls.js, con nuestros propios controles encima.
//
// hls.js hace de puente entre las playlists m3u8 y el navegador: baja los
// segmentos, los mete en un MediaSource y decide qué calidad pedir según el
// ancho de banda que va midiendo. Safari es el caso especial: reproduce HLS
// de forma nativa, así que ahí no hace falta la librería.

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return h > 0
    ? `${h}:${mm}:${String(s).padStart(2, "0")}`
    : `${mm}:${String(s).padStart(2, "0")}`;
}

function PlayIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function PauseIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" />
    </svg>
  );
}

function VolumeIcon({ muted, className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      {muted ? (
        <>
          <line x1="17" y1="9" x2="22" y2="15" />
          <line x1="22" y1="9" x2="17" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

function FullscreenIcon({ active, className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {active ? (
        <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      ) : (
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      )}
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10 animate-spin text-white" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
        fill="none" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3"
        fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function VideoPlayer({ videoId, title, className = "" }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const hideControlsTimer = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Calidades: las llena hls.js al parsear el master. -1 es "automática".
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);

  const src = `${API_URL}/videos/${videoId}/hls/master.m3u8`;

  // --- Carga del stream ---------------------------------------------------

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    async function setup() {
      // Safari reproduce HLS por su cuenta; meterle hls.js encima es peor.
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        return;
      }

      // Import dinámico: hls.js pesa bastante y no hace falta en el bundle
      // inicial ni en el render del servidor.
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;

      if (!Hls.isSupported()) {
        setError("Tu navegador no puede reproducir este video.");
        return;
      }

      const hls = new Hls({
        // Los segmentos se generan al vuelo en el backend, así que el primero
        // de cada calidad tarda más que uno ya cacheado. Damos margen antes de
        // dar por perdida una petición.
        fragLoadingTimeOut: 30000,
        manifestLoadingTimeOut: 20000,
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
        if (cancelled) return;
        setLevels(data.levels.map((l, i) => ({ index: i, height: l.height })));
      });

      // Cuando está en automático, avisamos qué calidad eligió sola.
      hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => {
        if (!cancelled && hls.autoLevelEnabled) setCurrentLevel(-1);
        else if (!cancelled) setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (cancelled || !data.fatal) return;

        // Los errores fatales de red y de media suelen ser recuperables:
        // hls.js puede reintentar el fragmento o resetear el decoder.
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          setError("No se pudo cargar el video.");
          hls.destroy();
        }
      });

      hls.loadSource(src);
      hls.attachMedia(video);
    }

    setup();

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src]);

  // --- Estado del <video> -------------------------------------------------

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      setCurrent(video.currentTime);
      // Hasta dónde tiene descargado por delante: es la franja clara de la
      // barra de progreso.
      const ranges = video.buffered;
      for (let i = 0; i < ranges.length; i++) {
        if (ranges.start(i) <= video.currentTime && video.currentTime <= ranges.end(i)) {
          setBuffered(ranges.end(i));
          break;
        }
      }
    };
    const onDuration = () => setDuration(video.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onVolume = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("progress", onTime);
    video.addEventListener("durationchange", onDuration);
    video.addEventListener("loadedmetadata", onDuration);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onPlaying);
    video.addEventListener("volumechange", onVolume);

    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("progress", onTime);
      video.removeEventListener("durationchange", onDuration);
      video.removeEventListener("loadedmetadata", onDuration);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onPlaying);
      video.removeEventListener("volumechange", onVolume);
    };
  }, []);

  useEffect(() => {
    const onFsChange = () =>
      setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // --- Acciones -----------------------------------------------------------

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  const seekTo = useCallback((seconds) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(Math.max(seconds, 0), video.duration);
  }, []);

  const skip = useCallback(
    (delta) => seekTo((videoRef.current?.currentTime || 0) + delta),
    [seekTo]
  );

  const changeVolume = useCallback((value) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.min(Math.max(value, 0), 1);
    video.muted = video.volume === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen?.();
  }, []);

  const pickLevel = useCallback((index) => {
    // -1 le devuelve el control a hls.js para que elija según el ancho de banda.
    if (hlsRef.current) hlsRef.current.currentLevel = index;
    setCurrentLevel(index);
    setMenuOpen(false);
  }, []);

  // --- Auto-ocultar controles --------------------------------------------

  // Sólo se esconden mientras reproduce y con el menú cerrado; en pausa
  // quedan siempre a la vista (lo resuelve el `|| !playing` del render).
  const scheduleHide = useCallback(() => {
    clearTimeout(hideControlsTimer.current);
    if (playing && !menuOpen) {
      hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 2800);
    }
  }, [playing, menuOpen]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  // Al arrancar o pausar cambia si corresponde esconderlos, así que
  // reprogramamos el temporizador. El setState ocurre dentro del timeout, no
  // en el cuerpo del efecto.
  useEffect(() => {
    scheduleHide();
    return () => clearTimeout(hideControlsTimer.current);
  }, [scheduleHide]);

  // --- Atajos de teclado --------------------------------------------------

  function onKeyDown(e) {
    // Si el foco está en un control propio (slider, botón), dejamos que ese
    // control maneje la tecla en vez de robársela.
    if (e.target !== e.currentTarget) return;

    const actions = {
      " ": togglePlay,
      k: togglePlay,
      ArrowRight: () => skip(5),
      ArrowLeft: () => skip(-5),
      ArrowUp: () => changeVolume((videoRef.current?.volume || 0) + 0.1),
      ArrowDown: () => changeVolume((videoRef.current?.volume || 0) - 0.1),
      m: toggleMute,
      f: toggleFullscreen,
    };

    const action = actions[e.key];
    if (action) {
      e.preventDefault();
      action();
      revealControls();
    }
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const levelLabel =
    currentLevel === -1
      ? "Auto"
      : `${levels.find((l) => l.index === currentLevel)?.height ?? ""}p`;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseMove={revealControls}
      onMouseLeave={() => playing && !menuOpen && setControlsVisible(false)}
      className={`group relative aspect-video w-full overflow-hidden rounded-lg bg-black outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
    >
      <video
        ref={videoRef}
        onClick={togglePlay}
        playsInline
        className="h-full w-full cursor-pointer"
        aria-label={title}
      />

      {/* Estado de carga */}
      {buffering && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Spinner />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-4 text-center">
          <p className="text-sm text-white">{error}</p>
        </div>
      )}

      {/* Botón grande de play, sólo con el video pausado */}
      {!playing && !buffering && !error && (
        <button
          onClick={togglePlay}
          aria-label="Reproducir"
          className="absolute inset-0 grid place-items-center"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand/90 text-white shadow-lg transition hover:scale-105 hover:bg-brand">
            <PlayIcon className="ml-1 h-7 w-7" />
          </span>
        </button>
      )}

      {/* Barra de controles */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-8 transition-opacity duration-200 ${
          controlsVisible || !playing ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Progreso */}
        <div className="relative mb-1 h-4 w-full">
          {/* Franja de lo ya descargado */}
          <div className="pointer-events-none absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white/40"
              style={{ width: `${bufferedPct}%` }}
            />
          </div>
          {/* Franja reproducida */}
          <div
            className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand"
            style={{ width: `${progress}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="any"
            value={current}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label="Progreso del video"
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent
                       [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-brand
                       [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3
                       [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0
                       [&::-moz-range-thumb]:bg-brand"
          />
        </div>

        <div className="flex items-center gap-3 text-white">
          <button onClick={togglePlay} aria-label={playing ? "Pausar" : "Reproducir"}
            className="rounded p-1 transition hover:text-brand">
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>

          {/* Volumen */}
          <div className="flex items-center gap-1.5">
            <button onClick={toggleMute} aria-label={muted ? "Activar sonido" : "Silenciar"}
              className="rounded p-1 transition hover:text-brand">
              <VolumeIcon muted={muted || volume === 0} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volumen"
              className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/30 accent-[var(--jc-brand)]
                         [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-page"
            />
          </div>

          <span className="text-xs tabular-nums">
            {formatTime(current)} / {formatTime(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            {/* Selector de calidad: sólo con hls.js, porque en Safari la
                elección la maneja el sistema y no la podemos forzar. */}
            {levels.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Calidad"
                  aria-expanded={menuOpen}
                  className="rounded px-2 py-1 text-xs font-medium transition hover:text-brand"
                >
                  {levelLabel}
                </button>

                {menuOpen && (
                  <ul className="absolute bottom-full right-0 mb-2 min-w-[7rem] overflow-hidden rounded-lg bg-card py-1 text-text shadow-xl">
                    <li>
                      <button
                        onClick={() => pickLevel(-1)}
                        className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-page ${
                          currentLevel === -1 ? "font-semibold text-brand" : ""
                        }`}
                      >
                        Auto
                      </button>
                    </li>
                    {[...levels].reverse().map((level) => (
                      <li key={level.index}>
                        <button
                          onClick={() => pickLevel(level.index)}
                          className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-page ${
                            currentLevel === level.index ? "font-semibold text-brand" : ""
                          }`}
                        >
                          {level.height}p
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button onClick={toggleFullscreen}
              aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              className="rounded p-1 transition hover:text-brand">
              <FullscreenIcon active={fullscreen} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
