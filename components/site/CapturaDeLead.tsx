"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * O CAMPO DE E-MAIL — um componente, dois lugares.
 *
 * ─── Por que o rodapé e o pop-up compartilham esta peça ────────────────────
 *
 * São a mesma pergunta feita em dois momentos. Duplicá-la garantiria que uma
 * das duas cópias ficasse para trás — e a que fica para trás é sempre a que
 * manda para a rota errada, ou a que esquece o campo-armadilha. Aqui há um
 * lugar só onde o envio pode estar certo ou errado.
 *
 * ─── Por que os textos chegam por prop, e não por `t()` ────────────────────
 *
 * A mesma razão de `FormularioDeContato`: a tradução da vitrine mora no
 * servidor (`textoDoSite`, que conhece três idiomas) e o dicionário do cliente
 * conhece dois. Chamar `t()` aqui dentro faria um visitante indiano ver a
 * página em inglês e o formulário em português — e, de quebra, arrastaria as
 * milhares de linhas do dicionário para o bundle da página de vendas.
 *
 * ─── Por que a mensagem de sucesso não diz "cadastrado" ────────────────────
 *
 * A rota responde a mesma coisa para quem é novo, para quem já estava na lista
 * e para quem se descadastrou — dizer qual dos três seria contar a um estranho
 * quem está aqui dentro, um endereço por vez. A tela segue a rota: ela
 * confirma que RECEBEU, não que cadastrou.
 *
 * ─── O campo-armadilha ─────────────────────────────────────────────────────
 *
 * `empresa_site` fica fora da tela e fora da ordem de tabulação, e nenhum
 * leitor de tela o anuncia (`aria-hidden` + `tabIndex={-1}`). Robô de
 * formulário preenche todo `input` que encontra; gente não preenche o que não
 * vê. Quem o preenche recebe sucesso e não gera linha nenhuma.
 */
export interface TextosDaCaptura {
  rotulo: string;
  exemplo: string;
  enviar: string;
  enviando: string;
  promessa: string;
  sucesso: string;
  erro: string;
}

export function CapturaDeLead({
  textos,
  idioma,
  moeda,
  origem,
  aoInscrever,
  className,
}: {
  readonly textos: TextosDaCaptura;
  readonly idioma: string;
  readonly moeda: string;
  readonly origem: "popup" | "rodape";
  /** O convite usa isto para lembrar que esta pessoa já respondeu. */
  readonly aoInscrever?: () => void;
  readonly className?: string;
}) {
  const [email, setEmail] = useState("");
  const [armadilha, setArmadilha] = useState("");
  const [estado, setEstado] = useState<"parado" | "enviando" | "pronto" | "erro">("parado");

  async function inscrever(evento: React.FormEvent) {
    evento.preventDefault();
    setEstado("enviando");
    try {
      const resposta = await fetch("/api/v1/site/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, origem, idioma, moeda, empresa_site: armadilha }),
      });
      if (!resposta.ok) {
        setEstado("erro");
        return;
      }
      setEstado("pronto");
      aoInscrever?.();
    } catch {
      setEstado("erro");
    }
  }

  if (estado === "pronto") {
    return (
      <p role="status" className={`text-sm text-text-muted ${className ?? ""}`}>
        {textos.sucesso}
      </p>
    );
  }

  return (
    <form onSubmit={inscrever} className={`space-y-2 ${className ?? ""}`}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder={textos.exemplo}
          aria-label={textos.rotulo}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="sm:flex-1"
        />
        {/* Campo-armadilha: invisível, fora da tabulação, mudo para o leitor de tela. */}
        <input
          type="text"
          name="empresa_site"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={armadilha}
          onChange={(e) => setArmadilha(e.target.value)}
          className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
        />
        <Button type="submit" disabled={estado === "enviando" || email.trim() === ""}>
          {estado === "enviando" ? textos.enviando : textos.enviar}
        </Button>
      </div>

      {estado === "erro" ? (
        <p role="alert" className="text-danger text-sm">
          {textos.erro}
        </p>
      ) : (
        <p className="text-xs text-text-muted">{textos.promessa}</p>
      )}
    </form>
  );
}
