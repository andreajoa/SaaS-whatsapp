"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Code2,
  KanbanSquare,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  MessagesSquare,
  PlayCircle,
  Repeat2,
  ShieldCheck,
  Sparkles,
  BookOpen,
  X,
} from "lucide-react";

import type { GrupoDoMenu, IconeDoMenu, MenuDoSite } from "@/lib/marketing/menu";
import styles from "./megamenu.module.css";

const ICONES: Record<IconeDoMenu, typeof Bot> = {
  equipe: MessagesSquare,
  ia: Sparkles,
  robo: Bot,
  funil: KanbanSquare,
  campanha: Megaphone,
  followup: Repeat2,
  agenda: CalendarDays,
  relatorio: BarChart3,
  api: Code2,
  lgpd: ShieldCheck,
  video: PlayCircle,
  guia: BookOpen,
  perguntas: CircleHelp,
  contato: Mail,
  regiao: MapPin,
};

/**
 * O MEGA MENU — funcionalidades, segmentos e recursos, com imagem.
 *
 * Abre ao passar o mouse (com uma pequena espera, para não piscar quando o
 * cursor só atravessa a barra) e ao clicar; fecha com Esc, clique fora ou ao
 * escolher um item. Teclado: Tab percorre os botões e os links do painel.
 * No celular vira uma gaveta com seções sanfonadas.
 */
export function MegaMenu({ menu }: { readonly menu: MenuDoSite }) {
  const [aberto, setAberto] = useState<GrupoDoMenu["id"] | null>(null);
  const [gaveta, setGaveta] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const espera = useRef<number | null>(null);
  const base = useId();

  const fechar = useCallback(() => {
    if (espera.current) window.clearTimeout(espera.current);
    setAberto(null);
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setGaveta(false);
      setAberto((atual) => {
        if (atual) document.getElementById(`${base}-botao-${atual}`)?.focus();
        return null;
      });
    };
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(null);
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", fora);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", fora);
    };
  }, [base]);

  useEffect(() => {
    document.body.style.overflow = gaveta ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [gaveta]);

  const passar = (id: GrupoDoMenu["id"]) => {
    if (espera.current) window.clearTimeout(espera.current);
    espera.current = window.setTimeout(() => setAberto(id), 90);
  };
  const sair = () => {
    if (espera.current) window.clearTimeout(espera.current);
    espera.current = window.setTimeout(() => setAberto(null), 160);
  };

  return (
    <div ref={raiz} className={styles.raiz} onMouseLeave={sair}>
      <nav className={styles.barra} aria-label={menu.navegacao}>
        {menu.grupos.map((g) => (
          <button
            key={g.id}
            id={`${base}-botao-${g.id}`}
            type="button"
            className={styles.gatilho}
            aria-expanded={aberto === g.id}
            aria-controls={`${base}-painel-${g.id}`}
            data-aberto={aberto === g.id}
            onClick={() => setAberto((a) => (a === g.id ? null : g.id))}
            onMouseEnter={() => passar(g.id)}
          >
            {g.rotulo}
            <ChevronDown size={15} aria-hidden className={styles.seta} />
          </button>
        ))}
        {menu.links.map((l) => (
          <Link key={l.href} href={l.href} className={styles.gatilho} onMouseEnter={sair}>
            {l.rotulo}
          </Link>
        ))}
      </nav>

      {menu.grupos.map((g) => (
        <div
          key={g.id}
          id={`${base}-painel-${g.id}`}
          role="region"
          aria-labelledby={`${base}-botao-${g.id}`}
          className={styles.painel}
          data-aberto={aberto === g.id}
          hidden={aberto !== g.id}
          onMouseEnter={() => passar(g.id)}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) fechar();
          }}
        >
          <div className={styles.painelInterno}>
            <Grupo grupo={g} />
            <Destaque grupo={g} />
          </div>
        </div>
      ))}

      <button
        type="button"
        className={styles.botaoGaveta}
        aria-label={menu.abrir}
        aria-expanded={gaveta}
        onClick={() => setGaveta(true)}
      >
        <Menu size={22} aria-hidden />
      </button>
      {gaveta && (
        <div className={styles.gaveta} role="dialog" aria-modal="true" aria-label={menu.navegacao}>
          <div className={styles.gavetaTopo}>
            <span>{menu.navegacao}</span>
            <button type="button" aria-label={menu.fechar} onClick={() => setGaveta(false)}>
              <X size={22} aria-hidden />
            </button>
          </div>
          <div
            className={styles.gavetaCorpo}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setGaveta(false);
            }}
          >
            {menu.grupos.map((g) => (
              <details key={g.id} className={styles.secao}>
                <summary>
                  {g.rotulo}
                  <ChevronDown size={18} aria-hidden />
                </summary>
                <ul>
                  {g.itens.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href}>
                        <strong>{item.titulo}</strong>
                        <span>{item.descricao}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            {menu.links.map((l) => (
              <Link key={l.href} href={l.href} className={styles.linkGaveta}>
                {l.rotulo}
              </Link>
            ))}
            <div className={styles.acoesGaveta}>
              <Link href="/login" className={styles.secundario}>
                {menu.entrar}
              </Link>
              <Link href="/signup" className={styles.primario}>
                {menu.criarConta}
                <ArrowRight size={17} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Grupo({ grupo }: { grupo: GrupoDoMenu }) {
  if (grupo.estilo === "cartoes") {
    return (
      <ul className={styles.cartoes}>
        {grupo.itens.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={styles.cartao}>
              {item.imagem && (
                <Image
                  src={item.imagem}
                  alt=""
                  width={240}
                  height={135}
                  sizes="160px"
                  className={styles.cartaoImagem}
                />
              )}
              <strong>{item.titulo}</strong>
              <span>{item.descricao}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className={styles.lista} data-colunas={grupo.itens.length > 6 ? 2 : 1}>
      {grupo.itens.map((item) => {
        const Icone = item.icone ? ICONES[item.icone] : null;
        return (
          <li key={item.href}>
            <Link href={item.href} className={styles.item}>
              {Icone && (
                <span className={styles.icone}>
                  <Icone size={19} aria-hidden />
                </span>
              )}
              <span>
                <strong>{item.titulo}</strong>
                <span>{item.descricao}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Destaque({ grupo }: { grupo: GrupoDoMenu }) {
  const d = grupo.destaque;
  return (
    <Link href={d.href} className={styles.destaque}>
      <Image
        src={d.imagem}
        alt=""
        width={420}
        height={236}
        sizes="300px"
        className={styles.destaqueImagem}
      />
      <strong>{d.titulo}</strong>
      <span>{d.texto}</span>
      <span className={styles.destaqueAcao}>
        {d.acao}
        <ArrowRight size={16} aria-hidden />
      </span>
    </Link>
  );
}
