import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@/contexts/WalletContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  8453: 'Base',
  84532: 'Base Sepolia',
  11155111: 'Sepolia',
};

export function Navigation() {
  const location = useLocation();
  const [isHovered, setIsHovered] = useState<string | null>(null);
  const { isConnected, walletAddress, connect, disconnect, chainId } = useWallet();

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
    }
  };

  const visitorLinks = [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
  ];

  const userLinks = [
    { name: "Swap", path: "/swap" },
    { name: "Pool", path: "/liquidity" },
    { name: "Compute", path: "/compute" },
    { name: "About", path: "/about" },
  ];

  const links = isConnected ? userLinks : visitorLinks;
  const chainName = chainId ? CHAIN_NAMES[chainId] || `Chain ${chainId}` : 'Unknown';

  return (
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
      <div className="glass capsule flex items-center gap-2 animate-fade-in">
        {/* Brand */}
        <Link
          to="/"
          className="text-foreground font-medium text-sm tracking-tight pr-4 border-r border-border/50"
        >
          Flux Compute
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-1 px-2">
          {links.map((link) => {
            const isActive = location.pathname === link.path ||
              (link.path === "/" && location.pathname === "/" && !isConnected);

            return (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium transition-all duration-300 rounded-full",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onMouseEnter={() => setIsHovered(link.path)}
                onMouseLeave={() => setIsHovered(null)}
              >
                {/* Active/Hover pill background */}
                {(isActive || isHovered === link.path) && (
                  <span
                    className={cn(
                      "absolute inset-0 rounded-full transition-all duration-300",
                      isActive
                        ? "bg-primary glow opacity-100"
                        : "bg-muted opacity-50"
                    )}
                    style={{ zIndex: -1 }}
                  />
                )}
                {link.name}
              </Link>
            );
          })}
        </div>

        {/* Wallet Button */}
        <div className="pl-2 border-l border-border/50">
          {isConnected ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="glass rounded-full px-4 py-2 h-auto gap-2 text-sm font-mono hover:bg-muted/50"
                >
                  {/* Jazzicon placeholder */}
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-lavender to-mint" />
                  <span className="text-foreground">{truncateAddress(walletAddress || "0x0000...0000")}</span>
                  <div className="flex items-center gap-1 text-mint text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />
                    <span>{chainName}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="glass rounded-2xl p-2 min-w-[200px] border-border/50"
              >
                <DropdownMenuItem className="rounded-xl cursor-pointer gap-2" onClick={copyAddress}>
                  <Copy className="w-4 h-4" />
                  Copy Address
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl cursor-pointer gap-2">
                  <ExternalLink className="w-4 h-4" />
                  View on Explorer
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem
                  className="rounded-xl cursor-pointer gap-2 text-coral focus:text-coral"
                  onClick={() => disconnect()}
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={connect}
              className="btn-gradient rounded-full px-5 py-2 h-auto text-sm font-medium gap-2 hover:opacity-90 transition-opacity"
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
