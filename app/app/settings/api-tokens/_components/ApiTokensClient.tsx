"use client";

import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  useApiTokens,
  useCreateApiToken,
  useRevokeApiToken,
  type CreatedApiToken,
} from "@/hooks/team/useApiTokens";
import { copyToClipboard } from "@/lib/clipboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";

/**
 * `mcp:read`/`mcp:write` faltavam nesta lista, e sem eles NENHUMA ferramenta
 * MCP funciona: toda chamada volta "Token missing required scope 'mcp:read'"
 * (lib/mcp/types.ts exige um dos dois em cada tool). Como esta tela é o único
 * lugar que emite token, o "CRM operável por agentes de IA via MCP" ficava
 * inalcançável — a API sempre aceitou os escopos; só o catálogo daqui os
 * escondia.
 */
const SCOPES: { id: string; label: string }[] = [
  { id: "mcp:read", label: "Agentes de IA podem LER o CRM (MCP)" },
  { id: "mcp:write", label: "Agentes de IA podem AGIR no CRM (MCP)" },
  // Sem isto o token nasce como 'agent' e as ferramentas de nível gerente
  // (criar lead, atribuir conversa) respondem "Role 'agent' insufficient".
  // O papel viaja junto dos escopos (ver lib/mcp/auth.ts) e também não
  // aparecia em lugar nenhum da interface.
  { id: "role:manager", label: "Tratar o token como gerente (necessário p/ criar e atribuir)" },
  { id: "contacts:read", label: "Ler contatos" },
  { id: "contacts:write", label: "Criar e editar contatos" },
  { id: "leads:read", label: "Ler leads" },
  { id: "leads:write", label: "Criar e editar leads" },
  { id: "messages:read", label: "Ler mensagens" },
  { id: "messages:write", label: "Enviar mensagens" },
  { id: "audit:read", label: "Ler o log de auditoria" },
];

/**
 * O token do "Conectar Claude Code / Codex". `role:manager` vai junto porque o
 * atendente externo responde, cria lead e move etapa — sem ele metade das
 * ferramentas volta "Role 'agent' insufficient" e o dono acha que quebrou.
 */
const ESCOPOS_AGENTE_DE_CODIGO = ["mcp:read", "mcp:write", "role:manager"];

const PEDIDO_DE_ATENDIMENTO =
  "Atenda os clientes do Atenza: chame crm_list_awaiting_reply e responda cada conversa com crm_send_whatsapp_message, no tom da empresa. Se ia_interna_no_ar vier true, não responda e me avise.";

function BlocoCopiavel({ titulo, texto }: { titulo: string; texto: string }) {
  const t = useT();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{titulo}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            void copyToClipboard(texto).then((ok) => {
              if (ok) toast.success(t("Copiado."));
              else toast.error(t("Não foi possível copiar — selecione o texto."));
            });
          }}
        >
          {t("Copiar")}
        </Button>
      </div>
      <pre className="whitespace-pre-wrap break-all rounded-md border bg-muted p-2 text-xs">{texto}</pre>
    </div>
  );
}

/**
 * Liga/desliga o modo teste "conversar comigo mesmo" — ver
 * `lib/waha/conversa-consigo-mesmo.ts`. Mora junto da conexão porque é o passo
 * seguinte de quem acabou de ligar o Claude Code e só tem um celular.
 */
