import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Wallet, Users, Plane, Receipt } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trip Balance — Shared Travel Expenses & Settlements" },
      { name: "description", content: "Track shared trip costs, calculate who owes whom, and keep a clean settlement history across every trip." },
      { property: "og:title", content: "Trip Balance" },
      { property: "og:description", content: "Shared travel expense & settlement tracker." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Wallet className="h-5 w-5 text-primary" />
            Trip Balance
          </Link>
          <div className="flex gap-2">
            <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
            <Button asChild><Link to="/auth">Get started</Link></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <section className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            Settle every trip, <span className="text-primary">fairly.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Trip Balance helps couples, families and groups track shared travel
            expenses, calculate who owes whom, and keep an ongoing balance
            across every trip — in South African Rand.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/auth">Create your account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Users, title: "Multiple groups", body: "Run separate accounts for couples, families and friends — each with their own members." },
            { icon: Plane, title: "Every trip tracked", body: "Log expenses on the go, with flexible equal or percentage splits and per-trip inclusion." },
            { icon: Receipt, title: "Always settled", body: "See open balances, year-to-date and lifetime positions — with full audit history." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border bg-card p-6 shadow-sm">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
