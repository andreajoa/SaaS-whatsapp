"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_DO_PAINEL, cookieVale, painelHabilitado } from "@/lib/painel/sessao";
/** A ação só invalida a sessão do operador autenticado. */
export async function sairDoPainel() {
  const jar = await cookies();
  if (!painelHabilitado() || !cookieVale(jar.get(COOKIE_DO_PAINEL)?.value)) redirect("/dashboard");
  jar.delete(COOKIE_DO_PAINEL);
  redirect("/dashboard");
}