function TesteConsigoMesmo() {
  const t = useT();
  const [ligado, setLigado] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/v1/settings/teste-consigo-mesmo")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => vivo && setLigado(Boolean(j?.data?.ligado)))
      .catch(() => vivo && setLigado(false));
    return () => {
      vivo = false;
    };
  }, []);

  const alternar = async () => {
    if (ligado === null) return;
    setSalvando(true);
    try {
      const r = await fetch("/api/v1/settings/teste-consigo-mesmo", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ligado: !ligado }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setLigado(!ligado);
      toast.success(!ligado ? t("Modo teste ligado.") : t("Modo teste desligado."));
    } catch {
      toast.error(t("Não foi possível salvar. Tente de novo."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">{t("Testar pelo meu próprio número")}</p>
        <p className="text-xs text-muted-foreground">
          {t("Com isto ligado, o que você escreve no chat com você mesmo no WhatsApp conta como mensagem de cliente, e a resposta aparece ali. Desligue depois do teste.")}
        </p>
      </div>
      <Button
        type="button"
        variant={ligado ? "default" : "secondary"}
        disabled={ligado === null || salvando}
        onClick={alternar}
        className="w-full sm:w-auto"
      >
        {ligado ? t("Ligado") : t("Desligado")}
      </Button>
    </div>
  );
}

export function ApiTokensClient() {
  const tagDoIdioma = useTagDeIdioma();
  const t = useT();
  const { data, isLoading } = useApiTokens();
  const create = useCreateApiToken();
  const revoke = useRevokeApiToken();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [created, setCreated] = useState<CreatedApiToken | null>(null);
  const [paraAgenteDeCodigo, setParaAgenteDeCodigo] = useState(false);

  const tokens = data?.data ?? [];

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scopes.length === 0) {
      toast.error(t("Selecione ao menos um escopo."));
      return;
    }
    try {
      const res = await create.mutateAsync({
        name,
        scopes,
        expires_in_days: expiresInDays ? Number(expiresInDays) : undefined,
      });
      setParaAgenteDeCodigo(false);
      setCreated(res.data);
      setName("");
      setScopes([]);
      setExpiresInDays("");
      setCreateOpen(false);
    } catch {
      /* noop */
    }
  };

  const conectarAgenteDeCodigo = async () => {
    try {
      const res = await create.mutateAsync({
        name: "Claude Code / Codex",
        scopes: ESCOPOS_AGENTE_DE_CODIGO,
      });
      setParaAgenteDeCodigo(true);
      setCreated(res.data);
    } catch {
      /* noop */
    }
  };

  const toggleScope = (s: string) => {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  return (
    <>
      <div className="rounded-md border p-4 space-y-2">
        <p className="text-sm font-medium">{t("Conectar Claude Code ou Codex")}</p>
        <p className="text-sm text-muted-foreground">
          {t("Liga o seu Claude Code ou Codex ao Atenza. Ele passa a ler e preencher o CRM e pode atender os seus clientes no WhatsApp enquanto estiver aberto no seu computador.")}
        </p>
        <Button onClick={conectarAgenteDeCodigo} disabled={create.isPending} className="w-full sm:w-auto">
          {t("Gerar conexão")}
        </Button>
        <TesteConsigoMesmo />
      </div>

      <div className="flex sm:justify-end">
        <Button variant="secondary" onClick={() => setCreateOpen(true)} className="w-full sm:w-auto">
          {t("Criar token")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("Carregando…")}</p>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Nenhum token criado ainda.")}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Nome")}</TableHead>
                <TableHead>{t("Prefixo")}</TableHead>
                <TableHead>{t("Escopos")}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>{t("Expira")}</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((tok) => (
                <TableRow key={tok.id}>
                  <TableCell className="font-medium">{tok.name}</TableCell>
                  <TableCell>
                    <code className="text-xs">{tok.prefix}…</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tok.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {tok.revoked_at ? (
                      <Badge variant="destructive">{t("Revogado")}</Badge>
                    ) : (
                      <Badge variant="default">{t("Ativo")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tok.expires_at ? new Date(tok.expires_at).toLocaleDateString(tagDoIdioma) : "—"}
                  </TableCell>
                  <TableCell>
                    {!tok.revoked_at ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={revoke.isPending}
                        onClick={async () => {
                          await revoke.mutateAsync(tok.id);
                          toast.success(t("Token revogado."));
                        }}
                      >
                        {t("Revogar")}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Criar novo token")}</DialogTitle>
            <DialogDescription>
              {t("O plaintext será mostrado apenas uma vez.")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="t-name">{t("Nome")}</Label>
              <Input
                id="t-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("Worker de import")}
                minLength={2}
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Escopos")}</Label>
              <div className="flex flex-wrap gap-2">
                {SCOPES.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleScope(s.id)}
                    title={t(s.label)}
                    aria-label={`${s.id} — ${t(s.label)}`}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      scopes.includes(s.id) ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    {s.id}
                    <span className="ml-1 text-muted-foreground">· {t(s.label)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-exp">{t("Expira em (dias) — opcional")}</Label>
              <Input
                id="t-exp"
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="365"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                {t("Cancelar")}
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {t("Criar")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Token criado")}</DialogTitle>
            <DialogDescription>
              {t("Copie e guarde agora — não conseguiremos exibir novamente.")}
            </DialogDescription>
          </DialogHeader>
          {created ? (
            <div className="space-y-3">
              <code className="block break-all rounded-md border bg-muted p-3 text-sm">
                {created.plaintext}
              </code>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void copyToClipboard(created.plaintext).then((ok) => {
                    if (ok) toast.success(t("Token copiado."));
                    else toast.error(t("Não foi possível copiar — selecione o token acima."));
                  });
                }}
              >
                {t("Copiar para clipboard")}
              </Button>
              <p className="text-xs text-muted-foreground">{created._warning}</p>
              {paraAgenteDeCodigo ? (
                <InstrucoesDeConexao token={created.plaintext} />
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>{t("Fechar")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InstrucoesDeConexao({ token }: { token: string }) {
  const t = useT();
  const url = `${typeof window === "undefined" ? "" : window.location.origin}/api/mcp`;
  const claude = `claude mcp add --transport http atenza ${url} --header "Authorization: Bearer ${token}"`;
  const codex = `[mcp_servers.atenza]\nurl = "${url}"\nhttp_headers = { Authorization = "Bearer ${token}" }`;
  return (
    <div className="space-y-3 border-t pt-3">
      <BlocoCopiavel titulo={t("1. Claude Code — cole no terminal")} texto={claude} />
      <BlocoCopiavel titulo={t("1. Codex — cole em ~/.codex/config.toml")} texto={codex} />
      <BlocoCopiavel
        titulo={t("2. Para ele atender os clientes — cole dentro do Claude Code")}
        texto={`/loop 1m ${PEDIDO_DE_ATENDIMENTO}`}
      />
      <p className="text-xs text-muted-foreground">
        {t("Antes de deixar ele atender, pause o agente interno em Agentes de IA — senão o cliente recebe duas respostas. Ele só responde enquanto o Claude Code ou o Codex estiver aberto.")}
      </p>
    </div>
  );
}
