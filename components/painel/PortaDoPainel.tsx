"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * A TELA DE SENHA DO PAINEL.
 *
 * ─── Por que aqui e não em `components/site/` ──────────────────────────────
 *
 * `components/site/` é a VITRINE, vista por quem chega de qualquer país: cada
 * frase de lá tem de existir em três idiomas, e o guarda de i18n cobra isso.
 * Esta tela tem UM leitor, o operador, atrás de uma senha que nenhum cliente
 * tem. Numa pasta própria a fronteira vira ESTRUTURA — a pasta diz o que a
 * peça é — em vez de uma linha de exceção dentro de um arquivo de teste.
 *
 * ─── Por que ela não diz nada sobre o erro ─────────────────────────────────
 *
 * "Senha incorreta" é a única mensagem, para qualquer falha — inclusive para o
 * limite de tentativas. Distinguir "errou a senha" de "espere 10 minutos"
 * conta a quem está tentando que o limite existe e qual é a janela, que é
 * metade do que se precisa saber para contorná-lo com paciência.
 *
 * ─── Por que um `fetch` e não uma Server Action ────────────────────────────
 *
 * A porta precisa gravar um cookie e o cookie sai de uma rota que também
 * aplica limite por IP. Uma Server Action faria o mesmo trabalho, mas o limite
 * e a emissão do cookie ficariam num arquivo que também renderiza — e essa é
 * a peça que, se falhar aberta, publica o e-mail de todos os leads. Ela merece
 * ficar sozinha, num arquivo que só faz isso.
 */
export function PortaDoPainel() {
  const [senha, setSenha] = useState("");
  const [estado, setEstado] = useState<"parado" | "enviando" | "erro">("parado");

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setEstado("enviando");
    try {
      const resposta = await fetch("/api/v1/painel/entrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (!resposta.ok) {
        setEstado("erro");
        return;
      }
      // Recarrega em vez de navegar: o cookie acabou de ser gravado e a página
      // é um Server Component — só um GET novo o enxerga.
      window.location.reload();
    } catch {
      setEstado("erro");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Funil</h1>
          <p className="mt-1 text-sm text-text-muted">Esta tela pede a senha do painel.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>

        {estado === "erro" ? (
          <p role="alert" className="text-danger text-sm">
            Senha incorreta.
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={estado === "enviando" || senha === ""}>
          {estado === "enviando" ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
