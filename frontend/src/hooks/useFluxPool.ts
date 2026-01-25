import { useReadContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { useWalletClient } from 'wagmi';
import { parseEther, formatEther, encodeFunctionData } from 'viem';
import { FLUX_POOL_ADDRESS, FLUX_POOL_ABI, FLUX_TOKEN_ADDRESS, ERC20_ABI } from '../config/contracts';
import { useState, useCallback } from 'react';

export function useFluxPool() {
    const { address } = useAccount();
    const { data: walletClient } = useWalletClient();

    // State
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
    const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Wait for Swap tx
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    // Wait for Approval tx
    const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
        hash: approveTxHash,
    });

    // Read Reserves
    const { data: reserves, refetch: refetchReserves } = useReadContract({
        address: FLUX_POOL_ADDRESS,
        abi: FLUX_POOL_ABI,
        functionName: 'getReserves',
    });

    // Check Allowance
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: FLUX_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, FLUX_POOL_ADDRESS] : undefined,
    });

    // Get spot price
    const getSpotPrice = useCallback((ethToFlux: boolean): number => {
        if (!reserves) return 0;
        const [ethRes, fluxRes] = reserves as [bigint, bigint];
        if (ethRes === 0n || fluxRes === 0n) return 0;
        const e = Number(formatEther(ethRes));
        const f = Number(formatEther(fluxRes));
        return ethToFlux ? f / e : e / f;
    }, [reserves]);

    // Calculate output amount using AMM formula
    const getAmountOut = useCallback((amountIn: string, isEthToFlux: boolean): string => {
        if (!reserves || !amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0) return '0';

        const [ethRes, fluxRes] = reserves as [bigint, bigint];
        const input = parseEther(amountIn);

        const resIn = isEthToFlux ? ethRes : fluxRes;
        const resOut = isEthToFlux ? fluxRes : ethRes;

        if (resIn === 0n || resOut === 0n) return '0';

        // AMM formula: dy = (dx * 997 * y) / (x * 1000 + dx * 997)
        const inputWithFee = input * 997n;
        const numerator = inputWithFee * resOut;
        const denominator = resIn * 1000n + inputWithFee;
        const output = numerator / denominator;

        return formatEther(output);
    }, [reserves]);

    // Swap ETH for FLUX
    const swapEthForFlux = useCallback(async (amountIn: string, minOut: string) => {
        if (!walletClient || !address) {
            setError("Wallet not connected");
            return;
        }

        setIsLoading(true);
        setError(null);
        setTxHash(undefined);

        try {
            const calldata = encodeFunctionData({
                abi: FLUX_POOL_ABI,
                functionName: 'swapEthForFlux',
                args: [parseEther(minOut), address],
            });

            const hash = await walletClient.sendTransaction({
                to: FLUX_POOL_ADDRESS,
                data: calldata,
                value: parseEther(amountIn),
                gas: 250000n, // Explicit gas to avoid MetaMask's 21M default
            });

            setTxHash(hash);
            return hash;
        } catch (e: any) {
            console.error("Swap error:", e);
            setError(e.shortMessage || e.message || "Transaction failed");
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, [walletClient, address]);

    // Approve FLUX spending
    const approveFlux = useCallback(async (amount: string) => {
        if (!walletClient) {
            setError("Wallet not connected");
            return;
        }

        setIsLoading(true);
        setError(null);
        setApproveTxHash(undefined);

        try {
            const calldata = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [FLUX_POOL_ADDRESS, parseEther(amount)],
            });

            const hash = await walletClient.sendTransaction({
                to: FLUX_TOKEN_ADDRESS,
                data: calldata,
                gas: 80000n,
            });

            setApproveTxHash(hash);
            return hash;
        } catch (e: any) {
            setError(e.shortMessage || e.message || "Approval failed");
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, [walletClient]);

    // Swap FLUX for ETH
    const swapFluxForEth = useCallback(async (amountIn: string, minOut: string) => {
        if (!walletClient || !address) {
            setError("Wallet not connected");
            return;
        }

        setIsLoading(true);
        setError(null);
        setTxHash(undefined);

        try {
            const calldata = encodeFunctionData({
                abi: FLUX_POOL_ABI,
                functionName: 'swapFluxForEth',
                args: [parseEther(minOut), parseEther(amountIn), address],
            });

            const hash = await walletClient.sendTransaction({
                to: FLUX_POOL_ADDRESS,
                data: calldata,
                gas: 250000n,
            });

            setTxHash(hash);
            return hash;
        } catch (e: any) {
            console.error("Swap error:", e);
            setError(e.shortMessage || e.message || "Transaction failed");
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, [walletClient, address]);

    // Check if pool has liquidity
    const hasLiquidity = reserves && (reserves as [bigint, bigint])[0] > 0n && (reserves as [bigint, bigint])[1] > 0n;

    return {
        reserves,
        refetchReserves,
        getSpotPrice,
        getAmountOut,
        swapEthForFlux,
        swapFluxForEth,
        approveFlux,
        isLoading,
        isConfirming,
        isSuccess,
        isApproveConfirming,
        isApproveSuccess,
        txHash,
        error,
        hasLiquidity,
        allowance,
        refetchAllowance,
    };
}
