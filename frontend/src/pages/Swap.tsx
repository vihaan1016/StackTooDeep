import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, ArrowDownUp, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFluxPool } from "@/hooks/useFluxPool";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { parseEther } from "viem";

// Only ETH and FLUX tokens for AMM
interface Token {
  symbol: string;
  name: string;
  icon: string;
  color: string;
}

const ETH_TOKEN: Token = { symbol: "ETH", name: "Ethereum", icon: "💎", color: "from-purple-400 to-purple-600" };
const FLUX_TOKEN: Token = { symbol: "FLUX", name: "Flux Token", icon: "⚡", color: "from-lavender to-mint" };

export default function Swap() {
  const { isConnected, connect, fluxBalance, ethBalance } = useWallet();
  const {
    getSpotPrice,
    getAmountOut,
    swapEthForFlux,
    swapFluxForEth,
    approveFlux,
    allowance,
    isLoading,
    isConfirming,
    isSuccess,
    isApproveConfirming,
    isApproveSuccess,
    txHash,
    error,
    hasLiquidity,
    refetchReserves,
    refetchAllowance
  } = useFluxPool();

  const [isEthToFlux, setIsEthToFlux] = useState(true);
  const [fromAmount, setFromAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");

  // Get tokens based on direction
  const fromToken = isEthToFlux ? ETH_TOKEN : FLUX_TOKEN;
  const toToken = isEthToFlux ? FLUX_TOKEN : ETH_TOKEN;
  const fromBalance = isEthToFlux ? ethBalance : fluxBalance;
  const toBalance = isEthToFlux ? fluxBalance : ethBalance;

  // Calculate output amount using AMM
  const toAmount = fromAmount && Number(fromAmount) > 0
    ? getAmountOut(fromAmount, isEthToFlux)
    : "";

  // Get exchange rate
  const exchangeRate = getSpotPrice(isEthToFlux);

  // Handle swap direction toggle
  const handleSwapTokens = () => {
    setIsEthToFlux(!isEthToFlux);
    setFromAmount("");
  };

  // Handle success
  useEffect(() => {
    if (isSuccess && txHash) {
      toast.success("Swap successful!", {
        description: `Transaction: ${txHash.slice(0, 10)}...`,
      });
      setFromAmount("");
      refetchReserves();
    }
  }, [isSuccess, txHash, refetchReserves]);

  // Handle approval success
  useEffect(() => {
    if (isApproveSuccess) {
      toast.success("Approval successful!");
      refetchAllowance();
    }
  }, [isApproveSuccess, refetchAllowance]);

  // Handle error
  useEffect(() => {
    if (error) {
      toast.error("Swap failed", { description: error });
    }
  }, [error]);

  const handleSwap = async () => {
    if (!isConnected) {
      connect();
      return;
    }

    if (!fromAmount || Number(fromAmount) <= 0) {
      toast.error("Please enter an amount");
      return;
    }

    if (!toAmount || Number(toAmount) <= 0) {
      toast.error("Invalid swap amount");
      return;
    }

    // Calculate minOut with slippage
    const slippagePercent = parseFloat(slippage) / 100;
    const minOut = (parseFloat(toAmount) * (1 - slippagePercent)).toFixed(18);

    try {
      if (isEthToFlux) {
        await swapEthForFlux(fromAmount, minOut);
      } else {
        await swapFluxForEth(fromAmount, minOut);
      }
    } catch (e) {
      // Error already handled in hook
    }
  };

  const isProcessing = isLoading || isConfirming;

  return (
    <Layout>
      <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Swap Card */}
          <div className="glass rounded-3xl p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-medium text-foreground">Swap</h2>
              <SlippageSettings slippage={slippage} setSlippage={setSlippage} />
            </div>

            {/* From Token */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">You pay</span>
                <span className="text-sm text-muted-foreground">
                  Balance: <span className="text-foreground mono">{fromBalance ? parseFloat(fromBalance).toFixed(4) : "0"}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent border-none outline-none text-3xl font-medium mono p-0 h-auto focus-visible:ring-0 focus:ring-0 focus:outline-none text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="glass flex items-center gap-2 px-3 py-2 rounded-xl">
                  <div className={cn("w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-sm", fromToken.color)}>
                    {fromToken.icon}
                  </div>
                  <span className="font-medium">{fromToken.symbol}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {["25%", "50%", "75%", "MAX"].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                      if (!fromBalance) return;
                      const balance = parseFloat(fromBalance);
                      const percentage = pct === "MAX" ? 0.99 : parseInt(pct) / 100; // Leave some for gas
                      setFromAmount((balance * percentage).toFixed(6));
                    }}
                    className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {pct}
                  </button>
                ))}
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-2 relative z-10">
              <button
                onClick={handleSwapTokens}
                className="glass w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted/50 transition-colors group"
              >
                <ArrowDownUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            </div>

            {/* To Token */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">You receive</span>
                <span className="text-sm text-muted-foreground">
                  Balance: <span className="text-foreground mono">{toBalance ? parseFloat(toBalance).toFixed(4) : "0"}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="text"
                  value={toAmount ? parseFloat(toAmount).toFixed(6) : ""}
                  placeholder="0.00"
                  readOnly
                  className="flex-1 bg-transparent border-none outline-none text-3xl font-medium mono p-0 h-auto focus-visible:ring-0 focus:ring-0 focus:outline-none text-muted-foreground"
                />
                <div className="glass flex items-center gap-2 px-3 py-2 rounded-xl">
                  <div className={cn("w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-sm", toToken.color)}>
                    {toToken.icon}
                  </div>
                  <span className="font-medium">{toToken.symbol}</span>
                </div>
              </div>
              {/* Spacer to match height of "You pay" section */}
              <div className="h-8 mt-3"></div>
            </div>

            {/* Exchange Rate Info */}
            {fromAmount && hasLiquidity && (
              <div className="mt-4 p-3 rounded-xl bg-muted/30 animate-fade-in">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="text-foreground mono">
                    1 {fromToken.symbol} = {exchangeRate.toFixed(4)} {toToken.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>Slippage</span>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-3 h-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Maximum price difference you're willing to accept</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-mint">{slippage}%</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Min. received</span>
                  <span className="text-foreground mono">
                    {(parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(4)} {toToken.symbol}
                  </span>
                </div>
              </div>
            )}

            {/* No Liquidity Warning */}
            {!hasLiquidity && (
              <div className="mt-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm">
                No liquidity in pool. Swaps are not available.
              </div>
            )}

            {/* Swap Button */}
            <Button
              onClick={
                !isEthToFlux && (!allowance || allowance < (fromAmount ? parseEther(fromAmount) : 0n))
                  ? () => approveFlux(fromAmount)
                  : handleSwap
              }
              disabled={
                !fromAmount ||
                isProcessing ||
                !hasLiquidity ||
                (!isEthToFlux && isApproveConfirming)
              }
              className={cn(
                "w-full mt-6 rounded-2xl py-6 h-auto text-lg font-medium transition-all",
                fromAmount && hasLiquidity
                  ? "btn-gradient hover:opacity-90"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isProcessing && !isApproveConfirming ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isConfirming ? "Confirming..." : "Processing..."}
                </div>
              ) : !isConnected ? (
                "Connect Wallet"
              ) : !hasLiquidity ? (
                "No Liquidity"
              ) : !isEthToFlux && (!allowance || allowance < (fromAmount ? parseEther(fromAmount) : 0n)) ? (
                isApproveConfirming ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Approving...
                  </div>
                ) : (
                  "Approve FLUX"
                )
              ) : fromAmount ? (
                "Swap"
              ) : (
                "Enter an amount"
              )}
            </Button>
          </div>

          {/* Powered By Badge */}
          <div className="flex justify-center mt-6 animate-fade-in" style={{ animationDelay: "200ms" }}>
            <div className="glass rounded-full px-4 py-2 text-xs text-muted-foreground">
              Powered by Flux AMM
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function SlippageSettings({ slippage, setSlippage }: { slippage: string; setSlippage: (v: string) => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="p-2 rounded-xl hover:bg-muted/50 transition-colors">
          <Settings className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </button>
      </DialogTrigger>
      <DialogContent className="glass rounded-3xl border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle>Swap Settings</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <label className="text-sm text-muted-foreground mb-3 block">Slippage Tolerance</label>
          <div className="flex gap-2">
            {["0.5", "1.0", "2.0"].map((value) => (
              <button
                key={value}
                onClick={() => setSlippage(value)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-sm font-medium transition-colors",
                  slippage === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground"
                )}
              >
                {value}%
              </button>
            ))}
            <div className="relative flex-1">
              <Input
                type="text"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                className="w-full py-2 h-auto text-center text-sm bg-muted/50 border-0 rounded-xl"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
