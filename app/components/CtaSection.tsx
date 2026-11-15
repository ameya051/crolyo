import Link from "next/link";
import { primaryCta, secondaryCta, sectionHeading } from "@/app/components/styles";

export default function CtaSection() {
  return (
    <section className="mt-10 grid border-y border-border md:mt-20 lg:grid-cols-2">
      <div className="flex flex-col justify-center gap-2 border-b border-border px-4 py-6 md:gap-4 md:px-6 lg:border-b-0 lg:border-r">
        <p className={sectionHeading}>Ready to try it?</p>
        <p className="text-base leading-relaxed text-muted-foreground md:text-xl">
          Create a site, paste the snippet, connect Slack. <br className="hidden lg:inline" />
          Your first conversation is a few minutes away.
        </p>
      </div>
      <div className="flex flex-col items-start justify-center gap-3 bg-muted/40 px-4 py-10 sm:flex-row sm:items-center md:px-6">
        <Link href="/signup" className={primaryCta}>
          Get started free
        </Link>
        <Link href="/signin" className={secondaryCta}>
          Log in
        </Link>
      </div>
    </section>
  );
}
