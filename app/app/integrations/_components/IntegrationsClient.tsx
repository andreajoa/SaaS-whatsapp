"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { ArrowRight, CheckCircle, Clock, Plugs, Storefront } from "@/lib/ui/icons";
import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import type { CommerceProvider } from "@/lib/commerce/types";

const responseSchema = z.object({ connections: z.array(z.object({ id: z.string(), provider: z.string(), status: z.string(), status_reason: z.string().nullable(), last_sync_at: z.string().nullable(), expires_at: z.string().nullable(), store_metadata: z.object({ name: z.string().optional(), store_url: z.string().optional(), webhook_enabled: z.boolean().optional() }).passthrough() })), runs: z.array(z.object({ id: z.string(), integration_id: z.string(), status: z.string(), phase: z.string(), product_count: z.number(), order_count: z.number(), error_code: z.string().nullable(), started_at: z.string(), completed_at: z.string().nullable() })), shopify_oauth_available: z.boolean() });
type Data = z.infer<typeof responseSchema>;
type Feedback = { shopifyResult: string | null; message: string | null };
const NAMES: Record<string, string> = { shopify: "Shopify", woocommerce: "WooCommerce", nuvemshop: "Nuvemshop" };
const STATUS: Record<string, string> = { healthy: "Conectada", error: "Precisa de atenção", connecting: "Conectando", disconnected: "Desconectada", token_expired: "Reconecte a loja", queued: "Na fila", running: "Sincronizando", completed: "Concluída", failed: "Falhou", cancelled: "Cancelada" };

