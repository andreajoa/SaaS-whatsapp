"use client";

/**
 * A tela de assinatura inteira: escolher plano, pagar sem sair daqui, e ver o
 * resultado.
 *
 * ─── Três estados, e por que não são três páginas ──────────────────────────
 *
 * `escolher` → `pagar` → `pronto`. Tudo no mesmo componente e na mesma URL.
 * Um fluxo de pagamento espalhado por páginas dá ao navegador um botão
 * "voltar" que reabre um formulário morto e um "recarregar" que perde a
 * sessão de checkout. Aqui o passo é estado de React, e o `clientSecret`
 * vive enquanto a tela viver.
 *
 * ─── O resumo ao lado do formulário não é enfeite ──────────────────────────
 *
 * É a peça que responde "o que exatamente eu estou pagando?" sem a pessoa ter
 * de voltar. O formulário do Stripe mostra o valor; ele não mostra quantos
 * números de WhatsApp o plano dá.
 *
 * ─── O que esta tela NÃO faz ───────────────────────────────────────────────
 *
 * Ela não libera acesso. O `onComplete` do Stripe diz que o cartão passou, não
 * que a assinatura existe — quem grava é o webhook, e a rota de status só
 * adianta o mesmo trabalho. Por isso o passo `pronto` CONSULTA o servidor
 * antes de comemorar, e recarrega a página no fim: o gate de acesso mora no
 * layout, e ele precisa ser re-renderizado do servidor para soltar a trava.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useT } from "@/lib/i18n/IdiomaProvider";
import { cn } from "@/lib/utils";
import {
  ORDEM_DOS_PLANOS,
  PLANOS,
  type PlanoId,
} from "@/lib/billing/planos";
import { precoLegivelNoMercado, type Mercado } from "@/lib/mercado/paises";

import { CheckoutEmbutido, chavePublicavelAusente } from "./CheckoutEmbutido";

interface Props {
  /** Plano em vigor, ou `null` em trial / sem assinatura. */
  planoAtual: PlanoId | null;
  /** Quais planos esta instalação realmente vende (tem `price_...` no env). */
  planosVendidos: PlanoId[];
  /**
   * O mercado da ORGANIZAÇÃO — moeda, `locale` e a régua de preço.
   *
   * Vem do servidor, resolvido de `organizations.settings.mercado`, e não do
   * IP de quem está olhando: um cliente brasileiro abrindo esta tela de um
   * hotel no México veria o próprio plano em pesos, e num número diferente do
   * que ele paga. Preço que muda com viagem é a pior surpresa possível na tela
   * de dinheiro. Ver `lib/mercado/organizacao.ts`.
   */
  mercado: Mercado;
  /** Já existe customer no Stripe? Decide se o portal é oferecido. */
  temAssinatura: boolean;
  /**
   * `?sessao=cs_...` da URL. Só chega aqui quem pagou por um meio que
   * redireciona (boleto/Pix) — cartão nunca sai da tela. Ver
   * `redirect_on_completion` em lib/billing/stripe.ts.
   */
  sessaoDeRetorno: string | null;
}

type Passo =
  | { nome: "escolher" }
  | { nome: "pagar"; plano: PlanoId; clientSecret: string; sessionId: string }
  | { nome: "confirmando"; sessionId: string }
  | { nome: "pronto"; plano: PlanoId | null };

/** O plano que a maioria leva. Fica em destaque; não muda nada no servidor. */
const PLANO_EM_DESTAQUE: PlanoId = "pro";

