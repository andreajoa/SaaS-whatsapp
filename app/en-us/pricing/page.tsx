import { EnglishPricing, pricingMetadata } from "@/components/site/EnglishPricing";
export const metadata = pricingMetadata("US");
export default function PricingPage() { return <EnglishPricing country="US" />; }
