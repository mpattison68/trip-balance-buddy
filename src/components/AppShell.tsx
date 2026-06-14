import { Link, useParams, useRouter } from "@tanstack/react-router";
import { Wallet, LayoutDashboard, Plane, Users, Tag, ArrowLeftRight, History, FileText, LogOut, Plus, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function AppShell({ children, accountId }: { children: ReactNode; accountId?: string }) {
  const router = useRouter();
  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          {accountId ? (
            <Link
              to="/app/accounts/$accountId"
              params={{ accountId }}
              className="flex items-center gap-2 font-semibold"
            >
              <Wallet className="h-5 w-5 text-primary" />
              Dashboard
            </Link>
          ) : (
            <Link to="/app" className="flex items-center gap-2 font-semibold">
              <Wallet className="h-5 w-5 text-primary" />
              Trip Balance
            </Link>
          )}
          <div className="flex items-center gap-2">
            {accountId && (
              <>
                <Button asChild size="sm">
                  <Link to="/app/accounts/$accountId/trips/new" params={{ accountId }}>
                    <Plus className="mr-1 h-4 w-4" />
                    <span className="hidden sm:inline">New trip</span>
                    <span className="sm:hidden">Trip</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" size="icon" title="Accounts">
                  <Link to="/app" aria-label="Accounts">
                    <UserCog className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6 pb-24 sm:pb-6">
        {accountId && (
          <nav className="hidden w-56 shrink-0 sm:block">
            <SideNav accountId={accountId} />
          </nav>
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      {accountId && <MobileNav accountId={accountId} />}
    </div>
  );
}

const navItems = [
  { to: "/app/accounts/$accountId", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/accounts/$accountId/trips", label: "Trips", icon: Plane },
  { to: "/app/accounts/$accountId/settlements", label: "Settle", icon: ArrowLeftRight },
  { to: "/app/accounts/$accountId/history", label: "History", icon: History },
  { to: "/app/accounts/$accountId/reports", label: "Reports", icon: FileText },
  { to: "/app/accounts/$accountId/members", label: "Members", icon: Users },
  { to: "/app/accounts/$accountId/categories", label: "Categories", icon: Tag },
] as const;

function SideNav({ accountId }: { accountId: string }) {
  return (
    <ul className="space-y-1">
      {navItems.map((item) => (
        <li key={item.to}>
          <Link
            to={item.to}
            params={{ accountId }}
            activeOptions={{ exact: item.to === "/app/accounts/$accountId" }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            activeProps={{ className: "bg-primary/10 text-primary font-medium" }}
          >
            <item.icon className="h-4 w-4" /> {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MobileNav({ accountId }: { accountId: string }) {
  const items = navItems.slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background sm:hidden">
      <ul className="flex">
        {items.map((item) => (
          <li key={item.to} className="flex-1">
            <Link
              to={item.to}
              params={{ accountId }}
              activeOptions={{ exact: item.to === "/app/accounts/$accountId" }}
              className="flex flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground"
              activeProps={{ className: "text-primary" }}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {action}
    </div>
  );
}

export function useAccountId() {
  const params = useParams({ strict: false }) as { accountId?: string };
  return params.accountId;
}

export function cardCls(extra?: string) {
  return cn("rounded-xl border bg-card p-5 shadow-sm", extra);
}