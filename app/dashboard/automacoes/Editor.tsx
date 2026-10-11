"use client";

import { useActionState, useState } from "react";
import { editarAutomacao } from "./actions";
import {
  dataDeSaoPaulo,
  dataParaCampo,
  NOMES_AUTOMACOES,
  type Automacao,
} from "@/lib/marketing/automacoes-catalogo";

const campo = "mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm";
const idiomas = [
  { id: "pt-BR", nome: "Português" },
  { id: "en", nome: "English" },
  { id: "es", nome: "Español" },
] as const;

export function Editor({ inicial, semBanco }: { inicial: Automacao; semBanco: boolean }) {
  const [config, setConfig] = useState(inicial);
  const [idioma, setIdioma] = useState<"pt-BR" | "en" | "es">("pt-BR");
  const [estado, action, pending] = useActionState(editarAutomacao, { ok: false, mensagem: "" });
  const texto = config.textos[idioma];
  const transactional = config.audience === "transacional";
  const alterarTexto = (part: Partial<typeof texto>) =>
    setConfig((current) => ({
      ...current,
      textos: { ...current.textos, [idioma]: { ...current.textos[idioma], ...part } },
    }));
  const alterarCorpo = (part: Partial<typeof texto.corpo>) =>
    alterarTexto({ corpo: { ...texto.corpo, ...part } });
  const ativo = estado.saved?.enabled ?? config.enabled;
  return (
    <details
      className="rounded-xl border border-border bg-surface p-5"
      open={inicial.id === "black-friday"}
    >
      <summary className="cursor-pointer font-medium">
        {NOMES_AUTOMACOES[config.id]}{" "}
        <span className="ml-2 rounded-full border border-border px-2 py-1 text-xs text-text-muted">
          {ativo ? "Ativada" : "Rascunho / pausada"}
        </span>
      </summary>
      <p className="mt-3 text-sm text-text-muted">
        {transactional
          ? "Aviso de cobrança disparado por evento assinado do Stripe. Não é campanha comercial."
          : config.id === "cadastro-sem-assinatura"
            ? "Após 24 horas do cadastro, uma vez por conta. Exige consentimento e ausência de assinatura vigente."
            : "Uma mensagem por pessoa nesta campanha e ano. Exige consentimento explícito e respeita 24 horas entre mensagens comerciais."}
      </p>
      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="automacao" value={JSON.stringify(config)} />
        <input type="hidden" name="idioma" value={idioma} />
        {!transactional && (
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm">
              Início (São Paulo)
              <input
                type="date"
                className={campo}
                value={dataParaCampo(config.starts_at)}
                onChange={(e) => {
                  if (e.target.value)
                    setConfig({ ...config, starts_at: dataDeSaoPaulo(e.target.value) });
                }}
                required
              />
            </label>
            <label className="text-sm">
              Último dia (São Paulo)
              <input
                type="date"
                className={campo}
                value={dataParaCampo(config.ends_at, true)}
                onChange={(e) => {
                  if (e.target.value)
                    setConfig({ ...config, ends_at: dataDeSaoPaulo(e.target.value, true) });
                }}
                required
              />
            </label>
            <label className="text-sm">
              Público
              <select
                className={campo}
                value={config.audience}
                disabled={config.id === "cadastro-sem-assinatura"}
                onChange={(e) =>
                  setConfig({ ...config, audience: e.target.value as Automacao["audience"] })
                }
              >
                {config.id === "cadastro-sem-assinatura" ? (
                  <option value="cadastro_sem_assinatura">Cadastro sem assinatura</option>
                ) : (
                  <>
                    <option value="nao_assinantes">Sem assinatura vigente</option>
                    <option value="assinantes">Com assinatura vigente</option>
                    <option value="todos">Todos com consentimento</option>
                  </>
                )}
              </select>
            </label>
          </div>
        )}
        <fieldset>
          <legend className="text-sm">Idioma da mensagem</legend>
          <div className="mt-2 flex gap-2">
            {idiomas.map((i) => (
              <button
                key={i.id}
                type="button"
                aria-pressed={idioma === i.id}
                onClick={() => setIdioma(i.id)}
                className={`rounded-md border border-border px-3 py-1.5 text-sm ${idioma === i.id ? "bg-text text-bg" : "text-text-muted"}`}
              >
                {i.nome}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          Assunto
          <input
            className={campo}
            value={texto.assunto}
            maxLength={160}
            required
            onChange={(e) => alterarTexto({ assunto: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Título
          <input
            className={campo}
            value={texto.corpo.titulo}
            maxLength={160}
            required
            onChange={(e) => alterarCorpo({ titulo: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Mensagem <span className="text-text-muted">(separe parágrafos com uma linha vazia)</span>
          <textarea
            className={campo}
            rows={5}
            value={texto.corpo.paragrafos.join("\n\n")}
            required
            onChange={(e) => alterarCorpo({ paragrafos: e.target.value.split(/\n\s*\n/) })}
          />
        </label>
        {texto.corpo.destaques?.length ? (
          <label className="block text-sm">
            Destaques (um por linha)
            <textarea
              className={campo}
              rows={3}
              value={texto.corpo.destaques.join("\n")}
              onChange={(e) =>
                alterarCorpo({ destaques: e.target.value.split("\n").filter(Boolean) })
              }
            />
          </label>
        ) : null}
        <label className="block text-sm">
          Fecho
          <input
            className={campo}
            value={texto.corpo.posEscrito ?? ""}
            onChange={(e) => alterarCorpo({ posEscrito: e.target.value })}
          />
        </label>
        {texto.corpo.acao && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Texto do botão
              <input
                className={campo}
                value={texto.corpo.acao.rotulo}
                required
                onChange={(e) =>
                  alterarCorpo({
                    acao: { rotulo: e.target.value, caminho: texto.corpo.acao!.caminho },
                  })
                }
              />
            </label>
            <label className="text-sm">
              Destino no site
              <input
                className={campo}
                value={texto.corpo.acao.caminho}
                required
                onChange={(e) =>
                  alterarCorpo({
                    acao: { caminho: e.target.value, rotulo: texto.corpo.acao!.rotulo },
                  })
                }
              />
            </label>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            name="modo"
            value="preview"
            disabled={pending}
            className="rounded-lg border border-border px-4 py-2 text-sm"
          >
            Prévia sem envio
          </button>
          <button
            name="modo"
            value="salvar"
            disabled={pending || semBanco}
            className="rounded-lg border border-border px-4 py-2 text-sm"
          >
            Salvar rascunho / pausar
          </button>
          <button
            name="modo"
            value="ativar"
            disabled={pending || semBanco}
            className="rounded-lg bg-text px-4 py-2 text-sm text-bg"
          >
            Salvar e ativar
          </button>
        </div>
        {estado.mensagem && (
          <p role="status" className={`text-sm ${estado.ok ? "text-text-muted" : "text-red-500"}`}>
            {estado.mensagem}
          </p>
        )}
        {estado.preview && (
          <iframe
            title={`Prévia de ${NOMES_AUTOMACOES[config.id]}`}
            sandbox=""
            srcDoc={estado.preview}
            className="h-[560px] w-full rounded-lg border border-border bg-white"
          />
        )}
      </form>
    </details>
  );
}
