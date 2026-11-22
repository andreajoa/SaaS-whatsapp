/**
 * O idioma da interface — o mínimo que faz a escolha SIGNIFICAR alguma coisa.
 *
 * ─── O que existia antes ───────────────────────────────────────────────────
 *
 * Um seletor de idioma no perfil, salvo em `user_metadata.locale`, que NINGUÉM
 * lia. Medido: nenhuma biblioteca de i18n instalada, nenhuma pasta de tradução,
 * nenhum consumidor do campo. Escolher "English (US)" não mudava uma letra.
 *
 * Isso é pior que não ter a opção: o operador escolhe, nada acontece, e ele
 * conclui que o sistema está quebrado — a mesma classe do rodapé que mostra uma
 * versão que não é a que roda.
 *
 * ─── Por que dicionário próprio, e não uma biblioteca ──────────────────────
 *
 * As bibliotecas de i18n do App Router pedem o idioma no CAMINHO da URL
 * (`/es/app/inbox`), o que mexeria em TODA rota do produto — links salvos,
 * webhooks, redirects, testes e2e. Risco enorme para uma tradução parcial.
 *
 * Aqui o idioma vem de quem está logado e o texto é resolvido em memória. Nada
 * de rota muda, e a tradução pode crescer tela a tela sem nenhuma migração.
 *
 * ─── Já foi parcial. Não é mais, e agora há um guarda dizendo isso ─────────
 *
 * Esta seção dizia, com números, que a tradução cobria "o que a equipe usa todo
 * dia — inbox, kanban, contatos, conexões" e que o resto seguia em português.
 * Era verdade quando foi escrita e venceu: o PR #352 cobriu IA e Admin, e o
 * passe seguinte fechou Agenda, Desempenho, Radar e Respostas rápidas.
 *
 * O que substitui a frase não é outro número — números envelhecem calados. É um
 * guarda: `tests/unit/i18n-espanhol-cobre-a-tela` varre o AST de toda tela e
 * reprova prosa portuguesa que não passe por `t()`, mais toda chave usada sem
 * tradução. Para saber o estado agora, rode-o; ele não tem como estar
 * desatualizado.
 *
 * A cobertura de TEXTO é completa. A de DATA não: `locale: ptBR` é passado à
 * mão em dezenas de arquivos, e trocar isso é um passe próprio. A ressalva está
 * no cabeçalho do guarda, com o comando que a re-mede.
 *
 * ─── De onde vem o idioma de quem está olhando ─────────────────────────────
 *
 * Não é só do perfil. A cadeia é `preferência da pessoa → idioma da organização
 * → padrão`, resolvida em `lib/auth/server.ts` e entregue pronta em
 * `AuthUser.idioma`. É o elo do meio que faz o idioma escolhido no instalador
 * alcançar quem entra depois e nunca abriu o próprio perfil.
 */

export const IDIOMAS = ["pt-BR", "es", "en"] as const;
export type Idioma = (typeof IDIOMAS)[number];

export const IDIOMA_PADRAO: Idioma = "pt-BR";

/**
 * O que veio do perfil é um idioma que sabemos servir?
 *
 * Aceita variantes regionais comuns (`en-US`, `en-GB`, `es-MX`, `pt-PT`)
 * mapeando para o código canônico suportado, e fecha no padrão para valores
 * desconhecidos — garantindo que nenhuma chave crua apareça na tela.
 */
export function normalizarIdioma(bruto: string | null | undefined): Idioma {
  const limpo = (bruto ?? "").trim();
  if ((IDIOMAS as readonly string[]).includes(limpo)) return limpo as Idioma;
  const lower = limpo.toLowerCase();
  if (lower === "en" || lower.startsWith("en-") || lower.startsWith("en_")) return "en";
  if (lower === "es" || lower.startsWith("es-") || lower.startsWith("es_")) return "es";
  if (lower === "pt" || lower.startsWith("pt-") || lower.startsWith("pt_")) return "pt-BR";
  return IDIOMA_PADRAO;
}
