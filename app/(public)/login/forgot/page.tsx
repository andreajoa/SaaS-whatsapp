import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { createClient } from "@/lib/supabase/server";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
import { traduzir } from "@/lib/i18n/dicionario";
import { idiomaPublicoDoAcesso } from "@/lib/mercado/idioma-publico-server";
import { traduzirAcessoEmIngles } from "@/lib/mercado/idioma-publico-en";

export async function generateMetadata() {
  return { title: await idiomaPublicoDoAcesso() ? "Reset password" : "Recuperar senha" };
}

export default async function ForgotPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const idioma = normalizarIdioma(
    (user?.user_metadata?.locale as string | undefined) ?? null,
  );
  const ingles = Boolean(await idiomaPublicoDoAcesso());
  const t = (texto: string) => ingles ? traduzirAcessoEmIngles(texto) : traduzir(texto, idioma);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Recuperar senha")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Informe seu e-mail e enviaremos um link de redefinição")}
        </p>
      </div>
      <ForgotPasswordForm ingles={ingles} />
      <p className="text-center text-sm text-muted-foreground">
        {t("Lembrou a senha?")}{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          {t("Entrar")}
        </Link>
      </p>
    </div>
  );
}
