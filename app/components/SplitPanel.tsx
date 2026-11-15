import { SitesMock } from "@/app/components/mockups";
import { eyebrow, sectionHeading } from "@/app/components/styles";

export default function SplitPanel() {
  return (
    <section className="my-10 grid border-y border-border md:my-20 lg:grid-cols-2">
      <div className="flex items-center justify-center border-b border-border bg-muted/40 p-6 md:p-10 lg:border-b-0 lg:border-r">
        <SitesMock />
      </div>
      <div className="flex flex-col justify-between gap-6 px-4 py-6 md:px-6">
        <p className={eyebrow}>Multi-site support</p>
        <div className="flex flex-col gap-4 md:gap-6">
          <h2 className={sectionHeading}>Multiple sites, one dashboard.</h2>
          <p className="text-base leading-7 text-muted-foreground md:text-xl">
            Add a site for every product or client you run. Each one gets its own widget, knowledge base and Slack
            channel.
          </p>
        </div>
      </div>
    </section>
  );
}
