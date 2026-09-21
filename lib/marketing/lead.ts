import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A ENTRADA DE UMA PESSOA NA LISTA — e as três coisas que ela NUNCA faz.
 *
 * ─── Por que isto não é um `upsert` de uma linha ───────────────────────────
 *
 * `site_leads` tem `unique (lower(email))`, então a tentação é um `upsert()`
 * com o alvo de conflito apontado para a coluna `email`, e pronto. Isso está
 * errado de QUATRO jeitos diferentes. O quarto é imediato e foi medido: o
 * índice é FUNCIONAL, e o Postgres casa `ON CONFLICT` por expressão — `(email)`
 * não é `(lower(email))`, então a instrução é recusada e NADA é gravado. Era
 * o estado do formulário de contato até 21/09/2026, achado por
 * `tests/invariants/on-conflict-aponta-para-constraint-real.test.ts`.
 *
 * (A citação do alvo vai em prosa, e não no formato real, porque esse
 * invariante varre o repo por regex e leria um exemplo em comentário como um
 * uso de verdade.)
 *
 * Os outros três só apareceriam semanas depois, e são o motivo de nem um
 * `upsert` CERTO servir aqui:
 *
 *  1. **Reiniciaria a sequência.** `proximo_passo` é o cursor dos 15 e-mails.
 *     Um `upsert` que grava o default `0` faz quem já recebeu os quinze
 *     receber os quinze de novo — por ter digitado o próprio e-mail duas
 *     vezes. É o jeito mais rápido de virar spam aos olhos do Gmail.
 *
 *  2. **Ressuscitaria quem se descadastrou.** O descadastro é ato legal. Um
 *     formulário em que QUALQUER pessoa digita QUALQUER endereço não pode
 *     desfazê-lo: bastaria um estranho digitar o e-mail de quem saiu para a
 *     lista recomeçar a escrever para alguém que pediu para parar.
 *
 *  3. **Apagaria o que já se sabe.** Quem chegou pelo checkout tem nome e
 *     organização; quem volta pelo rodapé manda só o e-mail. Um `upsert`
 *     gravaria `nome: null` por cima do nome.
 *
 * ─── Por que a resposta é a mesma para quem é novo e para quem não é ───────
 *
 * Um formulário aberto que diga "este e-mail já está cadastrado" é um oráculo
 * de enumeração: com ele, qualquer pessoa descobre quem é cliente daqui, um
 * endereço por vez. Quem chama esta função recebe o que precisa para gravar o
 * funil; quem responde ao NAVEGADOR devolve a mesma frase nos dois casos.
 */

/** De onde a pessoa entrou. Espelha o CHECK de `site_leads.origem`. */
export type OrigemDoLead = "popup" | "rodape" | "contato" | "checkout" | "signup";

export type DadosDoLead = {
  readonly email: string;
  readonly nome?: string | null;
  readonly telefone?: string | null;
  readonly empresa?: string | null;
  readonly mensagem?: string | null;
  readonly origem: OrigemDoLead;
  readonly visitorId?: string | null;
  readonly country?: string | null;
  readonly region?: string | null;
  readonly city?: string | null;
  readonly idioma?: string | null;
  readonly moeda?: string | null;
};

export type ResultadoDoLead =
  /** Linha nova. É a única situação em que a sequência de e-mails começa. */
  | { readonly tipo: "novo"; readonly id: string }
  /** Já estava na lista. Nada do que governa envio foi tocado. */
  | { readonly tipo: "conhecido"; readonly id: string }
  /** Pediu para sair. Continua fora, e o formulário não o traz de volta. */
  | { readonly tipo: "descadastrado" }
  /** Sem service role, ou clone sem a migration 0240. */
  | { readonly tipo: "sem_banco" };

/** O e-mail como ele entra no índice único: aparado e em minúsculas. */
export function normalizarEmail(bruto: string): string {
  return bruto.trim().toLowerCase();
}

