import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SkillCatalog } from "@/components/skill-catalog";
import { LoginCard } from "@/components/login-card";

const STEPS = [
  { num: "1", title: "Discover", desc: "Read on-chain SkillRegistry to find available AI skills with pricing and ratings" },
  { num: "2", title: "Decompose", desc: "LLM analyzes your task and selects the optimal skill combination" },
  { num: "3", title: "Guard", desc: "PaymentGuard checks spending caps and skill allowlists on-chain" },
  { num: "4", title: "Pay & Execute", desc: "x402 nanopayments settle on Arc — skills execute in parallel" },
  { num: "5", title: "Aggregate", desc: "LLM synthesizes multi-skill results into a cohesive response" },
  { num: "6", title: "Rate", desc: "Agent rates skills on-chain, building marketplace reputation" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center">
        <Badge variant="secondary" className="mb-4 text-xs">
          Built on Arc Testnet with Circle Nanopayments
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Agent Skill Marketplace
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          AI agents autonomously discover, pay for, and rate other agents&apos; skills.
          Every transaction settles on-chain via x402 nanopayments — sub-cent pricing, sub-second finality.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted-foreground font-mono flex-wrap">
          <span>On-chain Registry</span>
          <span className="text-border">|</span>
          <span>PaymentGuard Safety</span>
          <span className="text-border">|</span>
          <span>LLM Orchestration</span>
          <span className="text-border">|</span>
          <span>On-chain Ratings</span>
        </div>
      </section>

      {/* Live Skill Catalog from chain */}
      <section className="max-w-5xl mx-auto px-6 pb-12">
        <Suspense fallback={
          <div className="text-center text-sm text-muted-foreground py-8 animate-pulse">
            Reading SkillRegistry from Arc Testnet...
          </div>
        }>
          <SkillCatalog />
        </Suspense>
      </section>

      {/* How It Works — 6 Step Loop */}
      <section className="max-w-5xl mx-auto px-6 pb-12">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          6-Step Autonomous Loop
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {STEPS.map((step, i) => (
            <div key={step.num} className="relative">
              <Card className="h-full">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-muted-foreground/30 font-mono">{step.num}</div>
                  <div className="text-sm font-semibold mt-1">{step.title}</div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
                </CardContent>
              </Card>
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-2 text-muted-foreground/30 text-lg">
                  &rarr;
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="max-w-5xl mx-auto px-6 pb-12">
        <div className="rounded-lg border p-6 bg-card">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-sm">
            <div>
              <div className="font-mono font-bold text-sky-400">Arc Testnet</div>
              <div className="text-[10px] text-muted-foreground mt-1">Stablecoin-native L1 settlement</div>
            </div>
            <div>
              <div className="font-mono font-bold text-emerald-400">x402 Protocol</div>
              <div className="text-[10px] text-muted-foreground mt-1">HTTP 402 nanopayment standard</div>
            </div>
            <div>
              <div className="font-mono font-bold text-purple-400">2 Contracts</div>
              <div className="text-[10px] text-muted-foreground mt-1">SkillRegistry + PaymentGuard</div>
            </div>
            <div>
              <div className="font-mono font-bold text-amber-400">DeepSeek LLM</div>
              <div className="text-[10px] text-muted-foreground mt-1">Task decomposition + aggregation</div>
            </div>
          </div>
        </div>
      </section>

      {/* Login */}
      <section className="max-w-sm mx-auto px-6 pb-16">
        <LoginCard />
      </section>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        <p>
          AgentForge — Agentic Economy on Arc Hackathon 2026
          <span className="mx-2">|</span>
          <a
            href="https://testnet.arcscan.app/address/0x27853b1D8c6E38A86B99597A2e5334c15F532f21"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            SkillRegistry
          </a>
          <span className="mx-2">|</span>
          <a
            href="https://testnet.arcscan.app/address/0x80a5FfE02BFB34dF0C05541c47b77182391bE3B1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            PaymentGuard
          </a>
        </p>
      </footer>
    </main>
  );
}
