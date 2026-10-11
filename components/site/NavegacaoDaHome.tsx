"use client";

import { useRef } from "react";
import Link from "next/link";

import styles from "./atenza-home.module.css";

export function NavegacaoDaHome({
  abrir,
  rotulo,
  itens,
}: {
  readonly abrir: string;
  readonly rotulo: string;
  readonly itens: ReadonlyArray<{ href: string; texto: string }>;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      className={styles.mobileNav}
      onKeyDown={(event) => {
        if (event.key === "Escape" && ref.current?.open) {
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label={abrir}>
        <span />
        <span />
        <span />
      </summary>
      <nav
        aria-label={rotulo}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a") && ref.current) ref.current.open = false;
        }}
      >
        {itens.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.texto}
          </Link>
        ))}
      </nav>
    </details>
  );
}
