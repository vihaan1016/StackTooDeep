import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount, usePublicClient } from 'wagmi';
import { parseEther, formatEther, keccak256, encodeAbiParameters, parseAbiParameters, toHex } from 'viem';
import { FLUX_POOL_ADDRESS, FLUX_POOL_ABI, FLUX_TOKEN_ADDRESS, ERC20_ABI } from '../config/contracts';
import { useFluxPool } from './useFluxPool';
import { useEffect, useState } from 'react';

export function useLiquidity() {
    const { reserves } = useFluxPool();
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [userLiquidity, setUserLiquidity] = useState<string>('0');
    const [totalLiquidity, setTotalLiquidity] = useState<string>('0');

    const { writeContract, data: hash, isPending: isWritePending, error } = useWriteContract();
    const { writeContract: writeApprove, data: approveHash, isPending: isApprovePending } = useWriteContract();

    // Transaction Receipts
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });
    const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
        hash: approveHash,
    });

    // Check Allowance
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: FLUX_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, FLUX_POOL_ADDRESS] : undefined,
    });

    // Read LP Balance (Slot 3) and Total Liquidity (Slot 2)
    const fetchLiquidityData = async () => {
        if (!publicClient) return;
        try {
            // Fetch User Balance (Slot 3)
            if (address) {
                const userSlot = keccak256(encodeAbiParameters(
                    parseAbiParameters('address, uint256'),
                    [address, 3n]
                ));
                const userData = await publicClient.getStorageAt({
                    address: FLUX_POOL_ADDRESS,
                    slot: userSlot
                });
                setUserLiquidity(userData ? formatEther(BigInt(userData)) : '0');
            }

            // Fetch Total Liquidity (Slot 2)
            const totalData = await publicClient.getStorageAt({
                address: FLUX_POOL_ADDRESS,
                slot: toHex(2)
            });
            setTotalLiquidity(totalData ? formatEther(BigInt(totalData)) : '0');
        } catch (err) {
            console.error("Failed to read liquidity storage:", err);
        }
    };

    useEffect(() => {
        fetchLiquidityData();
        const interval = setInterval(fetchLiquidityData, 10000);
        return () => clearInterval(interval);
    }, [address, publicClient, isSuccess]);


    const isPending = isWritePending || isApprovePending;

    const approveFlux = (amount: string) => {
        if (!address) return;
        writeApprove({
            address: FLUX_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [FLUX_POOL_ADDRESS, parseEther(amount)],
            account: address,
        } as any);
    }

    const addLiquidity = (ethAmount: string, fluxAmount: string) => {
        if (!address) return;
        // 5% slippage tolerance: minFluxIn = fluxAmount * 0.95
        // This ensures the transaction doesn't fail if the calculated required flux is slightly lower than the input
        const minFluxIn = parseEther(fluxAmount) * 950n / 1000n;

        writeContract({
            address: FLUX_POOL_ADDRESS,
            abi: FLUX_POOL_ABI,
            functionName: 'addLiquidity',
            args: [minFluxIn],
            value: parseEther(ethAmount),
            account: address,
        } as any);
    };

    const removeLiquidity = (liquidityAmount: string) => {
        if (!address) return;
        writeContract({
            address: FLUX_POOL_ADDRESS,
            abi: FLUX_POOL_ABI,
            functionName: 'removeLiquidity',
            args: [parseEther(liquidityAmount)],
            account: address,
        } as any);
    };

    return {
        addLiquidity,
        removeLiquidity,
        approveFlux,
        allowance,
        userLiquidity,
        totalLiquidity,
        refetchLiquidity: fetchLiquidityData,
        refetchAllowance,
        isPending,
        isConfirming,
        isSuccess,
        isApproveConfirming,
        isApproveSuccess,
        hash,
        error,
        reserves
    };
}
