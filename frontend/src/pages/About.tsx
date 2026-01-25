import { Layout } from "@/components/layout/Layout";
import { Github, Zap, RefreshCw, Lock, Layers } from "lucide-react";

export default function About() {
  return (
    <Layout>
      <div className="min-h-[calc(100vh-6rem)] px-4 py-16 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-16 animate-fade-in">
          <span className="text-caption text-lavender mb-4 block">About</span>
          <h1 className="text-display-l mb-6">
            <span className="text-foreground">About </span>
            <span className="text-gradient">Flux Compute</span>
          </h1>
          <p className="text-body-l text-muted-foreground leading-relaxed">
            A decentralized platform that combines an AMM-based token economy with x402-style pay-per-compute AI access.
          </p>
        </div>

        {/* What is Flux Compute */}
        <div className="mb-16 animate-fade-in" style={{ animationDelay: "50ms" }}>
          <div className="glass rounded-2xl p-6">
            <p className="text-body-l text-muted-foreground leading-relaxed mb-4">
              At its core, Flux Compute is both:
            </p>
            <ul className="space-y-3 text-body-l text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-mint mt-1">•</span>
                <span>A <strong className="text-foreground">DeFi primitive</strong> for pricing and allocating scarce compute via market dynamics</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-mint mt-1">•</span>
                <span>An <strong className="text-foreground">AI gateway</strong> where users pay only when compute is actually consumed</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Core Ideas */}
        <div className="space-y-12">
          <Section title="Core Ideas" delay="100ms">
            <div className="space-y-6">
              <CoreIdea
                icon={<RefreshCw className="w-5 h-5" />}
                title="AMM-Driven Compute Pricing"
                description="Flux Compute uses an Automated Market Maker (AMM) to price access to AI compute. Demand for compute is reflected directly in token prices, enabling real-time, market-driven pricing instead of fixed subscriptions. Liquidity providers participate in the compute economy by supplying capital to the pool."
              />
              <CoreIdea
                icon={<Zap className="w-5 h-5" />}
                title="x402 Pay-Per-Compute"
                description="Inspired by HTTP 402 Payment Required, every AI request follows a pay-as-you-go flow. Each request estimates required compute, charges and burns tokens on-chain, then executes the AI request. Users pay only for what they use, exactly when they use it."
              />
              <CoreIdea
                icon={<Lock className="w-5 h-5" />}
                title="On-Chain Enforcement"
                description="All payments and usage limits are enforced by smart contracts, not off-chain trust. Token burns and usage accounting are fully transparent and verifiable on-chain."
              />
              <CoreIdea
                icon={<Layers className="w-5 h-5" />}
                title="Decoupled Architecture"
                description="Economics & enforcement live on-chain. AI execution runs off-chain. Frontend remains lightweight and permissionless. This separation keeps the system flexible, auditable, and provider-agnostic."
              />
            </div>
          </Section>

          <Section title="Tech Stack" delay="200ms">
            <div className="grid grid-cols-2 gap-4">
              <TechItem name="Next.js + React + TypeScript" description="Frontend Framework" />
              <TechItem name="Tailwind CSS" description="Styling" />
              <TechItem name="Viem" description="Ethereum Interactions" />
              <TechItem name="AMM-based pricing" description="Token Economics" />
              <TechItem name="x402-style payments" description="Pay-Per-Compute Model" />
              <TechItem name="Sepolia Ethereum" description="Blockchain Network" />
              <TechItem name="Node + Express + MongoDB" description="Server Runtime" />
              <TechItem name="ERC-20 + EIP-3009" description="Utility Tokens with Gasless Transfers" />
            </div>
          </Section>

          <Section title="Team" delay="300ms">
            <p className="mb-6">
              Built with ❤️ by <strong className="text-foreground">Pranav</strong>, <strong className="text-foreground">Vedant</strong>, and <strong className="text-foreground">Vihaan</strong>.
            </p>
            <a
              href="https://github.com/pranav7002/StackTooDeep.git"
              target="_blank"
              rel="noopener noreferrer"
              className="glass rounded-full px-5 py-2.5 inline-flex items-center gap-2 hover:border-primary/30 transition-colors"
            >
              <Github className="w-4 h-4" />
              <span className="text-sm">GitHub</span>
            </a>
          </Section>
        </div>
      </div>
    </Layout>
  );
}

function Section({
  title,
  children,
  delay = "0ms"
}: {
  title: string;
  children: React.ReactNode;
  delay?: string;
}) {
  return (
    <section className="animate-fade-in" style={{ animationDelay: delay }}>
      <h2 className="text-caption text-mint mb-6">{title}</h2>
      <div className="space-y-4 text-body-l text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function CoreIdea({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="text-mint">{icon}</div>
        <h3 className="font-medium text-foreground">{title}</h3>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function TechItem({ name, description }: { name: string; description: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="font-medium text-foreground">{name}</div>
      <div className="text-sm text-muted-foreground">{description}</div>
    </div>
  );
}
