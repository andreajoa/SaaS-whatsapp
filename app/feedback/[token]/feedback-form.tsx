"use client";
import { useCallback, useEffect, useState } from "react";
import { qualityFetch, QualityRequestError } from "@/lib/service-quality/client";
import { qualityText } from "@/lib/service-quality/text";
import { feedbackSchema } from "@/lib/service-quality/contracts";
import { normalizarIdioma, type Idioma } from "@/lib/i18n/idiomas";
import { Button } from "@/components/ui/button";
export function FeedbackForm({ token }: { token: string }) {
  const [idioma, setIdioma] = useState<Idioma>("pt-BR");
  const text = qualityText(idioma);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error" | "done">(
    "loading",
  );
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const endpoint = `/api/v1/service-quality/public/${encodeURIComponent(token)}`;
  const check = useCallback(
    async (signal?: AbortSignal) => {
      setState("loading");
      try {
        const data = await qualityFetch<{ locale: string }>(endpoint, { signal });
        if (signal?.aborted) return;
        setIdioma(normalizarIdioma(data.locale));
        setState("ready");
      } catch (e) {
        if (!signal?.aborted) {
          setState(e instanceof QualityRequestError && e.status === 404 ? "unavailable" : "error");
          setNotice(e instanceof QualityRequestError && e.status === 429 ? "slow" : "error");
        }
      }
    },
    [endpoint],
  );
  useEffect(() => {
    const controller = new AbortController();
    void check(controller.signal);
    return () => controller.abort();
  }, [check]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = feedbackSchema.safeParse({ score, comment });
    if (!input.success) return;
    setBusy(true);
    setNotice("");
    try {
      await qualityFetch(endpoint, { method: "POST", body: JSON.stringify(input.data) });
      setState("done");
      setComment("");
    } catch (e) {
      if (e instanceof QualityRequestError && e.status === 404) setState("unavailable");
      else setNotice(e instanceof QualityRequestError && e.status === 429 ? "slow" : "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <section
        className="w-full max-w-lg space-y-5 rounded-xl border bg-card p-6 sm:p-8"
        aria-label={text.feedbackTitle}
      >
        <h1 className="text-2xl font-semibold">{text.feedbackTitle}</h1>
        {state === "loading" && <p role="status">{text.loading}</p>}
        {state === "done" && <p role="status">{text.thanks}</p>}
        {state === "unavailable" && <p role="status">{text.unavailable}</p>}
        {state === "error" && (
          <>
            <p role="alert">{notice === "slow" ? text.slow : text.error}</p>
            <Button onClick={() => void check()}>{text.reload}</Button>
          </>
        )}
        {state === "ready" && (
          <>
            <p className="text-sm text-muted-foreground">{text.feedbackIntro}</p>
            <form onSubmit={submit} className="space-y-5">
              <fieldset disabled={busy}>
                <legend className="mb-2 text-sm font-medium">{text.score}</legend>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label
                      key={n}
                      className={`cursor-pointer rounded-lg border p-3 text-center ${score === n ? "border-primary bg-primary/10" : ""}`}
                    >
                      <input
                        className="peer sr-only"
                        type="radio"
                        name="score"
                        value={n}
                        checked={score === n}
                        onChange={() => setScore(n)}
                        required
                      />
                      <span className="rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-primary">
                        {n}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{text.veryBad}</span>
                  <span>{text.veryGood}</span>
                </div>
              </fieldset>
              <label className="block text-sm font-medium">
                {text.comment}
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={busy}
                  className="mt-2 w-full rounded-md border bg-background p-3 font-normal"
                />
              </label>
              <p className="text-xs text-muted-foreground">{text.surveyUsage}</p>
              <Button type="submit" className="w-full" disabled={score === null || busy}>
                {busy ? text.loading : text.submit}
              </Button>
            </form>
            {notice && <p role="alert">{notice === "slow" ? text.slow : text.error}</p>}
          </>
        )}
      </section>
    </main>
  );
}
