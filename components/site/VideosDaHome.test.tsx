import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VideoDeContexto, VideoExplicativo } from "./VideosDaHome";

// A otimização de imagem não é parte do teste de reprodução.
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const textos = {
  alt: "Cena de atendimento",
  semSom: "Sem som",
  pausar: "Pausar contexto",
  tocar: "Reproduzir contexto",
  indisponivel: "Vídeo indisponível",
};
const explicacao = {
  titulo: "Conheça o produto",
  descricao: "Vídeo em português",
  fechar: "Fechar vídeo",
  legendas: "Português",
  transcricao: "Ler explicação",
  indisponivel: "Não carregou",
  paragrafo1: "Primeiro",
  paragrafo2: "Segundo",
  paragrafo3: "Terceiro",
  paragrafo4: "Quarto",
};
let entrando: (visivel: boolean) => void;
let reduzido = false;
let economia = false;
let paused = true;
let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  reduzido = false;
  economia = false;
  paused = true;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        entrando = (visivel) =>
          callback(
            [{ isIntersecting: visivel } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduzido;
    },
    addEventListener() {},
    removeEventListener() {},
  }));
  Object.defineProperty(navigator, "connection", {
    configurable: true,
    get: () => ({ saveData: economia }),
  });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  Object.defineProperty(HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get: () => paused,
  });
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    paused = false;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    paused = true;
    this.dispatchEvent(new Event("pause"));
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (navigator as Navigator & { connection?: unknown }).connection;
});

function video() {
  return document.querySelector("video")!;
}

describe("vídeo de contexto: autonomia e consumo no celular", () => {
  it("não baixa o filme fora da seção; ao entrar toca sem som", async () => {
    render(<VideoDeContexto textos={textos} />);
    expect(video().hasAttribute("src")).toBe(false);
    await act(async () => entrando(true));
    expect(video().getAttribute("src")).toBe("/media/atenza/atendimento-loop.mp4");
    expect(video().muted).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
  });
  it.each(["movimento", "economia"])(
    "a preferência %s mantém o poster sem baixar ou tocar",
    async (preferencia) => {
      if (preferencia === "movimento") reduzido = true;
      else economia = true;
      render(<VideoDeContexto textos={textos} />);
      await act(async () => entrando(true));
      expect(video().hasAttribute("src")).toBe(false);
      expect(play).not.toHaveBeenCalled();
      await act(async () => fireEvent.click(screen.getByRole("button", { name: textos.tocar })));
      expect(play).toHaveBeenCalledTimes(1);
    },
  );
  it("uma pausa voluntária persiste ao sair e voltar para a seção", async () => {
    render(<VideoDeContexto textos={textos} />);
    await act(async () => entrando(true));
    fireEvent.click(screen.getByRole("button", { name: textos.pausar }));
    await act(async () => {
      entrando(false);
      entrando(true);
    });
    expect(play).toHaveBeenCalledTimes(1);
    expect(video().paused).toBe(true);
  });
  it("a aba oculta pausa o vídeo e a desmontagem encerra o efeito", async () => {
    const view = render(<VideoDeContexto textos={textos} />);
    await act(async () => entrando(true));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    fireEvent(document, new Event("visibilitychange"));
    expect(video().paused).toBe(true);
    const antes = pause.mock.calls.length;
    view.unmount();
    expect(pause.mock.calls.length).toBe(antes + 1);
  });
});

describe("o filme narrado só existe após a escolha do visitante", () => {
  it("abre pelo botão, oferece legenda e transcrição, e remove o vídeo ao fechar", async () => {
    render(<VideoExplicativo textos={explicacao}>Assistir</VideoExplicativo>);
    expect(document.querySelector("video")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Assistir" }));
    const elemento = video();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(elemento.controls).toBe(true);
    expect(elemento.querySelector("track")?.getAttribute("srcLang")).toBe("pt-BR");
    expect(screen.getByText(explicacao.transcricao)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: explicacao.fechar }));
    await act(async () => {});
    expect(elemento.isConnected).toBe(false);
  });
});
