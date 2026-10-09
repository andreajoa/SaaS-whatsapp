"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { useIdioma } from "@/lib/i18n/IdiomaProvider";
import { actionConfigSchema, CONTEXT_KEYS, type ActionConfig, type ActionRow, type Json } from "@/lib/integration-actions/schema";
import type { ExecutionResult } from "@/lib/integration-actions/executor";

interface HistoryRow { id: string; action_id: string | null; action_name: string; state: string; source: string; started_at: string; result: ExecutionResult | null; }
const EMPTY: ActionConfig = {
  name: "", description: "", method: "GET", url_template: "", enabled: false, mutating: false,
  input_schema: { type: "object", properties: { order_id: { type: "string" } }, required: ["order_id"], additionalProperties: false },
  body_template: null, public_headers: {}, allowed_context_keys: [], result_mapping: {}, timeout_ms: 10000, max_response_bytes: 65536,
};
const pretty = (v: unknown) => JSON.stringify(v, null, 2);
async function api<T>(path: string, body?: unknown, method = "GET"): Promise<T> {
  const res = await fetch(`/api/v1/integration-actions${path}`, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  const payload = await res.json();
  if (!res.ok || payload.error) throw new Error(payload.error?.message ?? "Não foi possível concluir a operação.");
  return payload.data as T;
}

export function IntegrationActionsClient() {
  const t = useT();
  const locale = useIdioma();
  const client = useQueryClient();
  const [editing, setEditing] = useState<ActionRow | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const list = useQuery({ queryKey: ["integration-actions"], queryFn: () => api<ActionRow[]>("") });
  const history = useQuery({ queryKey: ["integration-action-history"], queryFn: () => api<HistoryRow[]>("/history"), refetchInterval: 15000 });
  const refresh = () => { void client.invalidateQueries({ queryKey: ["integration-actions"] }); void client.invalidateQueries({ queryKey: ["integration-action-history"] }); };
  const saved = useMutation({ mutationFn: ({ id, payload }: { id?: string; payload: unknown }) => api<ActionRow>(id ? `/${id}` : "", payload, id ? "PATCH" : "POST"), onSuccess: row => { setEditing(row); setFormKey(k => k + 1); setResult(null); toast.success(t("Ação salva.")); refresh(); }, onError: err => toast.error(t(err.message)) });
  const removed = useMutation({ mutationFn: (id: string) => api(`/${id}`, undefined, "DELETE"), onSuccess: () => { setEditing(null); setFormKey(k => k + 1); setResult(null); refresh(); }, onError: err => toast.error(t(err.message)) });
  const executed = useMutation({ mutationFn: ({ id, inputs, confirm_mutation, mode }: { id: string; inputs: Record<string, Json>; confirm_mutation: boolean; mode: "test" | "execute" }) => api<ExecutionResult>(`/${id}/${mode}`, { inputs, confirm_mutation }, "POST"), onSuccess: response => { setResult(response); refresh(); }, onError: err => { toast.error(t(err.message)); refresh(); } });
  const select = (row: ActionRow | null) => { setEditing(row); setResult(null); setFormKey(k => k + 1); };

  return <div className="space-y-6">
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle>{t("Suas ações")}</CardTitle><Button variant="outline" onClick={() => select(null)}>{t("Nova ação")}</Button></CardHeader>
        <CardContent className="space-y-3">
          {list.isLoading && <p role="status" className="text-sm text-muted-foreground">{t("Carregando...")}</p>}
          {list.error && <div role="alert"><p>{t(list.error.message)}</p><Button variant="outline" onClick={() => void list.refetch()}>{t("Tentar novamente")}</Button></div>}
          {!list.isLoading && !list.error && !list.data?.length && <p className="text-sm text-muted-foreground">{t("Crie uma consulta de pedido, estoque ou pagamento para ajudar seu agente a concluir o atendimento.")}</p>}
          {list.data?.map(row => <button key={row.id} type="button" onClick={() => select(row)} aria-pressed={editing?.id === row.id} className="w-full space-y-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{row.configuration.name}</span><Badge variant={row.configuration.enabled ? "success" : "neutral"}>{row.configuration.enabled ? t("Ativa") : t("Pausada")}</Badge></div>
            <p className="text-sm text-muted-foreground">{row.configuration.description}</p>
            <Badge variant={row.configuration.mutating ? "warning" : "neutral"}>{row.configuration.mutating ? t("Altera dados") : t("Somente consulta")}</Badge>
          </button>)}
        </CardContent>
      </Card>
      <ActionEditor key={formKey} row={editing} saving={saved.isPending} onSave={payload => saved.mutate({ id: editing?.id, payload })} />
    </div>

    {editing && <Card>
      <CardHeader><CardTitle>{t("Executar e testar")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("O teste faz uma chamada real ao fornecedor. Salvar ou abrir esta tela nunca executa a ação.")}</p>
        <ExecutionForm key={editing.id + formKey} row={editing} pending={executed.isPending} onRun={(inputs, confirm_mutation, mode) => { setResult(null); executed.mutate({ id: editing.id, inputs, confirm_mutation, mode }); }} />
        {result && <div aria-live="polite" className="space-y-2 rounded-lg border p-4">
          <Badge variant={result.success ? "success" : "error"}>{result.success ? t("Concluída") : t("Falhou")}</Badge>
          {result.message && <p>{t(result.message)}</p>}
          {result.outcome_uncertain && <p className="text-sm text-warning">{t("O fornecedor pode ter aplicado a alteração. Confira antes de repetir; não há repetição automática.")}</p>}
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">{pretty(result)}</pre>
        </div>}
        <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">{t("Excluir ação")}</summary>
          <p className="my-3 text-sm text-muted-foreground">{t("As credenciais serão removidas e o histórico será preservado.")}</p>
          <Button variant="destructive" disabled={removed.isPending || executed.isPending} onClick={() => removed.mutate(editing.id)}>{t("Confirmar exclusão")}</Button>
        </details>
      </CardContent>
    </Card>}

    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle>{t("Histórico de execuções")}</CardTitle><Button variant="outline" onClick={() => void history.refetch()}>{t("Atualizar")}</Button></CardHeader>
      <CardContent className="space-y-3">
        {history.isLoading && <p role="status">{t("Carregando...")}</p>}
        {history.error && <p role="alert">{t(history.error.message)}</p>}
        {!history.isLoading && !history.error && !history.data?.length && <p className="text-sm text-muted-foreground">{t("Nenhuma execução ainda. Salve uma ação e faça um teste quando estiver pronto.")}</p>}
        {history.data?.map(run => <details key={run.id} className="rounded-lg border p-3">
          <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm"><span className="font-medium">{run.action_name}</span><Badge variant={run.state === "succeeded" ? "success" : run.state === "failed" ? "error" : "neutral"}>{run.state === "succeeded" ? t("Concluída") : run.state === "failed" ? t("Falhou") : t("Em execução")}</Badge><span className="text-muted-foreground">{run.source === "agent" ? t("Agente") : run.source === "test" ? t("Teste") : t("Manual")}</span><time dateTime={run.started_at}>{new Date(run.started_at).toLocaleString(locale === "es" ? "es" : "pt-BR")}</time></summary>
          {run.result?.outcome_uncertain && <p className="mt-3 text-sm">{t("O fornecedor pode ter aplicado a alteração. Confira antes de repetir; não há repetição automática.")}</p>}
          {run.state === "running" && <p className="mt-3 text-sm text-muted-foreground">{t("Se esta execução permanecer aberta, confira a operação no fornecedor antes de tentar novamente.")}</p>}
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">{pretty(run.result ?? { execution_id: run.id })}</pre>
        </details>)}
      </CardContent>
    </Card>
  </div>;
}

function ActionEditor({ row, saving, onSave }: { row: ActionRow | null; saving: boolean; onSave: (payload: unknown) => void }) {
  const t = useT();
  const initial = row?.configuration ?? EMPTY;
  const [method, setMethod] = useState<ActionConfig["method"]>(initial.method);
  const [mutating, setMutating] = useState(initial.mutating);
  const [clearCredentials, setClearCredentials] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const configuration = actionConfigSchema.parse({ name: form.get("name"), description: form.get("description"), method, url_template: form.get("url_template"), mutating,
        enabled: form.get("enabled") === "on", input_schema: JSON.parse(String(form.get("input_schema"))), public_headers: JSON.parse(String(form.get("public_headers"))),
        body_template: JSON.parse(String(form.get("body_template"))), result_mapping: JSON.parse(String(form.get("result_mapping"))), allowed_context_keys: form.getAll("context"),
        timeout_ms: Number(form.get("timeout_ms")), max_response_bytes: Number(form.get("max_response_bytes")),
      });
      const credentials = String(form.get("credential_headers") ?? "").trim();
      onSave({ configuration, ...(clearCredentials ? { credential_headers: {} } : credentials ? { credential_headers: JSON.parse(credentials) } : {}) });
    } catch { setError(t("Confira os campos e o JSON. O schema deve declarar additionalProperties: false e somente variáveis permitidas.")); }
  }
  return <Card>
    <CardHeader><CardTitle>{row ? t("Editar ação") : t("Nova ação")}</CardTitle></CardHeader>
    <CardContent><form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="action-name">{t("Nome")}</Label><Input id="action-name" name="name" defaultValue={initial.name} minLength={2} maxLength={100} required /></div>
        <div className="space-y-2"><Label htmlFor="action-method">{t("Método HTTP")}</Label><select id="action-method" value={method} onChange={e => { const next = e.target.value as ActionConfig["method"]; setMethod(next); if (next !== "GET") setMutating(true); }} className="h-9 w-full rounded-md border bg-background px-3 text-sm">{["GET", "POST", "PUT", "PATCH", "DELETE"].map(m => <option key={m}>{m}</option>)}</select></div>
      </div>
      <div className="space-y-2"><Label htmlFor="action-description">{t("Quando o agente deve usar esta ação")}</Label><Textarea id="action-description" name="description" defaultValue={initial.description} minLength={5} maxLength={1000} required /></div>
      <div className="space-y-2"><Label htmlFor="action-url">{t("URL HTTPS do fornecedor")}</Label><Input id="action-url" name="url_template" defaultValue={initial.url_template} placeholder="https://api.sualoja.com/orders/{{input.order_id}}" required /><p className="text-xs text-muted-foreground">{t("Domínio fixo. Use {{input.campo}} no caminho ou na consulta; credenciais nunca entram na URL.")}</p></div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input name="enabled" type="checkbox" defaultChecked={initial.enabled} />{t("Disponível para os agentes selecionados")}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={mutating} disabled={method !== "GET"} onChange={e => setMutating(e.target.checked)} />{t("Esta operação altera dados no fornecedor")}</label>
      </div>
      <div className="space-y-2"><Label htmlFor="action-schema">{t("Schema JSON das entradas")}</Label><Textarea id="action-schema" name="input_schema" defaultValue={pretty(initial.input_schema)} className="min-h-40 font-mono text-xs" required /><p className="text-xs text-muted-foreground">{t("Tipos: object, array, string, number, integer e boolean. Declare properties, required e additionalProperties: false em cada objeto.")}</p></div>
      <div className="space-y-2"><Label htmlFor="action-credentials">{t("Cabeçalhos de credenciais (JSON)")}</Label><Textarea id="action-credentials" name="credential_headers" autoComplete="off" spellCheck={false} disabled={clearCredentials} placeholder={'{"Authorization":"Bearer SUA_CHAVE"}'} className="font-mono text-xs" />
        <p className="text-xs text-muted-foreground">{t("Cifrados no servidor. Deixe vazio para preservar; preencher substitui todos. Valores existentes nunca são exibidos.")}</p>
        {!!row?.credential_header_names.length && <p className="text-xs">{t("Cabeçalhos configurados:")} {row.credential_header_names.join(", ")}</p>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={clearCredentials} onChange={e => setClearCredentials(e.target.checked)} />{t("Remover todas as credenciais ao salvar")}</label>
      </div>
      <details className="rounded-lg border p-3"><summary className="cursor-pointer font-medium">{t("Corpo, retorno e limites")}</summary><div className="mt-4 space-y-4">
        <div className="space-y-2"><Label htmlFor="action-body">{t("Corpo JSON (null para consulta)")}</Label><Textarea id="action-body" name="body_template" defaultValue={pretty(initial.body_template)} className="font-mono text-xs" /><p className="text-xs text-muted-foreground">{t("Uma variável que ocupa todo o valor preserva o tipo JSON. Exemplo: {\"quantity\":\"{{input.quantity}}\"}.")}</p></div>
        <div className="space-y-2"><Label htmlFor="action-return">{t("Campos do resultado (JSON)")}</Label><Textarea id="action-return" name="result_mapping" defaultValue={pretty(initial.result_mapping)} className="font-mono text-xs" /><p className="text-xs text-muted-foreground">{t("Exemplo: {\"status\":\"data.status\"}. Vazio retorna o JSON higienizado, limitado em tamanho.")}</p></div>
        <div className="space-y-2"><Label htmlFor="action-public-headers">{t("Cabeçalhos públicos (JSON)")}</Label><Textarea id="action-public-headers" name="public_headers" defaultValue={pretty(initial.public_headers)} className="font-mono text-xs" /><p className="text-xs text-muted-foreground">{t("Somente Accept, Content-Type e X-Correlation-Id. Os demais ficam nas credenciais cifradas.")}</p></div>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">{t("Identificadores permitidos do contexto")}</legend><p className="text-xs text-muted-foreground">{t("Fornecidos pelo runtime autenticado. Testes manuais devem usar variáveis de entrada.")}</p><div className="flex flex-wrap gap-3">{CONTEXT_KEYS.map(k => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" name="context" value={k} defaultChecked={initial.allowed_context_keys.includes(k)} />{k}</label>)}</div></fieldset>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="action-timeout">{t("Prazo máximo (ms)")}</Label><Input id="action-timeout" name="timeout_ms" type="number" min={1000} max={15000} defaultValue={initial.timeout_ms} /></div><div className="space-y-2"><Label htmlFor="action-bytes">{t("Limite da resposta (bytes)")}</Label><Input id="action-bytes" name="max_response_bytes" type="number" min={1024} max={262144} defaultValue={initial.max_response_bytes} /></div></div>
      </div></details>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={saving}>{saving ? t("Salvando...") : t("Salvar ação")}</Button>
    </form></CardContent>
  </Card>;
}

