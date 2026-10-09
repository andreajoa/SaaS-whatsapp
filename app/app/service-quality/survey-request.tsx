"use client";
import { useState } from "react";
import Link from "next/link";
import { useIdioma } from "@/lib/i18n/IdiomaProvider";
import { qualityText } from "@/lib/service-quality/text";
import { qualityFetch } from "@/lib/service-quality/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestSurveySchema } from "@/lib/service-quality/contracts";
/** Seam de inbox: criar/copiar não envia. O integrador pode oferecer sua ação
 * normal de messenger através de onExplicitSend. Callback só roda num clique.
 */
export function QualitySurveyRequest({
  conversationId = "",
  onExplicitSend,
}: {
  conversationId?: string;
  onExplicitSend?: (message: string) => Promise<void>;
}) {
  const idioma = useIdioma();
  const text = qualityText(idioma);
  const [conversation, setConversation] = useState(conversationId);
  const [hours, setHours] = useState("");
  const [link, setLink] = useState<{
    url: string;
    expires_at: string;
    conversation_id: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const message = link ? `${text.invitation}\n${link.url}` : "";
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setNotice("");
    setLink(null);
    const input = requestSurveySchema.safeParse({
      conversation_id: conversation.trim(),
      expires_hours: Number(hours),
    });
    if (!input.success) {
      setNotice(text.invalidSurvey);
      return;
    }
    setBusy(true);
    try {
      const data = await qualityFetch<{
        feedback_path: string;
        expires_at: string;
        conversation_id: string;
      }>("/api/v1/service-quality/surveys", { method: "POST", body: JSON.stringify(input.data) });
      setLink({
        url: new URL(data.feedback_path, window.location.origin).href,
        expires_at: data.expires_at,
        conversation_id: data.conversation_id,
      });
    } catch {
      setNotice(text.error);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setNotice(text.copied);
    } catch {
      setNotice(text.copyError);
    }
  }
  async function send() {
    if (!onExplicitSend || !message || busy) return;
    setBusy(true);
    try {
      await onExplicitSend(message);
      setNotice(text.sentInvitation);
    } catch {
      setNotice(text.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4" aria-label={text.survey}>
      <h2 className="font-semibold">{text.survey}</h2>
      <p className="text-sm text-muted-foreground">{text.linkHelp}</p>
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          {text.conversationId}
          <Input
            value={conversation}
            onChange={(e) => setConversation(e.target.value)}
            required
            readOnly={!!conversationId}
          />
        </label>
        <label className="space-y-1 text-sm">
          {text.expiry}
          <Input
            type="number"
            min="1"
            max="720"
            step="1"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            required
          />
        </label>
        <Button type="submit" disabled={busy} className="sm:col-span-2 sm:justify-self-start">
          {busy ? text.loading : text.create}
        </Button>
      </form>
      {link && (
        <div className="space-y-2">
          <label className="block text-sm">
            {text.copy}
            <textarea
              className="mt-1 w-full rounded-md border bg-background p-3"
              rows={4}
              readOnly
              value={message}
            />
          </label>
          <p className="text-sm">
            {text.expires} {new Date(link.expires_at).toLocaleString(idioma)}
          </p>
          <p className="text-sm text-muted-foreground">{text.surveyUsage}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={copy}>
              {text.copy}
            </Button>
            <Button asChild variant="outline">
              <Link href={`/app/inbox/${link.conversation_id}`}>{text.inbox}</Link>
            </Button>
            {onExplicitSend && (
              <Button type="button" disabled={busy} onClick={send}>
                {text.sendInvitation}
              </Button>
            )}
          </div>
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
