"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import http from "@/lib/http";

const MAX_HASHTAGS = 10;
const MAX_TITLE = 100;

// Misma normalización que hace el backend, para previsualizar los chips.
// El backend la vuelve a aplicar: esto es sólo para que se vea qué se va a
// guardar, nunca la validación de verdad.
function parseHashtags(input) {
  const seen = new Set();
  for (const raw of input.split(/[\s,]+/)) {
    const tag = raw
      .trim()
      .toLowerCase()
      .replace(/^#+/, "")
      .replace(/[^\p{L}\p{N}_-]/gu, "");
    if (!tag || tag.length > 50) continue;
    seen.add(tag);
    if (seen.size >= MAX_HASHTAGS) break;
  }
  return [...seen];
}

function formatBytes(bytes) {
  if (!bytes) return "";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

const FIELD =
  "focus-glow w-full rounded-field border-[1.5px] border-border bg-card px-3.5 py-3 text-[13.5px] text-text outline-none transition placeholder:text-muted";

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [file, setFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef(null);
  const router = useRouter();

  const tags = parseHashtags(hashtags);

  // La vista previa se DERIVA del archivo elegido, no es estado propio: si
  // fuera estado habría que setearlo desde un efecto y eso encadena renders.
  const thumbnailPreview = useMemo(
    () => (thumbnail ? URL.createObjectURL(thumbnail) : ""),
    [thumbnail]
  );

  // El object URL hay que liberarlo o el blob se queda en memoria hasta que
  // se recargue la página.
  useEffect(() => {
    if (!thumbnailPreview) return;
    return () => URL.revokeObjectURL(thumbnailPreview);
  }, [thumbnailPreview]);

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    // Sólo aceptamos videos: soltar un PDF acá sería un error silencioso.
    if (dropped?.type.startsWith("video/")) setFile(dropped);
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    setError("");
    if (!title.trim() || !file) {
      setError("Faltan el título o el archivo de video.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("hashtags", hashtags);
    formData.append("file", file);
    if (thumbnail) formData.append("thumbnail", thumbnail);

    setLoading(true);
    setProgress(0);
    try {
      const { data } = await http.post("/videos", formData, {
        // Los videos pesan: sin una barra, la subida parece colgada.
        onUploadProgress: (ev) => {
          if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100));
        },
      });
      router.push(`/videos/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo subir el video.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-7 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="min-w-0">
        <h1 className="mb-1 font-display text-[22px] font-extrabold text-text">
          Subir un video
        </h1>
        <p className="mb-[22px] text-[13px] text-muted">
          Compartí tu proyecto con la comunidad de J-Cee.
        </p>

        {/* Dropzone */}
        {!file ? (
          <div
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`mb-[22px] flex cursor-pointer flex-col items-center justify-center rounded-panel border-2 border-dashed px-6 py-12 text-center transition ${
              dragging
                ? "border-brand bg-surface shadow-[0_0_0_4px_var(--jc-glow)]"
                : "border-border-strong bg-card hover:border-brand hover:bg-surface"
            }`}
          >
            <svg viewBox="0 0 24 24" className="mb-3 h-9 w-9 text-brand" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
            <p className="mb-1.5 font-display text-base font-bold text-text">
              Arrastrá tu video acá
            </p>
            <p className="mb-[18px] text-[12.5px] text-muted">
              MP4, MOV o WebM · hasta 500 MB
            </p>
            <span className="rounded-full bg-brand px-[22px] py-2.5 text-[13px] font-bold text-white transition hover:bg-brand-2">
              Buscar archivo
            </span>
          </div>
        ) : (
          <div className="mb-[22px] flex items-center gap-3.5 rounded-card border border-border bg-card p-3.5">
            <div className="grid aspect-[16/10] w-24 shrink-0 place-items-center overflow-hidden rounded-field bg-brand-4 text-brand-2">
              {thumbnailPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- blob local; next/image no maneja object URLs
                <img src={thumbnailPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                </svg>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="mb-1 truncate text-[13.5px] font-bold text-text">
                {file.name}
              </p>
              <p className="mb-2 text-xs text-muted">{formatBytes(file.size)}</p>

              {loading && (
                <>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-brand-3 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] text-muted">
                    {progress < 100 ? `Subiendo… ${progress}%` : "Procesando el video…"}
                  </p>
                </>
              )}
            </div>

            {!loading && (
              <button
                type="button"
                onClick={() => setFile(null)}
                aria-label="Quitar archivo"
                className="shrink-0 text-muted opacity-70 transition hover:text-red-500 hover:opacity-100"
              >
                ✕
              </button>
            )}
          </div>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="video/mp4,video/*"
          onChange={(e) => setFile(e.target.files[0])}
          className="hidden"
        />

        {/* Campos */}
        <div className="mb-[18px]">
          <label htmlFor="title" className="mb-1.5 block text-xs font-semibold text-text">
            Título
          </label>
          <input
            id="title"
            value={title}
            maxLength={MAX_TITLE}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Cómo montar un backend con Nest.js"
            className={FIELD}
          />
          <p className="mt-1 text-right font-mono text-[10.5px] text-muted">
            {title.length}/{MAX_TITLE}
          </p>
        </div>

        <div className="mb-[18px]">
          <label htmlFor="description" className="mb-1.5 block text-xs font-semibold text-text">
            Descripción <span className="font-normal text-muted">(opcional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contá de qué se trata el video…"
            className={`${FIELD} min-h-[82px] resize-y`}
          />
        </div>

        <div className="mb-[18px]">
          <label htmlFor="hashtags" className="mb-1.5 block text-xs font-semibold text-text">
            Hashtags <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            id="hashtags"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#nextjs #nestjs #postgres"
            className={FIELD}
          />
          {tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-brand"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-muted">
              Separalos con espacios o comas. Hasta {MAX_HASHTAGS}.
            </p>
          )}
        </div>

        <div className="mb-[18px]">
          <label htmlFor="thumbnail" className="mb-1.5 block text-xs font-semibold text-text">
            Miniatura <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            id="thumbnail"
            type="file"
            accept="image/*"
            onChange={(e) => setThumbnail(e.target.files[0])}
            className="w-full text-[13px] text-muted file:mr-3 file:rounded-field file:border-0 file:bg-brand-4 file:px-3.5 file:py-2 file:text-[13px] file:font-semibold file:text-text hover:file:bg-brand-3"
          />
          <p className="mt-1.5 text-[11px] text-muted">
            Si no subís ninguna, se toma un fotograma del video.
          </p>
        </div>

        {error && <p className="mb-4 text-[13px] text-red-600">{error}</p>}

        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex-1 rounded-full border-[1.5px] border-border py-3 text-[13.5px] font-bold text-text transition hover:border-brand-3 hover:text-brand"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-[2] rounded-full bg-brand py-3 text-[13.5px] font-bold text-white transition hover:-translate-y-px hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Subiendo…" : "Publicar"}
          </button>
        </div>
      </div>

      {/* Panel de ayuda */}
      <aside className="h-fit rounded-panel border border-border bg-card p-5">
        <h2 className="mb-3.5 font-display text-sm font-bold text-text">
          Consejos para tu video
        </h2>

        {[
          ["🎬", "Grabá en 1080p o más. El sistema genera las calidades más bajas solo, así que no hace falta que subas nada comprimido."],
          ["🏷️", "Usá hashtags concretos (#nextjs mejor que #programación). Es cómo te encuentran."],
          ["📱", "¿Video vertical de menos de 90 segundos? Aparece automáticamente en la sección de Reels."],
          ["🖼️", "La miniatura se genera sola, pero una propia siempre rinde mejor."],
        ].map(([icon, text]) => (
          <div key={text} className="mb-4 flex gap-3 last:mb-0">
            <span className="mt-px shrink-0 text-lg">{icon}</span>
            <p className="text-[13px] leading-relaxed text-muted">{text}</p>
          </div>
        ))}
      </aside>
    </form>
  );
}
