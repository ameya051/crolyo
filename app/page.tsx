import HeroSection from "./components/HeroSection";
import WorkflowSection from "./components/WorkflowSection";
import BentoSection from "./components/BentoSection";
import { SiteHeader } from "./components/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <HeroSection />
      <WorkflowSection />
      <BentoSection />
    </>
  );
}
