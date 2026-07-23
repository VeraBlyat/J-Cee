"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import http from "@/lib/http";

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit() {
    setError("");
    if (!title.trim() || !file) {
      setError("Faltan el título o el archivo de video.");
      return;
    }

    // FormData nos permite enviar el archivo junto con los datos de texto.
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("file", file);

    setLoading(true);
    try {
      const { data } = await http.post("/videos", formData);
      router.push(`/videos/${data.id}`); // vamos directo al video recién subido
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo subir el video.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Subir un video</h1>

      <div className="space-y-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción (opcional)"
          rows={4}
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2"
        />
        <input
          type="file"
          accept="video/mp4,video/*"
          onChange={(e) => setFile(e.target.files[0])}
          className="w-full text-sm text-gray-300"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-red-600 hover:bg-red-500 rounded px-4 py-2 font-medium disabled:opacity-50"
        >
          {loading ? "Subiendo..." : "Subir video"}
        </button>
      </div>
    </div>
  );
}
