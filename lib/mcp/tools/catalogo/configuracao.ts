/**
 * Capacidades de CONFIGURAÇÃO — montar o atendente e o roteador da empresa.
 *
 * Existem para o Claude Code ou o Codex do DONO, ligado pelo token: ele
 * conversa com o dono e preenche a empresa. Todas são `apenasHumano` — o
 * atendente interno nunca reconfigura a si mesmo nem aos colegas. Handlers em
 * `lib/mcp/tools/configuracao.ts`.
 */
import { declararTools } from "./tipos";

export const TOOLS_CONFIGURACAO = declararTools([
  {
    name: "crm_get_setup_status",
    category: "read",
    rotulo: "Ver o que falta para o atendimento funcionar",
    explicacao:
      "Mostra se a empresa já tem chave de IA, WhatsApp conectado e atendente no ar, e diz o que ainda falta fazer.",
    oQueToca: "Configuração da empresa",
    risco: "seguro",
    pacotes: ["organizar"],
    apenasHumano: true,
  },
  {
    name: "crm_upsert_agent",
    category: "write",
    rotulo: "Criar ou atualizar um atendente",
    explicacao:
      "Monta o atendente com o que o dono contou do negócio — serviços, preços, perguntas frequentes e regras — e o coloca no ar para responder os clientes.",
    oQueToca: "Atendentes de IA",
    risco: "critico",
    pacotes: ["organizar"],
    apenasHumano: true,
  },
  {
    name: "crm_upsert_router",
    category: "write",
    rotulo: "Dividir um número entre vários atendentes",
    explicacao:
      "Faz o mesmo WhatsApp atender vários negócios ou setores: cada conversa vai para o atendente do assunto que o cliente trouxe.",
    oQueToca: "Roteador do número",
    risco: "critico",
    pacotes: ["organizar"],
    apenasHumano: true,
  },
]);
