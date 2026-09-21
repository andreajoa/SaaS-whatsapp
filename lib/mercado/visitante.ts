import { headers } from "next/headers";

import { ehIdiomaDoSite, mercadoDoPais, type IdiomaDoSite, type Mercado } from "./paises";

/**
 * QUEM CHEGOU: país, cidade, origem e idioma, lidos dos cabeçalhos da borda.
 *
 * ─── Por que cabeçalho e não banco de IP ────────────────────────────────────
 *
 * A borda que serve esta aplicação já resolveu a geolocalização antes de o
 * código rodar, e entrega o resultado em cabeçalho. Uma base GeoIP nossa
 * custaria dezenas de MB na imagem, um cron de atualização e uma consulta por
 * requisição — para produzir a MESMA resposta, pior e mais velha.
 *
 * ─── O que a borda NÃO dá, e por que a tela não promete ─────────────────────
 *
 * **Bairro.** Nenhum cabeçalho traz bairro, e não existe base pública que o
 * derive de IP com precisão que valha imprimir. O mais fino que chega é o CEP
 * (`x-vercel-ip-postal-code`), que numa capital cobre algumas quadras e no
 * interior cobre a cidade inteira. O painel mostra o CEP com esse nome — CEP —
 * e não "bairro": um rótulo que promete precisão que o dado não tem faz quem
 * lê tomar decisão sobre ruído.
 *
 * ─── Degradação é o caminho normal, não o excepcional ───────────────────────
 *
 * Em `next dev`, em teste e num self-host atrás de proxy próprio, NENHUM
 * destes cabeçalhos existe. Por isso tudo aqui é `null`-tolerante e o mercado
 * cai no internacional: a página tem de abrir igual, com preço em dólar, sem
 * um `try/catch` em quem chama.
 */

/** Os cabeçalhos de geolocalização, na ordem em que valem. */
const GEO = {
  pais: ["x-vercel-ip-country", "cf-ipcountry"],
  regiao: ["x-vercel-ip-country-region", "x-vercel-ip-region"],
  cidade: ["x-vercel-ip-city"],
  cep: ["x-vercel-ip-postal-code"],
  latitude: ["x-vercel-ip-latitude"],
  longitude: ["x-vercel-ip-longitude"],
} as const;

/**
 * O cookie que reconhece quem volta — um opaco, nunca um e-mail.
 *
 * Mora aqui e não na rota que o grava porque QUEM O LÊ é outra rota: a de
 * inscrição, para ligar o e-mail deixado hoje às visitas de ontem. Um arquivo
 * de rota do App Router deve exportar handlers e configuração, e mais nada —
 * importar uma constante de dentro dele arrastaria o módulo da rota (com o
 * `force-dynamic` e as dependências dela) para dentro da outra.
 */
export const COOKIE_DO_VISITANTE = "vsid";

/** 180 dias. O bastante para reconhecer quem volta depois de pensar. */
export const VALIDADE_DO_VISITANTE_SEG = 180 * 24 * 60 * 60;

export interface Visitante {
  readonly pais: string | null;
  readonly regiao: string | null;
  readonly cidade: string | null;
  /** CEP. É o mais fino que a borda entrega — NÃO é bairro. */
  readonly cep: string | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly idioma: IdiomaDoSite;
  readonly mercado: Mercado;
  readonly dispositivo: "celular" | "tablet" | "computador";
}

/**
 * O país de um `Headers` qualquer — inclusive o de uma `NextRequest`.
 *
 * Existe separado de `visitanteAtual()` porque quem está dentro de um Route
 * Handler já TEM os cabeçalhos na mão, e chamar `headers()` de novo ali
 * acopla a rota ao escopo de requisição do Next sem precisar: o teste da rota
 * monta uma `NextRequest` e chama a função direto, e `headers()` lança fora do
 * escopo. Um cadastro que quebra no teste por causa de geolocalização é o tipo
 * de acoplamento que se paga uma vez e se carrega para sempre.
 */
export function paisDosCabecalhos(h: Headers): string | null {
  return primeiro(h, GEO.pais);
}

