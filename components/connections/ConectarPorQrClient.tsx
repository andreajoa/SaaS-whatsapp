"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api/client";
import { useT } from "@/hooks/i18n/useT";

/**
 * "Conectar meu WhatsApp" — a conexão por QR pela conta da instalação.
 *
 * Para quem nunca ouviu falar de API: um botão, a janela da Meta, um QR lido
 * com o app WhatsApp Business, e a volta para cá com o número conectado. O
 * número continua funcionando no celular (coexistência).
 *
 * O que dá errado na volta chega por `?qr=erro&motivo=` (a rota de retorno não
 * tem como mostrar nada: ela é uma ponte). Cada motivo tem uma frase que diz o
 * que FAZER, não o que aconteceu por dentro.
 */

type Origem = "onboarding" | "conexoes";

interface Estado {
  disponivel: boolean;
  conectado: boolean;
  phone_number: string | null;
  display_name: string | null;
  status: string | null;
}

const FRASE_GENERICA =
  "Não deu para concluir a conexão. Confira se o número está no app WhatsApp Business e tente de novo.";

const FRASES_DE_ERRO: Record<string, string> = {
  cancelado: "A conexão foi cancelada antes de terminar. Quando quiser, é só tentar de novo.",
  numero_em_uso:
    "Este número já está conectado em outra conta. Desconecte de lá (no app: Configurações › Conta › Plataforma comercial) e tente de novo.",
  expirado: "A janela de conexão expirou. Clique de novo para abrir outra.",
  indisponivel: "A conexão por QR está temporariamente indisponível. Tente de novo em alguns minutos.",
  retorno_invalido: "Não consegui confirmar a volta da conexão. Clique de novo para recomeçar.",
  falhou: FRASE_GENERICA,
};

export function ConectarPorQrClient({ origem }: { origem: Origem }) {
  const t = useT();
  const params = useSearchParams();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const motivo = params.get("qr") === "erro" ? params.get("motivo") : null;
  const voltouConectado = params.get("qr") === "ok";

  useEffect(() => {
    let cancelado = false;
    apiClient
      .get<{ data: Estado }>("/api/v1/channels/partner/qr")
      .then((r) => {
        if (!cancelado) setEstado(r.data);
      })
      .catch(() => {
        if (!cancelado) setEstado(null);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const conectar = async () => {
    setAbrindo(true);
    setErro(null);
    try {
      const r = await apiClient.post<{ data: { auth_url: string } }>("/api/v1/channels/partner/qr", {
        origem,
      });
      // Navegação na MESMA aba, e não popup: bloqueador de popup do celular
      // engoliria a janela sem aviso, e a volta precisa cair nesta aba.
      window.location.assign(r.data.auth_url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não consegui abrir a conexão agora. Tente de novo em alguns minutos."));
      setAbrindo(false);
    }
  };

  if (estado && !estado.disponivel) return null;

  const conectado = !!estado?.conectado;

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold">{t("Conectar meu WhatsApp")}</h3>
          <p className="text-sm text-muted-foreground">
            {t(
              "Você lê um código com o celular e pronto: o número continua funcionando no seu app e passa a ser atendido por aqui também.",
            )}
          </p>
        </div>
        {conectado && <Badge variant="success">{t("Conectado")}</Badge>}
      </div>

      {(voltouConectado || conectado) && estado?.phone_number && (
        <p className="rounded-md border border-success/40 bg-success-bg p-3 text-sm">
          {t("Número conectado:")} <strong>{estado.phone_number}</strong>
        </p>
      )}

      {motivo && (
        <p role="alert" className="rounded-md border border-warning/40 bg-warning-bg p-3 text-sm">
          {t(FRASES_DE_ERRO[motivo] ?? FRASE_GENERICA)}
        </p>
      )}
      {erro && (
        <p role="alert" className="rounded-md border border-warning/40 bg-warning-bg p-3 text-sm">
          {erro}
        </p>
      )}

      {!conectado && (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{t("Tenha o celular com o app WhatsApp Business por perto (o WhatsApp comum não serve).")}</li>
          <li>{t("Clique no botão abaixo. Abre uma janela oficial da Meta.")}</li>
          <li>{t("No app, toque no ícone da câmera e leia o código que aparece na tela.")}</li>
          <li>{t("Confirme e espere voltar para cá.")}</li>
        </ol>
      )}

      <div>
        <Button type="button" onClick={() => void conectar()} disabled={abrindo || estado === null}>
          {abrindo
            ? t("Abrindo…")
            : conectado
              ? t("Trocar o número conectado")
              : t("Conectar meu WhatsApp")}
        </Button>
      </div>
    </Card>
  );
}
