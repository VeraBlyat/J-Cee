import { render, screen } from "@testing-library/react";
import VideoCard from "./VideoCard";

describe("VideoCard", () => {
  it("muestra el título y el link al video", () => {
    render(
      <VideoCard
        video={{ id: 42, title: "Mi video", file_path: "/uploads/a.mp4", username: "toby" }}
      />
    );

    expect(screen.getByText("Mi video")).toBeInTheDocument();
    expect(screen.getByText("toby")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/videos/42");
  });

  it("muestra 'Anónimo' cuando el video no tiene usuario", () => {
    render(
      <VideoCard video={{ id: 1, title: "Sin autor", file_path: "/uploads/b.mp4", username: null }} />
    );

    expect(screen.getByText("Anónimo")).toBeInTheDocument();
  });

  it("usa la miniatura en vez de descargar el video", () => {
    render(
      <VideoCard
        video={{
          id: 7,
          title: "Con miniatura",
          file_path: "/uploads/c.mp4",
          thumbnail_path: "/uploads/c.mp4.thumb.jpg",
          username: "ana",
        }}
      />
    );

    // alt="" a propósito: la miniatura es decorativa porque el título va al
    // lado, así que no expone rol "img" y hay que buscarla por el DOM.
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "/uploads/c.mp4.thumb.jpg"
    );
    // Lo importante es que NO haya un <video>: antes la grilla bajaba los
    // archivos completos sólo para mostrar un fotograma.
    expect(document.querySelector("video")).toBeNull();
  });

  it("cae a un ícono si el video no tiene miniatura", () => {
    render(
      <VideoCard
        video={{ id: 8, title: "Sin miniatura", file_path: "/uploads/d.mp4", username: "ana" }}
      />
    );

    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("video")).toBeNull();
  });

  it("muestra la duración formateada", () => {
    render(
      <VideoCard
        video={{
          id: 9,
          title: "Largo",
          file_path: "/uploads/e.mp4",
          duration_seconds: 3765, // 1:02:45
          username: "ana",
        }}
      />
    );

    expect(screen.getByText("1:02:45")).toBeInTheDocument();
  });

  it("no muestra badge de duración si no la conoce", () => {
    render(
      <VideoCard video={{ id: 10, title: "Viejo", file_path: "/uploads/f.mp4", username: "ana" }} />
    );

    expect(screen.queryByText(/^\d+:\d{2}/)).toBeNull();
  });
});
