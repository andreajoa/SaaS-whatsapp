"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * O formulário do site, com os textos JÁ traduzidos.
 *
 * As frases chegam por prop e não por `t()` porque a tradução da vitrine mora
 * no servidor (`textoDoSite`, que conhece três idiomas) e o dicionário do
 * cliente conhece dois. Traduzir aqui dentro faria um visitante indiano ver a
 * página em inglês e o formulário em português — a meia-tradução que a
 * doutrina da vitrine existe para impedir.
 */
export interface TextosDoContato {
  nome: string;
  email: string;
  assunto: string;
  mensagem: string;
  enviar: string;
  enviando: string;
  sucesso: string;
  erro: string;
}

type Estado = "parado" | "enviando" | "enviado" | "erro";

export function FormularioDeContato({ textos }: { textos: TextosDoContato }) {
  const [estado, setEstado] = useState<Estado>("parado");
  const [detalhe, setDetalhe] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const dados = Object.fromEntries(new FormData(form).entries());
    setEstado("enviando");
    setDetalhe(null);
    try {
      const resposta = await fetch("/api/v1/site/contato", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(dados),
      });
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setDetalhe(corpo?.error?.message ?? null);
        setEstado("erro");
        return;
      }
      form.reset();
      setEstado("enviado");
    } catch {
      setEstado("erro");
    }
  }

  if (estado === "enviado") {
    return (
      <p className="rounded-md border border-emerald-600/30 bg-emerald-600/10 p-4 text-sm">
        {textos.sucesso}
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="contato-nome">{textos.nome}</Label>
        <Input id="contato-nome" name="nome" required minLength={2} maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contato-email">{textos.email}</Label>
        <Input id="contato-email" name="email" type="email" required maxLength={200} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contato-assunto">{textos.assunto}</Label>
        <Input id="contato-assunto" name="assunto" required minLength={2} maxLength={160} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contato-mensagem">{textos.mensagem}</Label>
        <Textarea
          id="contato-mensagem"
          name="mensagem"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
        />
      </div>

      {/* Campo-armadilha: invisível para gente, irresistível para robô. */}
      <input
        type="text"
        name="empresa_site"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      {estado === "erro" ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
          {detalhe ?? textos.erro}
        </p>
      ) : null}

      <Button type="submit" disabled={estado === "enviando"} className="w-full">
        {estado === "enviando" ? textos.enviando : textos.enviar}
      </Button>
    </form>
  );
}
