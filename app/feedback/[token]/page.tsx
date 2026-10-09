import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { surveyTokenSchema } from "@/lib/service-quality/contracts";
import { FeedbackForm } from "./feedback-form";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!surveyTokenSchema.safeParse(token).success) notFound();
  // A página não lê dados de tenant. API valida token, validade e rate limit.
  return <FeedbackForm token={token} />;
}
