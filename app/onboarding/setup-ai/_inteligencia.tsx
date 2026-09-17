"use client";

import { useT } from "@/hooks/i18n/useT";
import { Badge } from "@/components/ui/badge";

/**
 * No SaaS hospedado o cliente não contrata nem cola chave de LLM. A plataforma
 * fornece a inferência; o que diferencia cada empresa é o contexto isolado:
 * regras, tom, catálogo, documentos, memória e ferramentas autorizadas.
 */
export function InteligenciaDele() {
  const t = useT();
  return (
    <section className="space-y-3 rounded-lg border bg-background p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">{t("O cérebro dele: IA do SaaS Whatsapp")}</h3>
        <Badge variant="secondary">{t("gerenciada pela plataforma")}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {t(
          "Você não precisa cadastrar chave de GPT, Claude ou outro provedor. A inteligência é fornecida pelo SaaS; aqui você ensina como ela deve representar a sua empresa.",
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {t(
          "As informações, materiais, memória e conversas ficam vinculados à sua organização e não são misturados com os de outras empresas.",
        )}
      </p>
    </section>
  );
}
