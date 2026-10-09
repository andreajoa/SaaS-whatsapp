"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useIdioma } from "@/lib/i18n/IdiomaProvider";
import { qualityText, type QualityText } from "@/lib/service-quality/text";
import { qualityFetch } from "@/lib/service-quality/client";
import type { QualityPolicy } from "@/lib/service-quality/contracts";
import { policySchema } from "@/lib/service-quality/contracts";
import type { QualitySnapshot, TargetMetric } from "@/lib/service-quality/metrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QualitySurveyRequest } from "./survey-request";
import { QualityFeedbackList } from "./conversation-feedback";
function duration(seconds: number | null, text: QualityText) {
  if (seconds === null) return text.noData;
  if (seconds < 60) return `${Math.round(seconds)} ${text.seconds}`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} ${text.minutes}`;
  return `${(seconds / 3600).toFixed(1)} ${text.hours}`;
}
function Metric({
  label,
  metric,
  text,
}: {
  label: string;
  metric: TargetMetric;
  text: QualityText;
}) {
  return (
    <div className="text-sm">
      <p className="font-medium">{label}</p>
      <p className={metric.state === "breached" ? "text-destructive" : "text-muted-foreground"}>
        {text[metric.state]}
      </p>
      <p>
        {text.elapsed}: {duration(metric.elapsed_seconds, text)} · {text.target}:{" "}
        {duration(metric.target_seconds, text)}
      </p>
    </div>
  );
}
function PolicyEditor({
  policy,
  onSaved,
  onSaving,
}: {
  policy: QualityPolicy;
  onSaved: () => Promise<void>;
  onSaving: () => void;
}) {
  const text = qualityText(useIdioma());
  const [enabled, setEnabled] = useState(policy.enabled);
  const [first, setFirst] = useState(
    policy.first_response_target_seconds === null
      ? ""
      : String(policy.first_response_target_seconds / 60),
  );
  const [resolution, setResolution] = useState(
    policy.resolution_target_seconds === null ? "" : String(policy.resolution_target_seconds / 60),
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    onSaving();
    const input = policySchema.safeParse({
      enabled,
      first_response_target_seconds: first.trim() ? Math.round(Number(first) * 60) : null,
      resolution_target_seconds: resolution.trim() ? Math.round(Number(resolution) * 60) : null,
      clock_mode: "elapsed",
    });
    if (!input.success) {
      setNotice(text.invalid);
      return;
    }
    setBusy(true);
    try {
      await qualityFetch("/api/v1/service-quality/policy", {
        method: "PUT",
        body: JSON.stringify(input.data),
      });
      await onSaved();
    } catch {
      setNotice(text.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">{text.policy}</h2>
      <p className="text-sm text-muted-foreground">{text.clock}</p>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {text.enabled}
        </label>
        <label className="space-y-1 text-sm">
          {text.firstTarget}
          <Input
            type="number"
            min="0.0166666667"
            step="any"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          {text.resolutionTarget}
          <Input
            type="number"
            min="0.0166666667"
            step="any"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          />
        </label>
        <p className="text-xs text-muted-foreground sm:col-span-2">{text.optional}</p>
        <Button type="submit" disabled={busy} className="sm:justify-self-start">
          {busy ? text.loading : text.save}
        </Button>
      </form>
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
export function QualityDashboard() {
  const idioma = useIdioma();
  const text = qualityText(idioma);
  const [data, setData] = useState<QualitySnapshot | null>(null);
  const [error, setError] = useState(false);
  const [policySaved, setPolicySaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors.at(-1) ?? null;
  const requestScope = useRef<{ cursor: string | null; controller: AbortController } | null>(null);
  const requestSequence = useRef(0);
  const [selected, setSelected] = useState<string | null>(null);
  const load = useCallback(
    async (
      signal = requestScope.current?.cursor === cursor
        ? requestScope.current.controller.signal
        : undefined,
    ) => {
      if (!signal || signal.aborted) return;
      const sequence = ++requestSequence.current;
      await qualityFetch<QualitySnapshot>(
        `/api/v1/service-quality${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`,
        { signal },
      ).then(
        (snapshot) => {
          if (sequence !== requestSequence.current || signal.aborted) return;
          setData(snapshot);
          setError(false);
          setLoading(false);
        },
        () => {
          if (sequence !== requestSequence.current || signal.aborted) return;
          setError(true);
          setLoading(false);
        },
      );
    },
    [cursor],
  );
  useEffect(() => {
    const controller = new AbortController();
    requestScope.current = { cursor, controller };
    void load(controller.signal);
    const interval = setInterval(() => void load(controller.signal), 30000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [cursor, load]);
  function next() {
    if (!data?.next_cursor) return;
    setLoading(true);
    setData(null);
    setSelected(null);
    setCursors([...cursors, data.next_cursor]);
  }
  function previous() {
    setLoading(true);
    setData(null);
    setSelected(null);
    setCursors(cursors.slice(0, -1));
  }
  const summary = data?.summary;
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{text.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{text.intro}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {text.reload}
        </Button>
      </header>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive p-3 text-sm">
          {text.error}
        </p>
      )}
      {loading && <p role="status">{text.loading}</p>}
      {policySaved && <p role="status" className="text-sm">{text.saved}</p>}
      {data && (
        <>
          {!data.policy.enabled && <p className="rounded-lg border p-3 text-sm">{text.disabled}</p>}
          {data.can_manage ? (
            <PolicyEditor
              key={JSON.stringify(data.policy)}
              policy={data.policy}
              onSaving={() => setPolicySaved(false)}
              onSaved={async () => {
                await load();
                setPolicySaved(true);
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{text.readonly}</p>
          )}
          {summary && (
            <section className="space-y-3" aria-label={text.pageScope}>
              <h2 className="font-semibold">{text.pageScope}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: text.response,
                    value: duration(summary.first_response_average_seconds, text),
                    count: summary.first_response_samples,
                  },
                  {
                    label: text.resolution,
                    value: duration(summary.resolution_average_seconds, text),
                    count: summary.resolution_samples,
                  },
                  {
                    label: text.csat,
                    value:
                      summary.csat_average === null
                        ? text.noData
                        : `${summary.csat_average.toFixed(2)}/5`,
                    count: summary.csat_responses,
                  },
                  {
                    label: text.unresolved,
                    value: String(summary.ended_without_resolution),
                    count: summary.conversations,
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border bg-card p-4">
                    <h3 className="text-sm text-muted-foreground">{item.label}</h3>
                    <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {text.samples}: {item.count}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {text.lowScores}: {summary.csat_low_scores} · {text.pendingSurveys}:{" "}
                {summary.pending_surveys} · {text.expiredSurveys}: {summary.expired_surveys}
              </p>
              <p className="text-xs text-muted-foreground">
                {text.responseDefinition} {text.resolutionDefinition}
              </p>
            </section>
          )}
          <section className="space-y-3">
            <h2 className="font-semibold">{text.alerts}</h2>
            {summary?.alerts.length ? (
              <ul className="space-y-2">
                {summary.alerts.map((a) => (
                  <li
                    key={`${a.conversation_id}-${a.kind}`}
                    className="flex flex-wrap justify-between gap-2 rounded-lg border border-destructive/30 p-3 text-sm"
                  >
                    <span>
                      {a.kind === "ended_without_resolution"
                        ? text.ended
                        : a.kind === "first_response"
                          ? text.response
                          : text.resolution}{" "}
                      · {a.kind === "ended_without_resolution" ? "" : text.breached}
                    </span>
                    <Link href={a.inbox_url} className="underline">
                      {text.inbox} · {a.conversation_id.slice(0, 8)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{text.noAlerts}</p>
            )}
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold">{text.conversations}</h2>
            {data.rows.length === 0 && <p>{text.empty}</p>}
            <ul className="space-y-3">
              {data.rows.map((row) => (
                <li key={row.conversation_id} className="space-y-3 rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <Link href={row.inbox_url} className="text-sm font-medium underline">
                      {text.inbox} · {row.conversation_id.slice(0, 8)}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {text.status}: {text[row.status as keyof QualityText] ?? row.status}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Metric label={text.response} metric={row.first_response} text={text} />
                    {row.ended_without_resolution ? (
                      <p className="text-sm">{text.ended}</p>
                    ) : (
                      <Metric label={text.resolution} metric={row.resolution} text={text} />
                    )}
                  </div>
                  {data.can_manage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(row.conversation_id)}
                    >
                      {text.survey}
                    </Button>
                  )}
                  {data.can_manage && selected === row.conversation_id && (
                    <QualitySurveyRequest
                      key={row.conversation_id}
                      conversationId={row.conversation_id}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
          {data.can_manage && !selected && (
            <QualitySurveyRequest key={selected ?? "manual"} conversationId={selected ?? ""} />
          )}
          <QualityFeedbackList surveys={data.surveys} />
          {data.survey_history_truncated && (
            <p className="text-sm text-muted-foreground">{text.historyLimited}</p>
          )}
          <div className="flex justify-between gap-3">
            <Button variant="outline" disabled={cursors.length === 1} onClick={previous}>
              {text.previous}
            </Button>
            <Button variant="outline" disabled={!data.next_cursor} onClick={next}>
              {text.next}
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
