import { EnglishPricing, pricingMetadata } from "@/components/site/EnglishPricing";
export const metadata = pricingMetadata("GB");
export default function PricingPage() { return <EnglishPricing country="GB" />; }
