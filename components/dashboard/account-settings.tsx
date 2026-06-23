"use client";

import { useState } from "react";
import { Monitor, Moon, Sun, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { signOut } from "@/app/actions/auth";
import { useTheme } from "@/components/theme-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface AccountProfile {
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function AccountSettings({ profile }: { profile: AccountProfile }) {
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(profile.fullName);
  const [signingOut, setSigningOut] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Profile updated");
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const handleDeleteAccount = () => {
    toast.info("Account deletion isn't wired up yet in this preview.", {
      description: "It would permanently remove your account and all sites.",
    });
  };

  return (
    <div className="space-y-10">
      <form onSubmit={handleSaveProfile} className="space-y-5">
        <section className="space-y-4">
          <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
            Profile
          </h2>
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt={profile.fullName} /> : null}
              <AvatarFallback>{initials(profile.fullName)}</AvatarFallback>
            </Avatar>
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">{profile.fullName}</p>
              <p className="text-xs text-muted-foreground">Signed in with Google</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account-name">Display name</Label>
              <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-email">Email</Label>
              <Input id="account-email" value={profile.email} disabled className="text-muted-foreground" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" className="h-9 px-4">Save changes</Button>
          </div>
        </section>
      </form>

      <Separator />

      <section className="space-y-4">
        <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
          Appearance
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose how Crolyo looks. System follows your device setting.
        </p>
        <div className="flex flex-wrap gap-2">
          {themes.map((t) => {
            const Icon = t.icon;
            const isActive = theme === t.value;
            return (
              <Button
                key={t.value}
                variant="outline"
                onClick={() => setTheme(t.value)}
                className={cn(
                  "h-9 gap-2 px-4",
                  isActive && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </Button>
            );
          })}
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
          Account
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Sign out</p>
            <p className="text-xs text-muted-foreground">End your session on this device.</p>
          </div>
          <Button variant="outline" className="h-9 px-4" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
        <Separator />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Delete account</p>
            <p className="text-xs text-muted-foreground">
              Permanently remove your account and all of your sites.
            </p>
          </div>
          <Dialog>
            <DialogTrigger render={<Button variant="destructive" className="h-9 gap-2 px-4" />}>
              <Trash2Icon className="size-4" />
              Delete account
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>
                  This can&apos;t be undone. All your sites, widget configurations, and conversation history will be permanently removed.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <DialogClose render={<Button variant="destructive" />} onClick={handleDeleteAccount}>
                  Delete account
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>
    </div>
  );
}
