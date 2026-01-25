import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap, Brain, Coins } from "lucide-react";

export function Landing() {
  const { connect, isConnected } = useWallet();
  const navigate = useNavigate();

  const handleEnter = () => {
    if (isConnected) {
      navigate("/swap");
    } else {
      connect();
      // Navigate after connection
      setTimeout(() => navigate("/swap"), 100);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Hero Content */}
      <div className="text-center max-w-4xl mx-auto relative z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-mint animate-pulse" />
          <span className="text-caption text-muted-foreground">Decentralized Compute Network</span>
        </div>

        {/* Main Heading */}
        <h1 className="text-display-xl mb-6 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <span className="text-foreground">Liquidity Meets</span>
          <br />
          <span className="text-gradient glow-text">Intelligence</span>
        </h1>

        {/* Subtitle */}
        <p 
          className="text-body-l text-muted-foreground max-w-2xl mx-auto mb-12 animate-fade-in"
          style={{ animationDelay: "200ms" }}
        >
          The first decentralized exchange powering AI compute access. 
          Swap tokens, fund projects, and pay-per-prompt with seamless x402 integration.
        </p>

        {/* CTA Button */}
        <div className="animate-fade-in" style={{ animationDelay: "300ms" }}>
          <Button
            onClick={handleEnter}
            className="btn-gradient rounded-full px-10 py-6 h-auto text-lg font-medium gap-3 breathe hover:opacity-90 transition-all group"
          >
            Enter Flux
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>

        {/* Feature Pills */}
        <div 
          className="flex flex-wrap items-center justify-center gap-4 mt-16 animate-fade-in"
          style={{ animationDelay: "400ms" }}
        >
          <FeaturePill icon={<Coins className="w-4 h-4" />} label="AMM Swaps" />
          <FeaturePill icon={<Brain className="w-4 h-4" />} label="AI Compute" />
          <FeaturePill icon={<Zap className="w-4 h-4" />} label="x402 Payments" />
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-lavender/5 blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-mint/5 blur-3xl animate-pulse-glow delay-500" />
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="glass rounded-full px-5 py-2.5 flex items-center gap-2 hover:border-primary/30 transition-colors cursor-default">
      <span className="text-lavender">{icon}</span>
      <span className="text-sm text-foreground">{label}</span>
    </div>
  );
}
