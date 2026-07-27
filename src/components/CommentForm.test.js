import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommentForm from "./CommentForm";
import http from "../lib/http";

// El formulario ahora habla con el backend vía el cliente Axios (lib/http),
// así que mockeamos ese módulo en vez de global.fetch. Usamos ruta relativa
// porque el alias "@/" no resuelve dentro de jest.mock; igual apunta al mismo
// archivo que el import "@/lib/http" del componente, así que el mock aplica.
jest.mock("../lib/http", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

describe("CommentForm", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    http.post.mockReset();
    http.post.mockResolvedValue({ data: {} });
  });

  it("no envía nada si el comentario está vacío", async () => {
    render(<CommentForm videoId={1} />);
    await userEvent.click(screen.getByRole("button", { name: "Comentar" }));

    expect(http.post).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("envía el comentario, limpia el input y refresca", async () => {
    render(<CommentForm videoId={7} />);
    const input = screen.getByPlaceholderText("Escribe un comentario...");

    await userEvent.type(input, "Buen video!");
    await userEvent.click(screen.getByRole("button", { name: "Comentar" }));

    expect(http.post).toHaveBeenCalledWith("/comments", {
      videoId: 7,
      content: "Buen video!",
    });
    expect(input).toHaveValue("");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