function primeiro(h: Headers, nomes: readonly string[]): string | null {
  for (const nome of nomes) {
    const valor = h.get(nome)?.trim();
    if (valor) return decodeURIComponent(valor);
  }
  return null;
}

/**
 * O idioma da página.
 *
 * A ordem é deliberada e a primeira posição é a que mais importa: o PAÍS ganha
 * do `Accept-Language`. Um brasileiro com o navegador em inglês — que é comum
 * entre quem trabalha com tecnologia, e são justamente estes que avaliam a
 * ferramenta — deve ver a página em português e o preço em reais. O cabeçalho
 * do navegador diz que idioma ele configurou uma vez; o país diz onde ele vai
 * passar o cartão.
 */
export function idiomaDoVisitante(h: Headers, mercado: Mercado): IdiomaDoSite {
  if (mercado.pais.length > 0) return mercado.idioma;

  // Sem país conhecido, o navegador é a única pista. `pt` antes de `es` porque
  // o produto nasceu em português e a tradução dele é a mais completa.
  const aceita = (h.get("accept-language") ?? "").toLowerCase();
  for (const marca of ["pt", "es", "en"] as const) {
    if (aceita.includes(marca) && ehIdiomaDoSite(marca === "pt" ? "pt-BR" : marca)) {
      return marca === "pt" ? "pt-BR" : marca;
    }
  }
  return mercado.idioma;
}

/**
 * Celular, tablet ou computador — para a direção de arte, não para estatística.
 *
 * A página é escrita mobile-first e algumas peças (a conversa de exemplo, a
 * barra de planos) mudam de forma. Saber isto no SERVIDOR evita o pulo de
 * layout que um `window.matchMedia` no cliente produz depois da primeira
 * pintura.
 */
function dispositivoDoAgente(ua: string): Visitante["dispositivo"] {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s)) return "tablet";
  if (/mobi|android|iphone|ipod|phone/.test(s)) return "celular";
  return "computador";
}

/** Lê o visitante da requisição em curso. Só serve em componente de servidor. */
export async function visitanteAtual(): Promise<Visitante> {
  const h = await headers();
  const pais = primeiro(h, GEO.pais);
  const mercado = mercadoDoPais(pais);
  return {
    pais,
    regiao: primeiro(h, GEO.regiao),
    cidade: primeiro(h, GEO.cidade),
    cep: primeiro(h, GEO.cep),
    latitude: primeiro(h, GEO.latitude),
    longitude: primeiro(h, GEO.longitude),
    idioma: idiomaDoVisitante(h, mercado),
    mercado,
    dispositivo: dispositivoDoAgente(h.get("user-agent") ?? ""),
  };
}

/**
 * A origem da visita, reduzida ao que cabe num painel.
 *
 * O `referrer` inteiro é guardado, mas quem lê o painel quer o HOST: cem linhas
 * de `google.com/search?q=...` são uma linha, "veio do Google". A redução
 * acontece na ESCRITA e não na leitura para que o índice
 * (`site_visits_origem_idx`) tenha o que indexar.
 */
export function hostDaOrigem(referrer: string | null | undefined): string | null {
  const bruto = (referrer ?? "").trim();
  if (bruto.length === 0) return null;
  try {
    const host = new URL(bruto).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    // Referrer malformado é comum e não é erro nosso — o cliente pode mandar
    // qualquer coisa. Guardar `null` no host preserva a linha da visita, que é
    // o dado que importa; o texto cru continua na coluna ao lado.
    return null;
  }
}

/** Os cinco `utm_*` que o mercado usa. Qualquer outro parâmetro é ignorado. */
export function utmDaUrl(url: URL): Readonly<Record<string, string | null>> {
  const ler = (nome: string) => {
    const valor = url.searchParams.get(nome)?.trim();
    // 200 chars: `utm_campaign` de gerador de link vem com o anúncio inteiro
    // dentro, e a coluna não é o lugar de guardar isso.
    return valor && valor.length > 0 ? valor.slice(0, 200) : null;
  };
  return {
    utm_source: ler("utm_source"),
    utm_medium: ler("utm_medium"),
    utm_campaign: ler("utm_campaign"),
    utm_content: ler("utm_content"),
    utm_term: ler("utm_term"),
  };
}