export function PlanosDaConta({
  planoAtual,
  planosVendidos,
  mercado,
  temAssinatura,
  sessaoDeRetorno,
}: Props) {
  const t = useT();
  const [passo, setPasso] = useState<Passo>(
    sessaoDeRetorno ? { nome: "confirmando", sessionId: sessaoDeRetorno } : { nome: "escolher" },
  );
  const [ocupado, setOcupado] = useState<string | null>(null);
  const semChavePublica = chavePublicavelAusente();

  /**
   * Pergunta ao servidor se a sessão fechou. Chamado nos DOIS caminhos de
   * sucesso — o cartão (via `onComplete`) e a volta do boleto/Pix (via
   * `?sessao=`) — porque nenhum dos dois é prova por si: os dois só sabem que
   * o Stripe terminou, e é o servidor que confere e grava.
   */
  const confirmar = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(
        `/api/v1/billing/checkout/status?sessao=${encodeURIComponent(sessionId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => null)) as
        | { data?: { status?: string; plano?: PlanoId | null }; error?: { message?: string } }
        | null;

      if (!res.ok) {
        toast.error(json?.error?.message ?? t("Não foi possível confirmar o pagamento."));
        setPasso({ nome: "escolher" });
        return;
      }
      if (json?.data?.status !== "complete") {
        // Sessão aberta ou expirada: não houve pagamento. Volta à escolha em
        // silêncio — dizer "falhou" para quem só fechou a aba assusta à toa.
        setPasso({ nome: "escolher" });
        return;
      }
      setPasso({ nome: "pronto", plano: json.data.plano ?? null });
    } catch {
      toast.error(t("Falha de rede ao confirmar o pagamento."));
      setPasso({ nome: "escolher" });
    }
  }, [t]);

  // A volta do boleto/Pix cai direto em `confirmando`.
  const jaConfirmou = useRef(false);
  useEffect(() => {
    if (passo.nome !== "confirmando" || jaConfirmou.current) return;
    jaConfirmou.current = true;
    void confirmar(passo.sessionId);
  }, [passo, confirmar]);

  async function abrirCheckout(plano: PlanoId) {
    setOcupado(plano);
    try {
      const res = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano }),
      });
      const json = (await res.json().catch(() => null)) as
        | { data?: { clientSecret?: string; sessionId?: string }; error?: { message?: string } }
        | null;

      if (!res.ok || !json?.data?.clientSecret || !json.data.sessionId) {
        // A mensagem do servidor é escrita para quem lê (ver as rotas); passá-la
        // adiante é melhor que um "algo deu errado" que não diz o que fazer.
        toast.error(json?.error?.message ?? t("Não foi possível abrir o pagamento agora."));
        return;
      }
      setPasso({
        nome: "pagar",
        plano,
        clientSecret: json.data.clientSecret,
        sessionId: json.data.sessionId,
      });
      jaConfirmou.current = false;
    } catch {
      toast.error(t("Falha de rede. Tente de novo."));
    } finally {
      setOcupado(null);
    }
  }

  async function abrirPortal() {
    setOcupado("portal");
    try {
      const res = await fetch("/api/v1/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => null)) as
        | { data?: { url?: string }; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.data?.url) {
        toast.error(json?.error?.message ?? t("Não foi possível abrir o portal agora."));
        setOcupado(null);
        return;
      }
      // O portal do Stripe NÃO tem versão embutida — é a única tela de
      // cobrança que sai daqui, e sai de propósito: cancelar, trocar cartão e
      // baixar nota fiscal são operações do Stripe, não nossas.
      window.location.assign(json.data.url);
    } catch {
      toast.error(t("Falha de rede. Tente de novo."));
      setOcupado(null);
    }
  }

  const vendidos = ORDEM_DOS_PLANOS.filter((p) => planosVendidos.includes(p));

  // ─── Pagando ───────────────────────────────────────────────────────────────
  if (passo.nome === "pagar") {
    const plano = PLANOS[passo.plano];
    return (
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <Card className="flex flex-col gap-4 p-5 lg:sticky lg:top-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t("Você está assinando")}
            </h2>
            <Badge variant="secondary">{t("Mensal")}</Badge>
          </div>
          <div>
            <p className="text-lg font-semibold">{plano.nome}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {precoLegivelNoMercado(passo.plano, mercado)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{t("/mês")}</span>
            </p>
          </div>
          <Separator />
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {plano.destaques.map((d) => (
              <li key={d} className="flex gap-2">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>{t(d)}</span>
              </li>
            ))}
          </ul>
          <Separator />
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              {t("Cancele quando quiser, sem multa. Os dados da sua empresa continuam seus.")}
            </span>
          </p>
          <Button
            variant="ghost"
            className="mt-auto"
            onClick={() => setPasso({ nome: "escolher" })}
          >
            {t("Escolher outro plano")}
          </Button>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b px-5 py-3 text-xs text-muted-foreground">
            <Lock aria-hidden className="size-3.5" />
            <span>
              {t(
                "Pagamento processado pelo Stripe. O número do cartão não passa pelos nossos servidores.",
              )}
            </span>
          </div>
          <div className="p-2 sm:p-4">
            <CheckoutEmbutido
              clientSecret={passo.clientSecret}
              onConcluido={() => setPasso({ nome: "confirmando", sessionId: passo.sessionId })}
            />
          </div>
        </Card>
      </div>
    );
  }

  // ─── Confirmando ───────────────────────────────────────────────────────────
  if (passo.nome === "confirmando") {
    return (
      <Card className="flex flex-col items-center gap-3 p-12 text-center">
        <Loader2 aria-hidden className="size-6 animate-spin text-accent" />
        <p className="text-sm font-medium">{t("Confirmando o pagamento…")}</p>
        <p className="text-sm text-muted-foreground">
          {t("Não feche esta página. Leva alguns segundos.")}
        </p>
      </Card>
    );
  }

  // ─── Pronto ────────────────────────────────────────────────────────────────
  if (passo.nome === "pronto") {
    const nome = passo.plano ? PLANOS[passo.plano].nome : null;
    return (
      <Card className="flex flex-col items-center gap-4 p-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent/10">
          <Check aria-hidden className="size-6 text-accent" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{t("Assinatura ativa")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {nome
              ? `${t("Seu plano")} ${nome} ${t("já está valendo. O recibo foi para o seu e-mail.")}`
              : t("Pagamento confirmado. O recibo foi para o seu e-mail.")}
          </p>
        </div>
        {/* Recarrega do SERVIDOR: o gate de acesso é calculado no layout, e só
            um novo render dele solta a trava para o resto do sistema. */}
        <Button onClick={() => window.location.assign("/app/settings/billing")}>
          {t("Continuar")}
        </Button>
      </Card>
    );
  }

  // ─── Escolher ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {temAssinatura ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-sm font-semibold">{t("Gerenciar assinatura")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Trocar de plano, atualizar o cartão, baixar faturas ou cancelar.")}
            </p>
          </div>
          <Button variant="secondary" disabled={ocupado !== null} onClick={() => void abrirPortal()}>
            {ocupado === "portal" ? t("Abrindo…") : t("Abrir portal de cobrança")}
          </Button>
        </Card>
      ) : null}

      {vendidos.length === 0 ? (
        <Card className="p-5 text-sm text-muted-foreground">
          {t(
            "Nenhum plano está configurado nesta instalação. Quem administra o sistema precisa cadastrar os preços no Stripe.",
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {vendidos.map((id) => {
            const plano = PLANOS[id];
            const atual = planoAtual === id;
            const destaque = id === PLANO_EM_DESTAQUE && !atual;
            return (
              <Card
                key={id}
                className={cn(
                  "relative flex flex-col gap-4 p-5 transition-shadow",
                  destaque && "border-accent/40 shadow-md",
                )}
              >
                {destaque ? (
                  <Badge className="absolute -top-2.5 left-5">{t("Mais escolhido")}</Badge>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">{plano.nome}</h3>
                  {atual ? <Badge variant="success">{t("Seu plano")}</Badge> : null}
                </div>
                <p className="text-2xl font-semibold tracking-tight">
                  {precoLegivelNoMercado(id, mercado)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">{t("/mês")}</span>
                </p>
                <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                  {plano.destaques.map((d) => (
                    <li key={d} className="flex gap-2">
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span>{t(d)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-2">
                  {atual ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled
                      title={t("Este já é o plano da sua conta — não há o que trocar aqui.")}
                    >
                      {t("Plano atual")}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={destaque ? "default" : "secondary"}
                      // Sem a chave publicável o formulário não monta. Barrar
                      // aqui evita gastar uma sessão do Stripe para mostrar um
                      // aviso de configuração.
                      disabled={ocupado !== null || (!temAssinatura && semChavePublica)}
                      onClick={() =>
                        temAssinatura ? void abrirPortal() : void abrirCheckout(id)
                      }
                    >
                      {ocupado === id
                        ? t("Abrindo…")
                        : temAssinatura
                          ? t("Trocar para este plano")
                          : t("Assinar")}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {semChavePublica && !temAssinatura ? (
        <p className="text-sm text-muted-foreground">
          {t("O pagamento está indisponível: falta")}{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>{" "}
          {t("nesta instalação.")}
        </p>
      ) : null}
    </div>
  );
}
