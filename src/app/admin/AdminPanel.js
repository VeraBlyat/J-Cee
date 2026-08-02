"use client";

import { useState, useEffect, useCallback } from "react";
import http from "@/lib/http";

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await http.get("/admin/users");
    setUsers(data);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount intencional, sin librería de data fetching todavía.
  useEffect(() => { load(); }, [load]);

  async function toggleAdmin(user) {
    await http.patch("/admin/users", { id: user.id, is_admin: !user.is_admin });
    load();
  }

  async function deleteUser(id) {
    if (!confirm("¿Eliminar este usuario y todo su contenido?")) return;
    await http.delete("/admin/users", { data: { id } });
    load();
  }

  if (loading) return <p className="text-muted py-4">Cargando...</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted border-b border-border">
          <th className="pb-2 pr-4">ID</th>
          <th className="pb-2 pr-4">Usuario</th>
          <th className="pb-2 pr-4">Email</th>
          <th className="pb-2 pr-4">Rol</th>
          <th className="pb-2 pr-4">Registrado</th>
          <th className="pb-2">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="border-b border-border">
            <td className="py-2 pr-4 text-muted">{u.id}</td>
            <td className="py-2 pr-4">{u.username}</td>
            <td className="py-2 pr-4 text-muted max-w-[14rem] truncate" title={u.email}>
              {u.email}
            </td>
            <td className="py-2 pr-4">
              <button
                onClick={() => toggleAdmin(u)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  u.is_admin
                    ? "bg-red-700 hover:bg-red-600 text-white"
                    : "bg-page-2 hover:bg-border text-text-2"
                }`}
              >
                {u.is_admin ? "Admin" : "User"}
              </button>
            </td>
            <td className="py-2 pr-4 text-muted">
              {new Date(u.created_at).toLocaleDateString()}
            </td>
            <td className="py-2">
              <button
                onClick={() => deleteUser(u.id)}
                className="text-xs font-medium text-red-600 transition hover:text-red-500"
              >
                Eliminar
              </button>
            </td>
          </tr>
        ))}
        {users.length === 0 && (
          <tr>
            <td colSpan={6} className="py-4 text-muted text-center">
              No hay usuarios.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function VideosTab() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await http.get("/admin/videos");
    setVideos(data);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount intencional, sin librería de data fetching todavía.
  useEffect(() => { load(); }, [load]);

  async function deleteVideo(id) {
    if (!confirm("¿Eliminar este video permanentemente?")) return;
    await http.delete("/admin/videos", { data: { id } });
    load();
  }

  if (loading) return <p className="text-muted py-4">Cargando...</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted border-b border-border">
          <th className="pb-2 pr-4">ID</th>
          <th className="pb-2 pr-4">Título</th>
          <th className="pb-2 pr-4">Subido por</th>
          <th className="pb-2 pr-4">Fecha</th>
          <th className="pb-2">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {videos.map((v) => (
          <tr key={v.id} className="border-b border-border">
            <td className="py-2 pr-4 text-muted">{v.id}</td>
            <td className="py-2 pr-4">{v.title}</td>
            <td className="py-2 pr-4 text-muted">{v.username || "—"}</td>
            <td className="py-2 pr-4 text-muted">
              {new Date(v.created_at).toLocaleDateString()}
            </td>
            <td className="py-2">
              <button
                onClick={() => deleteVideo(v.id)}
                className="text-xs font-medium text-red-600 transition hover:text-red-500"
              >
                Eliminar
              </button>
            </td>
          </tr>
        ))}
        {videos.length === 0 && (
          <tr>
            <td colSpan={5} className="py-4 text-muted text-center">
              No hay videos.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function CommentsTab() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await http.get("/admin/comments");
    setComments(data);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount intencional, sin librería de data fetching todavía.
  useEffect(() => { load(); }, [load]);

  async function deleteComment(id) {
    if (!confirm("¿Eliminar este comentario?")) return;
    await http.delete("/admin/comments", { data: { id } });
    load();
  }

  if (loading) return <p className="text-muted py-4">Cargando...</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted border-b border-border">
          <th className="pb-2 pr-4">ID</th>
          <th className="pb-2 pr-4">Comentario</th>
          <th className="pb-2 pr-4">Usuario</th>
          <th className="pb-2 pr-4">Video</th>
          <th className="pb-2 pr-4">Fecha</th>
          <th className="pb-2">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {comments.map((c) => (
          <tr key={c.id} className="border-b border-border">
            <td className="py-2 pr-4 text-muted">{c.id}</td>
            <td className="py-2 pr-4 max-w-xs">
              <span className="line-clamp-2">{c.content}</span>
            </td>
            <td className="py-2 pr-4 text-muted">{c.username || "—"}</td>
            <td className="py-2 pr-4 text-muted max-w-[10rem] truncate">
              {c.video_title || "—"}
            </td>
            <td className="py-2 pr-4 text-muted">
              {new Date(c.created_at).toLocaleDateString()}
            </td>
            <td className="py-2">
              <button
                onClick={() => deleteComment(c.id)}
                className="text-xs font-medium text-red-600 transition hover:text-red-500"
              >
                Eliminar
              </button>
            </td>
          </tr>
        ))}
        {comments.length === 0 && (
          <tr>
            <td colSpan={6} className="py-4 text-muted text-center">
              No hay comentarios.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

const TABS = [
  { id: "users", label: "Usuarios" },
  { id: "videos", label: "Videos" },
  { id: "comments", label: "Comentarios" },
];

export default function AdminPanel() {
  const [tab, setTab] = useState("users");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Panel de administración</h1>

      <div className="flex gap-2 mb-6 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === t.id
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        {tab === "users" && <UsersTab />}
        {tab === "videos" && <VideosTab />}
        {tab === "comments" && <CommentsTab />}
      </div>
    </div>
  );
}
