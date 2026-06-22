import HeroSection from "@/app/components/HeroSection";
import WorkflowSection from "@/app/components/WorkflowSection";
import BentoSection from "@/app/components/BentoSection";
import { SiteHeader } from "@/app/components/site-header";
import { SiteFooter } from "@/app/components/site-footer";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-col">
        <HeroSection />
        <WorkflowSection />
        <BentoSection />
      </main>
      <SiteFooter />
    </>
  );
}
