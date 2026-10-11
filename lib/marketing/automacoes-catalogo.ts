import { z } from "zod";

import { CAMINHO_DOS_PLANOS } from "@/lib/marketing/caminhos";
import { transacionalPorId } from "@/lib/marketing/transacionais";

export const AUTOMACOES_IDS = [
  "pagamento-falhou",
  "pagamento-recebido",
  "cadastro-sem-assinatura",
  "black-friday",
  "natal",
  "ano-novo",
] as const;
export type AutomacaoId = (typeof AUTOMACOES_IDS)[number];
export const AUDIENCIAS = [
  "nao_assinantes",
  "assinantes",
  "todos",
  "cadastro_sem_assinatura",
  "transacional",
] as const;
const textoSchema = z.object({
  assunto: z
    .string()
    .trim()
    .min(3)
    .max(160)
    .regex(/^[^\r\n]+$/),
  corpo: z.object({
    titulo: z.string().trim().min(3).max(160),
    paragrafos: z.array(z.string().trim().min(1).max(2000)).min(1).max(8),
    destaques: z.array(z.string().trim().min(1).max(500)).max(8).optional(),
    posEscrito: z.string().trim().max(1000).optional(),
    acao: z
      .object({
        rotulo: z.string().trim().min(1).max(100),
        caminho: z
          .string()
          .max(200)
          .regex(/^\/(?!\/)[a-zA-Z0-9/#?=&_.-]*$/),
      })
      .optional(),
  }),
});
export const automacaoSchema = z
  .object({
    id: z.enum(AUTOMACOES_IDS),
    enabled: z.boolean(),
    audience: z.enum(AUDIENCIAS),
    starts_at: z.iso.datetime({ offset: true }).nullable(),
    ends_at: z.iso.datetime({ offset: true }).nullable(),
    textos: z.object({ "pt-BR": textoSchema, en: textoSchema, es: textoSchema }),
  })
  .superRefine((value, ctx) => {
    const transactional = value.id === "pagamento-falhou" || value.id === "pagamento-recebido";
    if (transactional && value.audience !== "transacional")
      ctx.addIssue({ code: "custom", message: "Aviso de cobrança exige público transacional." });
    if (
      !transactional &&
      (!value.starts_at || !value.ends_at || new Date(value.ends_at) <= new Date(value.starts_at))
    )
      ctx.addIssue({ code: "custom", message: "Defina início e fim válidos." });
    if (!transactional && value.audience === "transacional")
      ctx.addIssue({
        code: "custom",
        message: "Campanha comercial exige público com consentimento.",
      });
    if (value.id === "cadastro-sem-assinatura" && value.audience !== "cadastro_sem_assinatura")
      ctx.addIssue({ code: "custom", message: "Este lembrete atende cadastros sem assinatura." });
  });
export type Automacao = z.infer<typeof automacaoSchema>;
export const NOMES_AUTOMACOES: Record<AutomacaoId, string> = {
  "pagamento-falhou": "Pagamento em atraso",
  "pagamento-recebido": "Agradecimento pelo pagamento",
  "cadastro-sem-assinatura": "Cadastro sem assinatura",
  "black-friday": "Black Friday",
  natal: "Natal",
  "ano-novo": "Ano Novo",
};

/** Data civil em São Paulo: começo inclusivo; fim exclusivo no dia seguinte. */
export function dataDeSaoPaulo(data: string, fim = false): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error("Data inválida");
  const date = new Date(`${data}T00:00:00-03:00`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== data)
    throw new Error("Data inválida");
  if (fim) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}
export function dataParaCampo(iso: string | null, fim = false): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() - 3 * 3600000 - (fim ? 86400000 : 0))
    .toISOString()
    .slice(0, 10);
}
export function anoDeSaoPaulo(agora = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(agora),
  );
}
export function janelaSazonal(ano: number, id: "black-friday" | "natal" | "ano-novo") {
  // Quarta sexta-feira de novembro. Nenhuma oferta/desconto é presumido.
  const primeiro = new Date(Date.UTC(ano, 10, 1)).getUTCDay();
  const sexta = 1 + ((5 - primeiro + 7) % 7) + 21;
  const bf = `${ano}-11-${String(sexta).padStart(2, "0")}`;
  const natalInicio = new Date(Date.UTC(ano, 10, sexta + 1)).toISOString().slice(0, 10);
  const datas: readonly [string, string] =
    id === "black-friday"
      ? [`${ano}-11-01`, bf]
      : id === "natal"
        ? [natalInicio, `${ano}-12-25`]
        : [`${ano}-12-26`, `${ano + 1}-01-01`];
  return { starts_at: dataDeSaoPaulo(datas[0]), ends_at: dataDeSaoPaulo(datas[1], true) };
}
export function automacoesPadrao(agora = new Date()): Automacao[] {
  const ano = anoDeSaoPaulo(agora);
  return AUTOMACOES_IDS.map<Automacao>((id) => {
    const transactional = transacionalPorId(id);
    if (transactional)
      return automacaoSchema.parse({
        id,
        enabled: id === "pagamento-falhou",
        audience: "transacional",
        starts_at: null,
        ends_at: null,
        textos: structuredClone(transactional.texto),
      });
    const assunto =
      id === "cadastro-sem-assinatura"
        ? "Ficou alguma dúvida para começar?"
        : id === "black-friday"
          ? "Prepare seu atendimento para a Black Friday"
          : id === "natal"
            ? "Seu atendimento preparado para o Natal"
            : "Comece o ano com o atendimento organizado";
    const paragrafo =
      id === "cadastro-sem-assinatura"
        ? "Você criou sua conta e ainda não iniciou uma assinatura. Se ficou alguma dúvida, responda este e-mail. Os planos e os valores atuais estão no link abaixo."
        : "Organize o atendimento no WhatsApp para responder com clareza, acompanhar interessados e deixar sua equipe saber o próximo passo. Consulte os planos e valores atuais no site.";
    const pt = {
      assunto,
      corpo: {
        titulo: assunto,
        paragrafos: [paragrafo],
        acao: { rotulo: "Consultar planos", caminho: CAMINHO_DOS_PLANOS },
      },
    };
    const en = {
      assunto:
        id === "cadastro-sem-assinatura"
          ? "Any questions before getting started?"
          : `Prepare your WhatsApp support for ${id === "black-friday" ? "Black Friday" : id === "natal" ? "Christmas" : "the New Year"}`,
      corpo: {
        titulo: "Organize your WhatsApp support",
        paragrafos: [
          "See the available plans and current prices on our website. If you have a question, reply to this email.",
        ],
        acao: { rotulo: "View plans", caminho: CAMINHO_DOS_PLANOS },
      },
    };
    const es = {
      assunto:
        id === "cadastro-sem-assinatura"
          ? "¿Alguna duda para empezar?"
          : `Prepare su atención para ${id === "black-friday" ? "Black Friday" : id === "natal" ? "Navidad" : "Año Nuevo"}`,
      corpo: {
        titulo: "Organice su atención por WhatsApp",
        paragrafos: [
          "Consulte los planes y precios actuales en nuestro sitio. Si tiene alguna duda, responda este correo.",
        ],
        acao: { rotulo: "Ver planes", caminho: CAMINHO_DOS_PLANOS },
      },
    };
    const janela =
      id === "cadastro-sem-assinatura"
        ? {
            starts_at: dataDeSaoPaulo(`${ano}-01-01`),
            ends_at: dataDeSaoPaulo(`${ano}-12-31`, true),
          }
        : janelaSazonal(ano, id === "black-friday" ? id : id === "natal" ? id : "ano-novo");
    return {
      id,
      enabled: false,
      audience: id === "cadastro-sem-assinatura" ? "cadastro_sem_assinatura" : "nao_assinantes",
      ...janela,
      textos: { "pt-BR": pt, en, es },
    };
  });
}
export function estaNaJanela(automacao: Automacao, agora = new Date()): boolean {
  return (
    automacao.enabled &&
    !!automacao.starts_at &&
    !!automacao.ends_at &&
    agora >= new Date(automacao.starts_at) &&
    agora < new Date(automacao.ends_at)
  );
}
export function chaveDaCampanha(automacao: Automacao, userId: string | null): string {
  return automacao.id === "cadastro-sem-assinatura"
    ? `${automacao.id}#${userId}`
    : `${automacao.id}#${anoDeSaoPaulo(new Date(automacao.starts_at!))}`;
}
