"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";

const rowsSchema = z.array(z.object({ id: z.string().uuid(), configuration: z.object({ name: z.string(), enabled: z.boolean(), mutating: z.boolean(), description: z.string() }) }));
type Action = z.infer<typeof rowsSchema>[number];
export function IntegrationActionPicker({ value, onChange, disabled, operatorEnabled }: {
  value: string[]; onChange: (ids: string[]) => void; disabled: boolean; operatorEnabled: boolean;
}) {
  const t = useT();
  const [rows, setRows] = useState<Action[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/v1/integration-actions", { signal: controller.signal });
        if (!response.ok) throw new Error("load_failed");
        const body: unknown = await response.json();
        const envelope = z.object({ data: rowsSchema }).parse(body);
        if (!controller.signal.aborted) { setRows(envelope.data); setState("ready"); }
      } catch { if (!controller.signal.aborted) setState("error"); }
    })();
    return () => controller.abort();
  }, [retry]);
  const unavailable = value.filter(id => !rows.some(row => row.id === id && row.configuration.enabled));
  return <Card className="space-y-3 p-4">
    <h3 className="text-sm font-medium">{t("Ações conectadas a outras ferramentas")}</h3>
    <p className="text-xs text-muted-foreground">{t(operatorEnabled ? "As ações selecionadas ficam disponíveis para o Operador. Publicar esta versão autoriza sua execução durante o atendimento." : "As ações selecionadas ficam disponíveis para este agente. Publicar esta versão autoriza sua execução durante o atendimento.")}</p>
    {state === "loading" && <p role="status" className="text-sm">{t("Carregando ações…")}</p>}
    {state === "error" && <div role="alert"><p className="text-sm">{t("Não foi possível carregar as ações. Sua seleção foi preservada.")}</p><Button type="button" variant="outline" onClick={() => { setState("loading"); setRetry(n => n + 1); }}>{t("Tentar novamente")}</Button></div>}
    {state === "ready" && rows.length === 0 && <p className="text-sm text-muted-foreground">{t("Crie uma ação para consultar pedidos, atualizar seu CRM ou conectar uma API.")}</p>}
    {state === "ready" && rows.map(row => <label key={row.id} className="flex items-start gap-3 rounded-md border p-3">
      <input type="checkbox" className="mt-1 accent-primary" checked={value.includes(row.id)} disabled={disabled || (!row.configuration.enabled && !value.includes(row.id)) || (value.length >= 25 && !value.includes(row.id))} onChange={e => onChange(e.target.checked ? [...value, row.id] : value.filter(id => id !== row.id))} />
      <span><span className="block text-sm font-medium">{row.configuration.name}</span><span className="block text-xs text-muted-foreground">{row.configuration.description}</span><span className="text-xs">{t(!row.configuration.enabled ? "Pausada" : row.configuration.mutating ? "Altera dados no fornecedor" : "Somente consulta")}</span></span>
    </label>)}
    {state === "ready" && unavailable.length > 0 && <div role="alert" className="text-sm text-destructive"><p>{t("Existem ações selecionadas que estão indisponíveis. Revise a seleção antes de publicar.")}</p><Button type="button" variant="outline" disabled={disabled} onClick={() => onChange(value.filter(id => !unavailable.includes(id)))}>{t("Remover ações indisponíveis")}</Button></div>}
    <Link href="/app/integration-actions" className="text-sm underline underline-offset-4">{t("Gerenciar ações e credenciais")}</Link>
  </Card>;
}