function ExecutionForm({ row, pending, onRun }: { row: ActionRow; pending: boolean; onRun: (inputs: Record<string, Json>, confirmed: boolean, mode: "test" | "execute") => void }) {
  const t = useT();
  const [inputs, setInputs] = useState("{}");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (mode: "test" | "execute") => {
    try { const values = JSON.parse(inputs); if (!values || Array.isArray(values) || typeof values !== "object") throw new Error(); setError(null); onRun(values, confirmed, mode); }
    catch { setError(t("Envie um objeto JSON válido para as entradas.")); }
  };
  return <div className="space-y-3">
    <Label htmlFor="execution-inputs">{t("Entradas do teste ou execução (JSON)")}</Label><Textarea id="execution-inputs" value={inputs} onChange={e => { setInputs(e.target.value); setConfirmed(false); }} className="font-mono text-xs" />
    {row.configuration.mutating && <label className="flex items-start gap-2 rounded-lg border border-warning p-3 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{t("Confirmo a chamada real que altera dados no fornecedor, inclusive no teste.")}</label>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={pending || (row.configuration.mutating && !confirmed)} onClick={() => run("test")}>{pending ? t("Executando...") : t("Testar chamada real")}</Button><Button disabled={pending || (row.configuration.mutating && !confirmed)} onClick={() => run("execute")}>{t("Executar ação")}</Button></div>
  </div>;
}
