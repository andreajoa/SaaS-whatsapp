"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useIdioma } from "@/lib/i18n/IdiomaProvider";
import { qualityText } from "@/lib/service-quality/text";
import { qualityFetch } from "@/lib/service-quality/client";
import type { QualitySnapshot } from "@/lib/service-quality/metrics";
import type { QualitySurvey } from "@/lib/service-quality/contracts";
import { Button } from "@/components/ui/button";
import { QualitySurveyRequest } from "./survey-request";
export function QualityFeedbackList({
  surveys,
  showConversation = true,
}: {
  surveys: QualitySurvey[];
  showConversation?: boolean;
}) {
  const idioma = useIdioma();
  const text = qualityText(idioma);
  const responses = surveys.filter((s) => s.responded_at !== null);
  return (
    <section className="space-y-3" aria-label={text.feedback}>
      <h2 className="font-semibold">{text.feedback}</h2>
      {responses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{text.noFeedback}</p>
      ) : (
        <ul className="space-y-2">
          {responses.map((s) => (
            <li key={s.id} className="rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>
                  {text.score}: {s.score}/5
                </strong>
                {showConversation && (
                  <Link href={`/app/inbox/${s.conversation_id}`} className="text-sm underline">
                    {text.inbox}
                  </Link>
                )}
              </div>
              {s.comment && (
                <p className="mt-2 text-sm break-words whitespace-pre-wrap">{s.comment}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {text.received} {new Date(s.responded_at!).toLocaleString(idioma)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
/** Integrador monta no painel da conversa; lê as mesmas avaliações do dashboard.
 * Em alterações de conversa, key={conversationId} evita reaproveitar formulário.
 */
export function ConversationQualityFeedback({
  conversationId,
  onExplicitSend,
}: {
  conversationId: string;
  onExplicitSend?: (message: string) => Promise<void>;
}) {
  const idioma = useIdioma();
  const text = qualityText(idioma);
  const [result, setResult] = useState<{ conversationId: string; data: QualitySnapshot } | null>(
    null,
  );
  const [failedConversation, setFailedConversation] = useState<string | null>(null);
  const data = result?.conversationId === conversationId ? result.data : null;
  const error = failedConversation === conversationId;
  const requestScope = useRef<{ conversationId: string; controller: AbortController } | null>(null);
  const requestSequence = useRef(0);
  const load = useCallback(
    async (
      signal = requestScope.current?.conversationId === conversationId
        ? requestScope.current.controller.signal
        : undefined,
    ) => {
      if (!signal || signal.aborted) return;
      const sequence = ++requestSequence.current;
      await qualityFetch<QualitySnapshot>(
        `/api/v1/service-quality?conversation_id=${encodeURIComponent(conversationId)}`,
        { signal },
      ).then(
        (d) => {
          if (sequence !== requestSequence.current || signal.aborted) return;
          setResult({ conversationId, data: d });
          setFailedConversation(null);
        },
        () => {
          if (sequence === requestSequence.current && !signal.aborted)
            setFailedConversation(conversationId);
        },
      );
    },
    [conversationId],
  );
  useEffect(() => {
    const controller = new AbortController();
    requestScope.current = { conversationId, controller };
    void load(controller.signal);
    const interval = setInterval(() => void load(controller.signal), 30000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [conversationId, load]);
  return (
    <div className="space-y-4">
      {error && <p role="alert">{text.error}</p>}
      <Button variant="outline" onClick={() => void load()}>
        {text.reload}
      </Button>
      {data ? (
        <>
          <QualityFeedbackList surveys={data.surveys} showConversation={false} />
          {data.can_manage && (
            <QualitySurveyRequest
              key={conversationId}
              conversationId={conversationId}
              onExplicitSend={onExplicitSend}
            />
          )}
        </>
      ) : (
        <p role="status">{text.loading}</p>
      )}
    </div>
  );
}
