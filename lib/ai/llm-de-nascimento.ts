/**
 * O provedor de IA com que uma organização NASCE, quando a instalação escolheu um.
 *
 * ─── O defeito ──────────────────────────────────────────────────────────────
 *
 * `fn_seed_org_llm_defaults` (trigger de insert em `organizations`) semeia
 * `settings.llm = { provider: 'anthropic', default_model: <padrão anthropic> }`
 * em toda organização que nasce sem `default_model`. O instalador da VPS corrige
 * isso depois do insert (`aplicarProvedorEscolhido`, em
 * `scripts/bootstrap-owner.ts`), lendo `AI_PROVIDER`. O cadastro self-service
 * do site não passava por ali: toda organização criada pelo signup nascia em
 * Anthropic, e numa instalação que só tem `OPENROUTER_API_KEY` o agente do
 * cliente recém-pagante morria em `LlmNotConfiguredError` no primeiro turno —
 * com a mensagem mandando cadastrar a chave de um provedor que ninguém escolheu.
 *
 * ─── Por que o MODELO é obrigatório aqui, e não só o provedor ──────────────
 *
 * O trigger decide pelo `default_model`, não pelo `provider`: se o modelo chega
 * vazio, ele SOBRESCREVE o provedor com `anthropic`. Mandar só o provedor seria
 * mandar nada. E o modelo não dá para adivinhar — id de um provedor não vale no
 * outro — então quem escolhe é a instalação, em `AI_DEFAULT_MODEL`.
 *
 * Sem as duas variáveis, devolve `null` e a organização nasce como sempre
 * nasceu. É o caso de toda VPS instalada pelo kit, que não passa pelo signup.
 */

/** Um mapa simples, e não `NodeJS.ProcessEnv` — mesmo motivo de `lib/instalacao/ambiente.ts`. */
export type FonteDeAmbiente = Record<string, string | undefined>;

// `type`, e não `interface`: vai para dentro de `settings` (jsonb), e o `Json`
// do Supabase exige assinatura de índice, que interface não tem.
export type LlmDeNascimento = {
  provider: string;
  default_model: string;
};

export function llmDeNascimento(source: FonteDeAmbiente = process.env): LlmDeNascimento | null {
  const provider = (source.AI_PROVIDER ?? "").trim().toLowerCase();
  const modelo = (source.AI_DEFAULT_MODEL ?? "").trim();
  // `anthropic` é o que o trigger já grava — escrever de novo não muda nada.
  if (provider === "" || provider === "anthropic" || modelo === "") return null;
  return { provider, default_model: modelo };
}
