/**
 * O vídeo de apresentação certo para cada país e idioma.
 *
 * Cada versão é o MESMO filme com narração no sotaque do país, telas e legenda
 * traduzidas (pipeline em design-preview/videos/atenza-lancamento/localizacao).
 * Só entra em `LOCAIS_COM_VIDEO` o locale cujo arquivo já foi publicado em
 * /media/atenza — nunca um <video> apontando para arquivo que não existe.
 */
import { NARRACOES } from "./video-narracoes";

const MEDIA = "/media/atenza";

export const LOCAIS_COM_VIDEO: ReadonlySet<string> = new Set<string>(["es-mx"]);

/** País → locale do vídeo. Hispânico sem versão própria cai no México. */
const PAIS_PARA_LOCAL: Readonly<Record<string, string>> = {
  MX: "es-mx",
  CO: "es-co",
  AR: "es-ar",
  CL: "es-cl",
  PE: "es-pe",
  ES: "es-es",
  DE: "de-de",
};

export interface VideoDaApresentacao {
  readonly mp4: string;
  readonly poster: string;
  /** BCP-47 do áudio, para `lang` do player. */
  readonly lang: string;
}

function local(locale: string): VideoDaApresentacao | null {
  if (!LOCAIS_COM_VIDEO.has(locale)) return null;
  return {
    mp4: `${MEDIA}/atenza-explica-${locale}.mp4`,
    poster: `${MEDIA}/explainer-thumbnail-${locale}.webp`,
    lang: locale.replace(/-([a-z]{2})$/, (_, p: string) => `-${p.toUpperCase()}`),
  };
}

const PORTUGUES: VideoDaApresentacao = {
  mp4: `${MEDIA}/atenza-explica.mp4`,
  poster: `${MEDIA}/explainer-thumbnail.webp`,
  lang: "pt-BR",
};

/**
 * Página de país: o vídeo daquele país. Home em espanhol: o do país de quem
 * visita, ou o mexicano. Home em inglês: o americano. Português: o original.
 */
export function videoDaApresentacao(
  idioma: "pt-BR" | "es" | "en" | "de",
  pais?: string | null,
): VideoDaApresentacao {
  if (idioma === "pt-BR") return PORTUGUES;
  if (idioma === "en") return local("en-us") ?? PORTUGUES;
  if (idioma === "de") return local("de-de") ?? local("en-us") ?? PORTUGUES;
  const doPais = pais ? PAIS_PARA_LOCAL[pais.toUpperCase()] : undefined;
  return (doPais ? local(doPais) : null) ?? local("es-mx") ?? PORTUGUES;
}

/**
 * A transcrição da versão local em 4 parágrafos (o formato da home), para o
 * texto da página bater com o que se ouve. `null` para a versão portuguesa,
 * cuja transcrição vive na própria home.
 */
export function transcricaoDoVideo(
  video: VideoDaApresentacao,
): readonly [string, string, string, string] | null {
  const falas = NARRACOES[video.lang.toLowerCase()];
  if (!falas || falas.length < 8) return null;
  return [
    `${falas[0]} ${falas[1]}`,
    `${falas[2]} ${falas[3]}`,
    `${falas[4]} ${falas[5]}`,
    `${falas[6]} ${falas[7]}`,
  ];
}
