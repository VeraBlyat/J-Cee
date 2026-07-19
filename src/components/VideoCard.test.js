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
});
