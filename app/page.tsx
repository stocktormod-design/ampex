import { CtaBand } from "@/components/landing/cta-band";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Hero } from "@/components/landing/hero";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <Hero />
      <FeatureGrid />
      <CtaBand />
      <SiteFooter />
    </>
  );
}