export function IntegrationsClient() {
  const t = useT(); const locale = useTagDeIdioma(); const params = useSearchParams();
  const shopifyResult = params.get("shopify");
  const oauthNotice = shopifyResult === "connected"
    ? "Shopify conectada. Os produtos e pedidos estão sendo sincronizados."
    : shopifyResult === "connected_manual_sync"
      ? "Shopify conectada. Alguns avisos automáticos precisam de configuração; você pode sincronizar manualmente."
      : null;
  const oauthError = shopifyResult && !oauthNotice
    ? "Não foi possível concluir a autorização Shopify. Abra a conexão e tente novamente."
    : null;
  const [data, setData] = useState<Data | null>(null);
  const [errorState, setErrorState] = useState<Feedback | null>(null);
  const [noticeState, setNoticeState] = useState<Feedback | null>(null);
  const error = errorState?.shopifyResult === shopifyResult ? errorState.message : oauthError;
  const notice = noticeState?.shopifyResult === shopifyResult ? noticeState.message : oauthNotice;
  const setError = useCallback((message: string | null) => setErrorState({ shopifyResult, message }), [shopifyResult]);
  const setNotice = (message: string) => setNoticeState({ shopifyResult, message });
  const [busy, setBusy] = useState<string | null>(null);
  const [provider, setProvider] = useState<CommerceProvider | null>(null);
  const [disconnecting, setDisconnecting] = useState<CommerceProvider | null>(null);
  const [store, setStore] = useState(""); const [token, setToken] = useState(""); const [secret, setSecret] = useState("");
  const [advanced, setAdvanced] = useState(false); const [formError, setFormError] = useState<string | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const load = useCallback(async (signal = requestController.current?.signal) => {
    if (!signal || signal.aborted) return;
    const sequence = ++requestSequence.current;
    await fetch("/api/v1/integrations/commerce", { cache: "no-store", signal }).then(async (res) => {
      const body: unknown = await res.json();
      if (!res.ok) throw new Error("Não foi possível carregar suas integrações. Tente novamente.");
      return responseSchema.parse(z.object({ data: z.unknown() }).parse(body).data);
    }).then((snapshot) => {
      if (signal.aborted || sequence !== requestSequence.current) return;
      setData(snapshot); setError(null);
    }, (e: unknown) => {
      if (signal.aborted || sequence !== requestSequence.current) return;
      setError(e instanceof Error ? e.message : "Não foi possível carregar suas integrações.");
    });
  }, [setError]);
  useEffect(() => {
    const controller = new AbortController();
    requestController.current = controller;
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const syncing = data?.runs.some((r) => ["queued", "running"].includes(r.status)) ?? false;
  useEffect(() => {
    if (!syncing) return;
    const timer = setInterval(() => { void load(); }, 5000); return () => clearInterval(timer);
  }, [syncing, load]);
  async function mutation(path: string, method: string, signal: AbortSignal, body?: unknown) {
    const res = await fetch(path, { method, signal, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json: unknown = await res.json();
    if (!res.ok) {
      const parsed = z.object({ error: z.object({ message: z.string() }) }).safeParse(json);
      throw new Error(parsed.success ? parsed.data.error.message : "Não foi possível concluir. Tente novamente.");
    }
    return json;
  }
  async function connect(e: React.FormEvent) {
    e.preventDefault(); if (!provider) return; setFormError(null);
    const signal = requestController.current?.signal;
    if (!signal || signal.aborted) return;
    const url = store.startsWith("https://") ? store : `https://${store}`;
    if (provider === "shopify" && data?.shopify_oauth_available && !advanced) {
      try { const parsed = new URL(url); if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(parsed.hostname)) throw new Error(); }
      catch { setFormError("Informe sua-loja.myshopify.com."); return; }
      window.location.assign(`/api/v1/integrations/shopify/authorize?store_url=${encodeURIComponent(url)}`); return;
    }
    setBusy(provider);
    try {
      await mutation("/api/v1/integrations/commerce", "POST", signal, { provider, store_url: url, access_token: token, ...(secret ? { consumer_secret: secret } : {}) });
      if (signal.aborted) return;
      setProvider(null); setToken(""); setSecret(""); setNotice("Loja conectada. A sincronização foi colocada na fila."); await load(signal);
    } catch (e) { if (!signal.aborted) setFormError(e instanceof Error ? e.message : "Não foi possível conectar."); }
    finally { if (!signal.aborted) setBusy(null); }
  }
  async function action(value: CommerceProvider, disconnect = false) {
    const signal = requestController.current?.signal;
    if (!signal || signal.aborted) return;
    setBusy(value); setError(null);
    try {
      await mutation(`/api/v1/integrations/commerce/${value}`, disconnect ? "DELETE" : "POST", signal);
      if (signal.aborted) return;
      setNotice(disconnect ? "Loja desconectada. O histórico foi preservado e seus produtos deixaram de ser oferecidos." : "Sincronização solicitada. Você pode acompanhar o progresso abaixo.");
      setDisconnecting(null); await load(signal);
    } catch (e) { if (!signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível concluir."); }
    finally { if (!signal.aborted) setBusy(null); }
  }
  const formatDate = (date: string) => new Date(date).toLocaleString(locale);
  return <div className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-8">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="max-w-2xl"><p className="mb-2 text-sm font-medium text-muted-foreground">{t("Sua operação conectada")}</p><h1 className="text-3xl font-semibold tracking-tight">{t("Integrações")}</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("Traga o catálogo e os pedidos da sua loja para a conversa. A IA e a equipe usam os mesmos dados para responder com mais precisão e ajudar o cliente a comprar.")}</p></div>
      <Button variant="outline" onClick={() => { void load(); }}>{t("Atualizar status")}</Button>
    </header>
    {error && <div role="alert" className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm"><WarningCircle size={20} className="shrink-0 text-destructive" /><div className="flex-1">{t(error)}</div><Button size="sm" variant="outline" onClick={() => { void load(); }}>{t("Tentar novamente")}</Button></div>}
    {notice && <p role="status" className="flex gap-2 rounded-md border border-border bg-surface p-4 text-sm"><CheckCircle size={20} className="shrink-0 text-primary" />{t(notice)}</p>}
    {!data && !error ? <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((n) => <Skeleton key={n} className="h-64 w-full" />)}</div> : <section aria-label={t("Lojas disponíveis")} className="grid gap-4 md:grid-cols-3">
      {(["shopify", "woocommerce", "nuvemshop"] as const).map((value) => {
        const connection = data?.connections.find((c) => c.provider === value);
        const connected = !!connection && connection.status !== "disconnected";
        const run = data?.runs.find((r) => r.integration_id === connection?.id);
        return <Card key={value} className="flex flex-col"><CardHeader><div className="mb-3 flex items-center justify-between gap-2"><span className="rounded-md border border-border bg-muted/40 p-2"><Storefront size={26} /></span><Badge variant={connection?.status === "error" ? "destructive" : "secondary"}>{t(connected ? STATUS[connection.status] ?? "Verificar conexão" : "Disponível")}</Badge></div><CardTitle>{NAMES[value]}</CardTitle><CardDescription>{t(value === "nuvemshop" ? "Pedidos, produtos e clientes conectados ao seu atendimento." : "Produtos, variantes, preços, estoque e pedidos no atendimento.")}</CardDescription></CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4"><div className="min-h-20 space-y-2 text-sm">{connected ? <><p className="font-medium">{connection.store_metadata.name || NAMES[value]}</p><p className="break-all text-xs text-muted-foreground">{connection.store_metadata.store_url}</p><p className="text-muted-foreground">{t("Última sincronização:")} {connection.last_sync_at ? formatDate(connection.last_sync_at) : t("Aguardando a primeira")}</p>{value !== "nuvemshop" && <p className="text-xs text-muted-foreground">{t(connection.store_metadata.webhook_enabled ? "Atualização automática por eventos da loja" : "Sincronização manual disponível")}</p>}{run && ["queued", "running"].includes(run.status) && <p role="status" className="flex items-center gap-2"><Clock size={16} />{t(STATUS[run.status]!)} · {run.product_count} {t("produtos")} · {run.order_count} {t("pedidos")}</p>}{connection.status_reason && <p className="text-sm text-destructive">{t(connection.status_reason)}</p>}</> : <p className="leading-relaxed text-muted-foreground">{t("Conecte uma loja para consultar informações reais sem sair da conversa.")}</p>}</div>
            <div className="mt-auto flex flex-wrap gap-2">{value === "nuvemshop" ? <Button asChild className="w-full" variant="outline"><Link href="/app/integrations/nuvemshop">{t(connected ? "Gerenciar" : "Conectar Nuvemshop")}<ArrowRight size={16} className="ml-2" /></Link></Button> : connected ? <><Button disabled={busy === value || !!run && ["queued", "running"].includes(run.status)} onClick={() => { void action(value); }}>{t(busy === value ? "Aguarde…" : "Sincronizar")}</Button><Button variant="outline" disabled={busy === value} onClick={() => { setProvider(value); setAdvanced(false); setStore(connection.store_metadata.store_url ?? ""); setFormError(null); }}>{t("Reconectar")}</Button><Button size="sm" variant="ghost" disabled={busy === value} onClick={() => setDisconnecting(value)}>{t("Desconectar")}</Button></> : <Button className="w-full" onClick={() => { setProvider(value); setStore(""); setToken(""); setSecret(""); setAdvanced(false); setFormError(null); }}>{t("Conectar")} {NAMES[value]}<ArrowRight size={16} className="ml-2" /></Button>}</div>
          </CardContent></Card>;
      })}
    </section>}
    <section className="grid gap-4 md:grid-cols-2"><Card><CardHeader><Plugs size={25} className="mb-2 text-primary" /><CardTitle>{t("Conecte outras ferramentas")}</CardTitle><CardDescription>{t("Consulte um ERP, registre dados no CRM ou execute uma ação na ferramenta que sua equipe já usa.")}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/app/integration-actions">{t("Ações por API")}<ArrowRight size={16} className="ml-2" /></Link></Button><Button asChild variant="ghost"><Link href="/app/webhooks">{t("Webhooks e automações")}</Link></Button></CardContent></Card><Card><CardHeader><CheckCircle size={25} className="mb-2 text-primary" /><CardTitle>{t("Dados que ajudam a vender")}</CardTitle><CardDescription>{t("Os produtos sincronizados entram no catálogo que o assistente consulta. Os pedidos associados ao contato aparecem no histórico de compras.")}</CardDescription></CardHeader><CardContent><p className="text-xs leading-relaxed text-muted-foreground">{t("Shopify: os últimos 60 dias de pedidos dependem das permissões do aplicativo. Informações de clientes podem exigir autorização adicional da Shopify. Nenhuma compra ou alteração na loja é feita por estas conexões.")}</p></CardContent></Card></section>
    {!!data?.runs.length && <Card><CardHeader><CardTitle>{t("Histórico de sincronização")}</CardTitle><CardDescription>{t("Acompanhe o que foi importado e resolva falhas antes de afetarem o atendimento.")}</CardDescription></CardHeader><CardContent className="space-y-3">{data.runs.slice(0, 8).map((run) => <div key={run.id} className="flex flex-col justify-between gap-2 border-b border-border pb-3 text-sm last:border-0 sm:flex-row"><div><p className="font-medium">{NAMES[data.connections.find((c) => c.id === run.integration_id)?.provider ?? ""] ?? t("Loja")} · {t(STATUS[run.status] ?? run.status)}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(run.started_at)} · {run.product_count} {t("produtos")} · {run.order_count} {t("pedidos")}</p>{run.error_code && <p role="alert" className="mt-2 text-destructive">{t(run.error_code)}</p>}</div>{run.status === "failed" && <p className="text-xs text-muted-foreground">{t("Verifique as permissões e use Sincronizar para tentar novamente.")}</p>}</div>)}</CardContent></Card>}
    <Dialog open={provider !== null} onOpenChange={(open) => { if (!open && !busy) { setProvider(null); setToken(""); setSecret(""); } }}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{t("Conectar")} {provider ? NAMES[provider] : ""}</DialogTitle><DialogDescription>{t("Sua loja continua funcionando normalmente. Vamos ler o catálogo e os pedidos para ajudar no atendimento.")}</DialogDescription></DialogHeader><form onSubmit={connect} className="space-y-4"><div className="space-y-2"><Label htmlFor="commerce-store">{t("Endereço da loja")}</Label><Input id="commerce-store" value={store} onChange={(e) => setStore(e.target.value)} placeholder={provider === "shopify" ? "sua-loja.myshopify.com" : "https://sualoja.com.br"} required autoComplete="url" /></div>
      {provider === "shopify" && data?.shopify_oauth_available && !advanced ? <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">{t("Você será levado à Shopify para autorizar o acesso. Depois voltará para acompanhar a sincronização.")}</p> : <><p className="text-xs leading-relaxed text-muted-foreground">{t(provider === "woocommerce" ? "Na sua loja: WooCommerce → Configurações → Avançado → REST API. Crie uma chave com permissão de leitura e informe o par abaixo." : "Use a credencial de um aplicativo próprio com leitura de produtos, estoque e pedidos. Para conexão com renovação automática, solicite a ativação da autorização Shopify ao administrador.")}</p><div className="space-y-2"><Label htmlFor="commerce-token">{t(provider === "woocommerce" ? "Consumer key" : "Token de acesso")}</Label><Input id="commerce-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} required autoComplete="off" /></div>{provider === "woocommerce" && <div className="space-y-2"><Label htmlFor="commerce-secret">{t("Consumer secret")}</Label><Input id="commerce-secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} required autoComplete="off" /></div>}<p className="text-xs text-muted-foreground">{t("As credenciais são protegidas e não serão exibidas novamente.")}</p></>}
      {formError && <p role="alert" className="text-sm text-destructive">{t(formError)}</p>}<DialogFooter><Button type="button" variant="outline" disabled={!!busy} onClick={() => { setProvider(null); setToken(""); setSecret(""); }}>{t("Cancelar")}</Button><Button type="submit" disabled={!!busy}>{t(busy ? "Validando conexão…" : provider === "shopify" && data?.shopify_oauth_available && !advanced ? "Autorizar na Shopify" : "Validar e conectar")}</Button></DialogFooter>{provider === "shopify" && data?.shopify_oauth_available && <Button className="h-auto p-0 text-xs" variant="link" type="button" disabled={!!busy} onClick={() => setAdvanced(!advanced)}>{t(advanced ? "Usar autorização Shopify" : "Usar credencial de aplicativo próprio")}</Button>}</form></DialogContent></Dialog>
    <Dialog open={disconnecting !== null} onOpenChange={(open) => { if (!open && !busy) setDisconnecting(null); }}><DialogContent><DialogHeader><DialogTitle>{t("Desconectar a loja?")}</DialogTitle><DialogDescription>{t("Os pedidos já importados serão preservados. Os produtos desta conexão deixarão de ser oferecidos pela IA até você reconectar e sincronizar.")}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={!!busy} onClick={() => setDisconnecting(null)}>{t("Manter conexão")}</Button><Button variant="destructive" disabled={!!busy} onClick={() => { if (disconnecting) void action(disconnecting, true); }}>{t(busy ? "Desconectando…" : "Desconectar")}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
