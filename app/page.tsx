import HeroSection from "./components/HeroSection";
import WorkflowSection from "./components/WorkflowSection";
import BentoSection from "./components/BentoSection";
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <HeroSection />
      <WorkflowSection />
      <BentoSection />
      <SiteFooter />
    </>
  );
}
