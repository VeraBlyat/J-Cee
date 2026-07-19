import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommentForm from "./CommentForm";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

describe("CommentForm", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  it("no envía nada si el comentario está vacío", async () => {
    render(<CommentForm videoId={1} />);
    await userEvent.click(screen.getByRole("button", { name: "Comentar" }));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("envía el comentario, limpia el input y refresca", async () => {
    render(<CommentForm videoId={7} />);
    const input = screen.getByPlaceholderText("Escribe un comentario...");

    await userEvent.type(input, "Buen video!");
    await userEvent.click(screen.getByRole("button", { name: "Comentar" }));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/comments"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ videoId: 7, content: "Buen video!" }),
      })
    );
    expect(input).toHaveValue("");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
