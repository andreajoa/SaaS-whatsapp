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
 * produto que vende, com os preços reais do Brasil; o self-host ganha um resumo
 * curto com o nome da própria instalação.
 */
export const dynamic = "force-dynamic";

/** Clone self-host: o nome é o da instalação, nunca o do projeto de origem. */
function textoSelfHost(nome: string, base: string): string {
  return `# ${nome}

> ${nome} é um CRM de atendimento por WhatsApp com agentes de IA, instalado e operado pela própria empresa: caixa de entrada compartilhada, base de conhecimento por empresa, passagem para atendimento humano com histórico e funil de vendas.

- Acesso: ${new URL("/login", base).toString()}
- Contato: ${new URL("/contato", base).toString()}
- Termos e privacidade: ${new URL("/legal", base).toString()}
`;
}

export async function GET() {
  const { nome } = await marcaDaSaida(null);
  const base = env.NEXT_PUBLIC_APP_URL;
  if (!instalacaoCobra()) {
    return new Response(textoSelfHost(nome, base), {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
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

- [Início](${url("/")}): visão geral do produto
- [Preços e planos](${url("/precos")}): planos, comparação e como funciona a assinatura
- [Demonstração em vídeo](${url("/demonstracao")}): 48 segundos, com legendas
${paginas}
- [Contato](${url("/contato")}): falar com o suporte
- [Instagram @atenzaon](https://www.instagram.com/atenzaon/): novidades e conteúdo da Atenza
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
