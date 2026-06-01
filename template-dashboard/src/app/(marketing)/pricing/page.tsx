import type { Metadata } from "next";
import PricingTable from "@/components/marketing/pricing-table";

export const metadata: Metadata = {
  title: "Pricing — TrackHQ",
  description: "Pricing for TrackHQ rental management software. Talk to sales for a quote.",
};

export default function PricingPage() {
  return <PricingTable />;
}
