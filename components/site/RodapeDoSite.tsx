import Link from "next/link";
import { BadgeCheck, LockKeyhole, ShieldCheck, Undo2 } from "lucide-react";

import { LogotipoDoProduto } from "@/components/branding/MarcaDoProduto";
import { DIAS_DE_TRIAL, instalacaoCobra } from "@/lib/billing/planos";
import { env } from "@/lib/env";
import { emailDeSuporte } from "@/lib/branding/saida";
import { instagramOficial, LINKS_SEO, reclameAquiOficial } from "@/lib/marketing/seo";
import { textoDoSite } from "@/lib/mercado/textos";
import type { IdiomaDoSite } from "@/lib/mercado/paises";
import styles from "./rodape.module.css";

/** Nome de marca de terceiro (logotipo em texto), não prosa: não se traduz. */
const MARCA_RECLAME_AQUI = ["Reclame", "AQUI"] as const;

/**
 * O rodapé de TODA página pública — o mesmo em todas, para quem chega por
 * qualquer porta achar planos, ajuda, documentos e a prova de segurança sem
 * precisar falar com ninguém.
 *
 * O selo só afirma o que o produto faz de verdade: pagamento pelo Stripe,
 * conexão pela API oficial da Meta, LGPD (pedidos de titular, anonimização,
 * DPA publicado) e cancelamento em um clique pelo portal do Stripe.
 */
export function RodapeDoSite({ nome, idioma = "pt-BR" }: { nome: string; idioma?: IdiomaDoSite }) {
  const t = (texto: string) => textoDoSite(texto, idioma);
  if (!instalacaoCobra()) {
    // Self-host sem vitrine: sem planos nem cadastro público para anunciar.
    return (
      <footer className={styles.rodape} lang={idioma}>
        <div className={styles.interno}>
          <p className={styles.base}>
            {nome} · <Link href="/legal">{t("Todos os documentos")}</Link> ·{" "}
            <Link href="/contato">{t("Fale com a gente")}</Link>
          </p>
        </div>
      </footer>
    );
  }
  const suporte = emailDeSuporte();
  const instagram = instagramOficial(env.NEXT_PUBLIC_APP_URL);
  const reclameAqui = reclameAquiOficial(env.NEXT_PUBLIC_APP_URL);
  const selos = [
    {
      icone: LockKeyhole,
      titulo: t("Pagamento seguro"),
      texto: t("Processado pela Stripe. Não guardamos o número do seu cartão."),
    },
    {
      icone: ShieldCheck,
      titulo: t("Dados protegidos"),
      texto: t("Tratamento conforme a LGPD, com DPA e lista de subprocessadores publicados."),
    },
    {
      icone: BadgeCheck,
      titulo: t("WhatsApp oficial"),
      texto: t("Conexão pela API oficial do WhatsApp, da Meta."),
    },
    {
      icone: Undo2,
      titulo: `${DIAS_DE_TRIAL} ${t("dias sem cobrança")}`,
      texto: t("Cancele quando quiser, em um clique, sem falar com ninguém."),
    },
  ];
  const colunas: {
    titulo: string;
    links: { href: string; rotulo: string; externo?: boolean }[];
  }[] = [
    {
      titulo: t("Produto"),
      links: [
        { href: "/#como-funciona", rotulo: t("Como funciona") },
        { href: "/#recursos", rotulo: t("Recursos") },
        { href: "/#integracoes", rotulo: t("Integrações") },
        { href: "/#planos", rotulo: t("Planos e preços") },
        { href: "/demonstracao", rotulo: t("Demonstração em vídeo") },
        { href: "/signup", rotulo: t("Criar conta") },
        { href: "/login", rotulo: t("Entrar") },
      ],
    },
    { titulo: t("Soluções"), links: LINKS_SEO.map((l) => ({ href: l.href, rotulo: l.label })) },
    {
      titulo: t("Ajuda"),
      links: [
        { href: "/#perguntas", rotulo: t("Perguntas frequentes") },
        { href: "/contato", rotulo: t("Fale com a gente") },
        ...(suporte ? [{ href: `mailto:${suporte}`, rotulo: suporte, externo: true }] : []),
        ...(instagram ? [{ href: instagram, rotulo: "Instagram @atenzaon", externo: true }] : []),
      ],
    },
    {
      titulo: t("Documentos"),
      links: [
        { href: "/legal/terms", rotulo: t("Termos de uso") },
        { href: "/legal/privacy", rotulo: t("Política de Privacidade") },
        { href: "/legal/reembolso", rotulo: t("Cancelamento e reembolso") },
        { href: "/legal/seguranca", rotulo: t("Segurança") },
        { href: "/legal/dpa", rotulo: t("Acordo de tratamento de dados (DPA)") },
        { href: "/legal/subprocessadores", rotulo: t("Subprocessadores") },
        { href: "/legal/cookies", rotulo: "Cookies" },
        { href: "/legal", rotulo: t("Todos os documentos") },
      ],
    },
  ];

  return (
    <footer className={styles.rodape} lang={idioma}>
      <div className={styles.interno}>
        <ul className={styles.selos} aria-label={t("Segurança e garantias")}>
          {selos.map(({ icone: Icone, titulo, texto }) => (
            <li key={titulo}>
              <Icone size={22} aria-hidden className={styles.iconeSelo} />
              <div>
                <strong>{titulo}</strong>
                <span>{texto}</span>
              </div>
            </li>
          ))}
        </ul>
        {reclameAqui && (
          <a
            href={reclameAqui}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.reclameAqui}
            aria-label={t("Empresa cadastrada no Reclame Aqui — abrir página")}
          >
            <span className={styles.raLogo} aria-hidden>
              <span>{MARCA_RECLAME_AQUI[0]}</span>
              <b>{MARCA_RECLAME_AQUI[1]}</b>
            </span>
            <span className={styles.raTexto}>
              <strong>{t("Empresa cadastrada no Reclame Aqui")}</strong>
              <span>{t("Veja a nossa página e a nossa reputação.")}</span>
            </span>
          </a>
        )}
        <div className={styles.grade}>
          <div className={styles.marca}>
            <Link href="/" aria-label={nome}>
              <LogotipoDoProduto nome={nome} decorativo className="h-8 w-auto" />
            </Link>
            <p>
              {t(
                "WhatsApp que atende e vende 24h: vários atendentes no mesmo número, agentes de IA com as informações do seu negócio e CRM com histórico de cada cliente.",
              )}
            </p>
          </div>
          {colunas.map((coluna) => (
            <nav key={coluna.titulo} aria-label={coluna.titulo} className={styles.coluna}>
              <h2>{coluna.titulo}</h2>
              <ul>
                {coluna.links.map((l) => (
                  <li key={l.href}>
                    {l.externo ? (
                      <a
                        href={l.href}
                        target={l.href.startsWith("http") ? "_blank" : undefined}
                        rel="noopener noreferrer"
                      >
                        {l.rotulo}
                      </a>
                    ) : (
                      <Link href={l.href}>{l.rotulo}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className={styles.base}>
          © {new Date().getFullYear()} {nome}.{" "}
          {t("Atendimento e vendas por WhatsApp para empresas de todo o Brasil.")}
        </p>
      </div>
    </footer>
  );
}
