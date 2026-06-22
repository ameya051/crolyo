import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - Crolyo",
  description: "Your Crolyo dashboard.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