/**
 * O que se pode escrever por cima, e o que não.
 *
 * Só campos de ENRIQUECIMENTO, e só quando o que já está lá é nulo: um dado
 * que chegou depois pode preencher uma lacuna, nunca substituir o que já se
 * sabia. `status`, `proximo_passo`, `descadastrado_em`, `origem` e
 * `token_descadastro` ficam de fora da lista de propósito — eles contam a
 * HISTÓRIA da pessoa, e um formulário não reescreve história.
 */
const ENRIQUECIVEIS = [
  "nome",
  "telefone",
  "empresa",
  "visitor_id",
  "country",
  "region",
  "city",
  "idioma",
  "moeda",
] as const;

export async function registrarLead(dados: DadosDoLead): Promise<ResultadoDoLead> {
  const email = normalizarEmail(dados.email);
  if (!email) return { tipo: "sem_banco" };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { tipo: "sem_banco" };
  }

  const { data: existente, error: erroBusca } = await admin
    .from("site_leads")
    .select(
      "id, nome, telefone, empresa, visitor_id, country, region, city, idioma, moeda, descadastrado_em",
    )
    .eq("email", email)
    .maybeSingle();

  // Erro de leitura é "não sei", nunca "não existe": tratar como não-existente
  // tentaria um insert que o índice único barra, e o 23505 seria lido como
  // falha. Sair aqui deixa a pessoa fora da lista, que é o lado seguro.
  if (erroBusca) return { tipo: "sem_banco" };

  if (existente) {
    if (existente.descadastrado_em) return { tipo: "descadastrado" };

    const remendo = lacunasAPreencher(existente, dados);
    if (Object.keys(remendo).length > 0) {
      await admin
        .from("site_leads")
        .update(remendo)
        .eq("id", existente.id as string);
    }
    return { tipo: "conhecido", id: existente.id as string };
  }

  const { data: criado, error: erroInsert } = await admin
    .from("site_leads")
    .insert({
      email,
      nome: vazioVira(dados.nome),
      telefone: vazioVira(dados.telefone),
      empresa: vazioVira(dados.empresa),
      mensagem: vazioVira(dados.mensagem),
      origem: dados.origem,
      visitor_id: vazioVira(dados.visitorId),
      country: vazioVira(dados.country),
      region: vazioVira(dados.region),
      city: vazioVira(dados.city),
      idioma: vazioVira(dados.idioma),
      moeda: vazioVira(dados.moeda),
    })
    .select("id")
    .maybeSingle();

  // `23505` aqui é corrida: outra aba inseriu entre a busca e o insert. Não é
  // erro — a pessoa está na lista, que era o objetivo.
  if (erroInsert) {
    if ((erroInsert as { code?: string }).code === "23505") {
      const { data: achado } = await admin
        .from("site_leads")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      return achado ? { tipo: "conhecido", id: achado.id as string } : { tipo: "sem_banco" };
    }
    return { tipo: "sem_banco" };
  }

  return criado ? { tipo: "novo", id: criado.id as string } : { tipo: "sem_banco" };
}

/** `""` e `"   "` não são dado — são a ausência dele com outro nome. */
function vazioVira(valor: string | null | undefined): string | null {
  const limpo = (valor ?? "").trim();
  return limpo === "" ? null : limpo;
}

function lacunasAPreencher(
  existente: Record<string, unknown>,
  dados: DadosDoLead,
): Record<string, string> {
  const chegando: Record<(typeof ENRIQUECIVEIS)[number], string | null> = {
    nome: vazioVira(dados.nome),
    telefone: vazioVira(dados.telefone),
    empresa: vazioVira(dados.empresa),
    visitor_id: vazioVira(dados.visitorId),
    country: vazioVira(dados.country),
    region: vazioVira(dados.region),
    city: vazioVira(dados.city),
    idioma: vazioVira(dados.idioma),
    moeda: vazioVira(dados.moeda),
  };

  const remendo: Record<string, string> = {};
  for (const campo of ENRIQUECIVEIS) {
    const novo = chegando[campo];
    if (novo && !existente[campo]) remendo[campo] = novo;
  }
  return remendo;
}
