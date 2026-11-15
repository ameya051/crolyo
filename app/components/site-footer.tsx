import Link from "next/link";
import Image from "next/image";
import { ModeToggle } from "@/components/ui/mode-toggle";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Sign up", href: "/signup" },
      { label: "Log in", href: "/signin" },
    ],
  },
  {
    title: "Resources",
    links: [{ label: "llms.txt", href: "/llms.txt" }],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Trust Centre", href: "/trust" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-border md:mt-20">
      <div className="grid grid-cols-2 sm:grid-cols-3">
        {columns.map((column) => (
          <div
            key={column.title}
            className="border-b border-border odd:border-r sm:border-r sm:last:border-r-0"
          >
            <p className="border-b border-border px-4 py-3 font-mono text-xs font-medium uppercase text-muted-foreground md:px-6">
              {column.title}
            </p>
            <ul className="flex flex-col gap-3 px-4 py-4 md:px-6">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-foreground transition-opacity hover:opacity-70">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center justify-between gap-4 px-4 py-4 sm:flex-row md:px-6">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={24} height={24} className="size-6 object-contain" />
          <p className="font-mono text-xs uppercase text-muted-foreground">
            &copy; {new Date().getFullYear()} •{" "}
            <a
              href="https://ameyashr.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground transition-opacity hover:opacity-70"
            >
              Ameya
            </a>
          </p>
        </div>
        <ModeToggle />
      </div>
    </footer>
  );
}
