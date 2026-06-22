"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions/auth";
import { useState } from "react";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await signOut();
  };

  return (
    <Button
      onClick={handleSignOut}
      disabled={loading}
      variant="outline"
      className="cursor-pointer rounded-xl text-sm font-medium h-9 px-4 disabled:opacity-50"
    >
      {loading ? "Signing out..." : "Sign out"}
    </Button>
  );
}
