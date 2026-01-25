import { ReactNode } from "react";
import { Navigation } from "./Navigation";
import { FluxBackground } from "./FluxBackground";
import { useWallet } from "@/contexts/WalletContext";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isConnected, walletAddress, connect, disconnect } = useWallet();

  return (
    <div className="min-h-screen">
      <FluxBackground />
      <Navigation 
        isConnected={isConnected}
        onConnect={connect}
        onDisconnect={disconnect}
        walletAddress={walletAddress || undefined}
      />
      <main className="pt-24">
        {children}
      </main>
    </div>
  );
}
