import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, ArrowDown, Droplets } from "lucide-react";
import { useLiquidity } from "@/hooks/useLiquidity";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEther, parseEther } from "viem";

export default function Liquidity() {
    const { isConnected, connect } = useWallet();
    const {
        addLiquidity,
        removeLiquidity,
        approveFlux,
        allowance,
        userLiquidity,
        isPending,
        isSuccess,
        isApproveConfirming,
        isConfirming,
        isApproveSuccess,
        reserves,
        refetchAllowance,
        totalLiquidity
    } = useLiquidity();

    const [ethAmount, setEthAmount] = useState("");
    const [fluxAmount, setFluxAmount] = useState("");
    const [liquidityAmount, setLiquidityAmount] = useState("");

    useEffect(() => {
        if (isSuccess) {
            toast.success("Transaction successful!");
            setEthAmount("");
            setFluxAmount("");
            setLiquidityAmount("");
        }
    }, [isSuccess]);

    useEffect(() => {
        if (isApproveSuccess) {
            toast.success("Approval confirmed!");
            refetchAllowance();
        }
    }, [isApproveSuccess, refetchAllowance]);

    const handleAddLiq = () => {
        if (!isConnected) return connect();
        if (!ethAmount || !fluxAmount) return;
        addLiquidity(ethAmount, fluxAmount);
    };

    const handleRemoveLiq = () => {
        if (!isConnected) return connect();
        if (!liquidityAmount) return;
        removeLiquidity(liquidityAmount);
    };

    const handleEthChange = (val: string) => {
        setEthAmount(val);
        if (!val) {
            setFluxAmount("");
            return;
        }
        if (reserves && reserves[0] > 0n && reserves[1] > 0n && !isNaN(Number(val))) {
            try {
                const ethVal = parseEther(val);
                const fluxVal = (ethVal * reserves[1]) / reserves[0];
                setFluxAmount(formatEther(fluxVal));
            } catch (e) {
                console.error("Error calculating flux amount:", e);
            }
        }
    };

    const handleFluxChange = (val: string) => {
        setFluxAmount(val);
        if (!val) {
            setEthAmount("");
            return;
        }
        if (reserves && reserves[0] > 0n && reserves[1] > 0n && !isNaN(Number(val))) {
            try {
                const fluxVal = parseEther(val);
                const ethVal = (fluxVal * reserves[0]) / reserves[1];
                setEthAmount(formatEther(ethVal));
            } catch (e) {
                console.error("Error calculating eth amount:", e);
            }
        }
    };

    return (
        <Layout>
            <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center px-4">
                <div className="w-full max-w-md">
                    <Tabs defaultValue="add" className="w-full">
                        <div className="flex justify-center mb-6">
                            <TabsList className="glass p-1 rounded-full border-border/50">
                                <TabsTrigger value="add" className="rounded-full px-6 py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-foreground">
                                    Add Liquidity
                                </TabsTrigger>
                                <TabsTrigger value="remove" className="rounded-full px-6 py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-foreground">
                                    Remove
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="glass rounded-3xl p-6 animate-fade-in relative overflow-hidden">
                            {isPending && (
                                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
                                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                </div>
                            )}

                            <TabsContent value="add" className="mt-0 space-y-4">
                                <div className="text-center mb-6">
                                    <h2 className="text-heading-m mb-2">Add Liquidity</h2>
                                    <p className="text-sm text-muted-foreground">Deposit ETH and FLUX to earn fees</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm text-muted-foreground ml-1">ETH Amount</label>
                                        <Input
                                            placeholder="0.0"
                                            value={ethAmount}
                                            onChange={e => handleEthChange(e.target.value)}
                                            className="glass text-lg py-6"
                                        />
                                    </div>

                                    <div className="flex justify-center text-muted-foreground">
                                        <Plus className="w-5 h-5" />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm text-muted-foreground ml-1">FLUX Amount</label>
                                        <Input
                                            placeholder="0.0"
                                            value={fluxAmount}
                                            onChange={e => handleFluxChange(e.target.value)}
                                            className="glass text-lg py-6"
                                        />
                                    </div>
                                </div>

                                {isConnected && fluxAmount && (!allowance || allowance < parseEther(fluxAmount)) ? (
                                    <Button
                                        onClick={() => approveFlux(fluxAmount)}
                                        disabled={isPending || isApproveConfirming}
                                        className="w-full btn-gradient rounded-xl py-6 mt-6 op-90"
                                    >
                                        {isApproveConfirming ? "Approving..." : "Step 1: Approve FLUX"}
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleAddLiq}
                                        disabled={!ethAmount || !fluxAmount || isPending || isConfirming}
                                        className="w-full btn-gradient rounded-xl py-6 mt-6"
                                    >
                                        {!isConnected
                                            ? "Connect Wallet"
                                            : !ethAmount || !fluxAmount
                                                ? "Enter Amount"
                                                : isConfirming
                                                    ? "Adding..."
                                                    : "Add Liquidity"
                                        }
                                    </Button>
                                )}
                            </TabsContent>

                            <TabsContent value="remove" className="mt-0 space-y-4">
                                <div className="text-center mb-6">
                                    <h2 className="text-heading-m mb-2">Remove Liquidity</h2>
                                    <p className="text-sm text-muted-foreground">Burn LP tokens to withdraw assets</p>
                                </div>

                                <div className="p-6 bg-muted/20 rounded-2xl flex flex-col items-center justify-center mb-4">
                                    <Droplets className="w-10 h-10 text-mint mb-2" />
                                    <span className="text-2xl font-mono font-medium">{userLiquidity || "0.00"}</span>
                                    <span className="text-xs text-muted-foreground mt-1">Your Pool Share</span>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground ml-1">LP Tokens to Remove</label>
                                    <Input
                                        placeholder="0.0"
                                        value={liquidityAmount}
                                        onChange={e => setLiquidityAmount(e.target.value)}
                                        className="glass text-lg py-6"
                                    />
                                </div>

                                <div className="flex justify-center text-muted-foreground py-2">
                                    <ArrowDown className="w-5 h-5" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="glass p-3 rounded-xl text-center">
                                        <div className="text-xs text-muted-foreground">Est. ETH</div>
                                        <div className="font-mono">
                                            {liquidityAmount && totalLiquidity && reserves && Number(totalLiquidity) > 0
                                                ? formatEther((parseEther(liquidityAmount) * reserves[0]) / parseEther(totalLiquidity)).slice(0, 8)
                                                : "--"}
                                        </div>
                                    </div>
                                    <div className="glass p-3 rounded-xl text-center">
                                        <div className="text-xs text-muted-foreground">Est. FLUX</div>
                                        <div className="font-mono">
                                            {liquidityAmount && totalLiquidity && reserves && Number(totalLiquidity) > 0
                                                ? formatEther((parseEther(liquidityAmount) * reserves[1]) / parseEther(totalLiquidity)).slice(0, 8)
                                                : "--"}
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleRemoveLiq}
                                    disabled={!liquidityAmount || isPending || isConfirming}
                                    className="w-full bg-muted hover:bg-destructive/10 text-destructive-foreground hover:text-destructive rounded-xl py-6 mt-6 transition-colors"
                                >
                                    {isConnected ? (isConfirming ? "Removing..." : "Remove Liquidity") : "Connect Wallet"}
                                </Button>
                            </TabsContent>
                        </div>

                        {/* Pool Stats */}
                        <div className="mt-6 glass rounded-2xl p-4 animate-fade-in delay-200">
                            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 text-lavender animate-spin-slow" />
                                Pool Statistics
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground block text-xs">ETH Reserve</span>
                                    <span className="font-mono">{reserves ? formatEther(reserves[0]) : "0.00"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs">FLUX Reserve</span>
                                    <span className="font-mono">{reserves ? formatEther(reserves[1]) : "0.00"}</span>
                                </div>
                            </div>
                        </div>
                    </Tabs>
                </div>
            </div>
        </Layout>
    );
}
