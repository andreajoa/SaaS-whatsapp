import { DIAS_DE_TRIAL, instalacaoCobra, ORDEM_DOS_PLANOS, PLANOS } from "@/lib/billing/planos";
import { marcaDaSaida } from "@/lib/branding/saida";
import { env } from "@/lib/env";
import { PAGES_SEO } from "@/lib/marketing/conteudo-seo";
import { mercadoDoPais, precoLegivelNoMercado } from "@/lib/mercado/paises";

/**
 * O resumo que buscadores de IA (ChatGPT, Perplexity, Gemini, Claude) leem.
 *
 * Era um arquivo estático em `public/` descrevendo o projeto open-source sem
 * plano pago — e em www.atenza.online nem chegava a ser servido: o proxy
 * mandava `/llms.txt` para o login (307). Agora a instalação que cobra fala do
 * produto que vende, com os preços reais do Brasil; o self-host mantém o texto
 * do projeto aberto.
 */
export const dynamic = "force-dynamic";

const TEXTO_SELF_HOST = `# DeskcommCRM

> Open-source AI sales OS: a self-hosted, multi-tenant CRM where AI agents natively operate sales and support over WhatsApp. An open alternative to Kommo, Octadesk and Intercom — for any business that sells through conversations (e-commerce, clinics, real estate, info-products, agencies, services). MIT-licensed, no paid tier; the recommended production path is a one-command install on a HostGator VPS.

Key facts:
- Category: open-source CRM / AI sales operating system / WhatsApp customer platform
- AI: per-tenant RAG agents (pgvector) that answer, qualify and move leads; sentiment analysis; audited AI→human handoff; AI as first-class assignee; per-org AI budget; self-improvement loop (resolved conversations feed the knowledge base)
- MCP: internal MCP server today; public MCP contract on the roadmap — any AI agent can operate the CRM
- WhatsApp: via WAHA (multi-number, anti-ban throttling, media, STOP detection)
- Multi-niche: configurable vocabulary per pipeline (lead = Customer/Patient/Buyer; won = Paid/Booked/Closed); Nuvemshop integration for the e-commerce vertical
- Compliance: multi-tenant Postgres RLS (isolation tested in CI), LGPD by design (redact, data_request, anonymization), append-only audit log
- Stack: Next.js 16, React 19, TypeScript, Supabase (Postgres + Auth + Realtime + Storage), Vercel AI SDK, WAHA
- License: MIT. Fully self-hosted; your data stays on your VPS.

## Docs

- [README (Portuguese)](https://github.com/melgarafael/DeskcommCRM/blob/main/README.md): visão geral, quickstart, stack
- [README (English)](https://github.com/melgarafael/DeskcommCRM/blob/main/README.en.md): project overview, quickstart, stack
- [README (Spanish)](https://github.com/melgarafael/DeskcommCRM/blob/main/README.es.md): visión general en español
- [Vision & positioning](https://github.com/melgarafael/DeskcommCRM/blob/main/VISION.md): what the project believes about self-improving AI agents
- [Architecture](https://github.com/melgarafael/DeskcommCRM/blob/main/ARCHITECTURE.md): one-page architecture
- [Setup guide](https://github.com/melgarafael/DeskcommCRM/blob/main/docs/SETUP.md): step-by-step setup of every integration
- [Self-host on a VPS](https://github.com/melgarafael/DeskcommCRM/blob/main/docs/deploy-selfhost/README.md): docker compose deploy on any VPS

## Repository

- [GitHub](https://github.com/melgarafael/DeskcommCRM): source code, issues, discussions
`;

export async function GET() {
  if (!instalacaoCobra()) {
    return new Response(TEXTO_SELF_HOST, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const { nome } = await marcaDaSaida(null);
  const base = env.NEXT_PUBLIC_APP_URL;
  const url = (caminho: string) => new URL(caminho, base).toString();
  const brasil = mercadoDoPais("BR");
  const planos = ORDEM_DOS_PLANOS.map(
    (id) =>
      `- ${PLANOS[id].nome}: ${precoLegivelNoMercado(id, brasil)}/mês — ${PLANOS[id].destaques.join("; ")}`,
  ).join("\n");
  const paginas = PAGES_SEO.map(
    (p) => `- [${p.title}](${url(`/${p.slug}`)}): ${p.description}`,
  ).join("\n");

  const texto = `# ${nome}

> ${nome} é um software brasileiro (SaaS) de atendimento por WhatsApp com IA e CRM: caixa de entrada compartilhada para vários atendentes, agentes de IA treinados com a base de conhecimento da empresa, passagem para atendimento humano com histórico e funil de vendas em kanban. Atende empresas em todo o Brasil, com foco em São Paulo e Grande São Paulo. Uso 100% online, pelo navegador.

Fatos principais:
- Categoria: software de atendimento WhatsApp, chatbot com IA para WhatsApp, CRM para WhatsApp
- Para quem: pequenas e médias empresas que vendem e atendem pelo WhatsApp — clínicas, lojas e e-commerce, escolas, imobiliárias, prestadores de serviço
- WhatsApp: API oficial da Meta (WhatsApp Cloud API) conectada pelo próprio cliente
- IA: agentes que respondem dúvidas com a base da empresa, qualificam o contato e passam para uma pessoa quando precisam; a chave do provedor de IA é do cliente
- CRM: contatos, histórico completo, funil kanban, follow-up automático e campanhas
- Integrações: Shopify, WooCommerce, Nuvemshop, API e webhooks
- LGPD: dados isolados por empresa, pedidos de titular e trilha de auditoria
- Teste: ${DIAS_DE_TRIAL} dias sem cobrança no início
- Idiomas do site: português (Brasil), inglês e espanhol

## Planos no Brasil (preço mensal em reais)

${planos}

## Páginas

- [Início e planos](${url("/")}): visão geral do produto e preços
- [Demonstração em vídeo](${url("/demonstracao")}): 48 segundos, com legendas
${paginas}
- [Contato](${url("/contato")}): falar com o suporte
- [Termos e privacidade](${url("/legal")}): documentos legais

## Versões em outros idiomas

- [English](${url("/en")})
- [Español](${url("/es")})
`;
  return new Response(texto, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
