"use client";

import { CheckCircle2, TriangleAlert } from "lucide-react";

import { useT } from "@/hooks/i18n/useT";
import { Card } from "@/components/ui/card";

export interface EstadoDaChave {
  pode_indexar: boolean;
  origem: string | null;
  explicacao: string | null;
  chave_em_uso: string | null;
  avisos: string[];
  /** Mantido no contrato da API para compatibilidade com instalações antigas. */
  credenciais_openai: Array<{
    id: string;
    label: string;
    api_key_last4: string | null;
    validated_at: string | null;
    validation_error: string | null;
    is_active: boolean;
  }>;
}

interface Props {
  estado: EstadoDaChave;
  /** Compatibilidade do componente: no SaaS a chave não é cadastrada pelo tenant. */
  onChaveCadastrada: () => void;
}

/**
 * Estado da infraestrutura que transforma materiais em conhecimento.
 *
 * No SaaS Whatsapp o tenant não compra nem cadastra chave de OpenAI/Anthropic.
 * Embeddings são responsabilidade da plataforma e chegam por SAAS_AI_BASE_URL.
 * Se essa infraestrutura cair, a ação correta do cliente é aguardar/suporte —
 * nunca preencher uma credencial que pertence ao operador da plataforma.
 */
export function ChaveDeConhecimento({ estado }: Props) {
  const t = useT();

  if (estado.pode_indexar) {
    return (
      <div
        data-testid="conhecimento-chave-ok"
        className="flex flex-wrap items-center gap-2 text-xs text-text-muted"
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-success-fg" aria-hidden />
        <span>
          {t("Pronto para preparar material.")} {estado.explicacao ? t(estado.explicacao) : null}
        </span>
        {estado.avisos.map((aviso) => (
          <span key={aviso} className="w-full text-warning-fg">
            {t(aviso)}
          </span>
        ))}
      </div>
    );
  }

  return (
    <Card
      data-testid="conhecimento-sem-chave"
      className="space-y-2 border-warning-bg bg-warning-bg/20 p-4"
    >
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-fg" aria-hidden />
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{t("A preparação do conhecimento está temporariamente indisponível")}</h3>
          <p className="text-xs text-text-muted">
            {t(
              "Seu material pode ser guardado normalmente. A inteligência da plataforma fará a preparação assim que a infraestrutura voltar. Sua empresa não precisa contratar nem cadastrar uma chave de IA.",
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}
