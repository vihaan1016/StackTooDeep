import { useState, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useWriteContract, usePublicClient } from 'wagmi';
import { parseEther, formatEther, maxUint256, type Address } from 'viem';
import { FLUX_TOKEN_ADDRESS, ERC20_ABI, AI_PAYMENT_PROTOCOL_ADDRESS } from '../config/contracts';
import { toast } from 'sonner';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    txHash?: string;
}

interface Project {
    projectId: string;
    name: string;
    description: string;
    paymentModel: 'paper' | 'allocation';
    ownerAddress: string;
}

export function useCompute() {
    const { walletAddress } = useWallet();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isChatting, setIsChatting] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<'idle' | 'approving' | 'paying' | 'verifying' | 'generating'>('idle');

    const [paymentRequired, setPaymentRequired] = useState<{
        fluxRequired: string;
        recipient: string | null;
        estimatedTokens: number;
        pendingPrompt: string;
        projectId: string;
        method?: 'transfer' | 'topup';
        sessionId?: number;
    } | null>(null);

    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    // Fetch fresh project data
    const refreshProjects = useCallback(async (ownerAddress?: string) => {
        try {
            if (ownerAddress) {
                const res = await fetch(`/api/x402/projects?owner=${ownerAddress}`);
                const data = await res.json();
                if (data.success) {
                    localStorage.setItem('flux_projects', JSON.stringify(data.data));
                    return data.data;
                }
            }
            return JSON.parse(localStorage.getItem('flux_projects') || '[]');
        } catch (e) {
            console.error("Failed to refresh projects", e);
            return JSON.parse(localStorage.getItem('flux_projects') || '[]');
        }
    }, []);

    // Create Project
    const createProject = useCallback(async (name: string, description: string, paymentModel: 'paper' | 'allocation', allocationAmount?: string) => {
        const projectId = Math.floor(Math.random() * 1000000).toString();
        try {
            // 1. Create Project
            const res = await fetch('/api/x402/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    ownerAddress: walletAddress,
                    name,
                    description,
                    paymentModel
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            let finalProject = data.data;

            // 2. If Allocation, Create Session
            if (paymentModel === 'allocation') {
                try {
                    const amountToAuthorize = allocationAmount || "10";
                    const amountWei = parseEther(amountToAuthorize);

                    if (!publicClient || !walletAddress) {
                        throw new Error("Wallet not connected or client unavailable");
                    }

                    // A. Check Allowance
                    // @ts-ignore - publicClient type mismatch workaround
                    const allowance = await publicClient.readContract({
                        address: FLUX_TOKEN_ADDRESS,
                        abi: ERC20_ABI,
                        functionName: 'allowance',
                        args: [walletAddress as Address, AI_PAYMENT_PROTOCOL_ADDRESS]
                    }) as bigint;

                    // B. Approve if needed
                    if (allowance < amountWei) {
                        toast.info("Approving FLUX tokens...");
                        // @ts-ignore
                        const approvetx = await writeContractAsync({
                            address: FLUX_TOKEN_ADDRESS,
                            abi: ERC20_ABI,
                            functionName: 'approve',
                            args: [AI_PAYMENT_PROTOCOL_ADDRESS, maxUint256],
                            account: walletAddress as Address
                        });
                        await publicClient.waitForTransactionReceipt({ hash: approvetx });
                        toast.success("Approval successful!");
                    }

                    // C. Create Session
                    toast.info("Creating session...");
                    const sessionRes = await fetch('/api/x402/sessions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projectId,
                            authorizedAmount: amountToAuthorize
                        }),
                    });
                    const sessionData = await sessionRes.json();
                    if (sessionData.success) {
                        // Refresh to get the updated project with sessionId
                        const freshRes = await fetch(`/api/x402/projects/${projectId}`);
                        const freshData = await freshRes.json();
                        if (freshData.success) finalProject = freshData.data;
                        toast.success("Session created successfully!");
                    } else {
                        throw new Error(sessionData.error);
                    }
                } catch (e: any) {
                    console.error("Failed to init session", e);
                    toast.warning(`Project created but session initialization failed: ${e.message}`);
                }
            }

            // Store locally
            const stored = JSON.parse(localStorage.getItem('flux_projects') || '[]');
            localStorage.setItem('flux_projects', JSON.stringify([...stored, finalProject]));

            return finalProject;
        } catch (err: any) {
            toast.error(err.message || 'Failed to create project');
            throw err;
        }
    }, [walletAddress, publicClient, writeContractAsync]);

    const getProjects = useCallback(() => {
        // Helper to get local, but we encourage using refreshProjects in UI
        return JSON.parse(localStorage.getItem('flux_projects') || '[]');
    }, []);

    // Send Message
    const sendMessage = useCallback(async (projectId: string, prompt: string, paymentTxHash?: string, skipUserMessage: boolean = false) => {
        setIsChatting(true);
        if (!paymentTxHash) setProcessingStatus('generating');

        // Optimistically add user message
        if (!skipUserMessage) {
            setMessages(prev => [
                ...prev,
                { role: 'user', content: prompt, txHash: paymentTxHash }
            ]);
        }

        try {
            const res = await fetch('/api/x402/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    prompt,
                    paymentTxHash
                }),
            });

            if (res.status === 402) {
                const errorData = await res.json();
                const { payment } = errorData;
                setPaymentRequired({
                    fluxRequired: formatEther(BigInt(payment.fluxRequired)),
                    recipient: payment.recipient || null,
                    estimatedTokens: payment.estimatedTokens,
                    pendingPrompt: prompt,
                    projectId,
                    method: payment.method || 'transfer',
                    sessionId: payment.sessionId
                });
                setIsChatting(false);
                return;
            }

            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: data.data.response, txHash: data.data.txHash }
            ]);

            setPaymentRequired(null);
        } catch (err: any) {
            toast.error(err.message || 'Chat failed');
            // Optional: Remove the user message if it failed? 
            // setMessages(prev => prev.slice(0, -1));
        } finally {
            setIsChatting(false);
            setProcessingStatus('idle');
        }
    }, [setIsChatting, setProcessingStatus, setMessages, setPaymentRequired]);

    // Pay and Retry
    const payForCompute = useCallback(async () => {
        if (!paymentRequired || !publicClient) return;

        setIsPaying(true);
        setProcessingStatus('paying');
        try {
            let hash = "";

            if (paymentRequired.method === 'topup' && paymentRequired.sessionId) {
                // 1. Topup Flow (Allocation Model)
                const amountWei = parseEther(paymentRequired.fluxRequired);

                // Check allowance again
                // @ts-ignore
                const allowance = await publicClient.readContract({
                    address: FLUX_TOKEN_ADDRESS,
                    abi: ERC20_ABI,
                    functionName: 'allowance',
                    args: [walletAddress as Address, AI_PAYMENT_PROTOCOL_ADDRESS]
                }) as bigint;

                if (allowance < amountWei) {
                    toast.info("Approving additional tokens...");
                    // @ts-ignore
                    const approvetx = await writeContractAsync({
                        address: FLUX_TOKEN_ADDRESS,
                        abi: ERC20_ABI,
                        functionName: 'approve',
                        args: [AI_PAYMENT_PROTOCOL_ADDRESS, maxUint256],
                        account: walletAddress as Address
                    });
                    await publicClient.waitForTransactionReceipt({ hash: approvetx });
                }

                // Call Topup Endpoint
                toast.info("Topping up session...");
                const res = await fetch(`/api/x402/sessions/${paymentRequired.sessionId}/topup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        additionalAmount: paymentRequired.fluxRequired
                    }),
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error);
                hash = data.data.txHash; // Usually a mock or backend hash until fully on-chain topup is implemented or verified
                toast.success("Session top-up successful!");

            } else {
                // 2. Transfer Flow (Paper Model) - Default
                if (!paymentRequired.recipient) throw new Error("Recipient required for transfer");

                // @ts-ignore
                hash = await writeContractAsync({
                    address: FLUX_TOKEN_ADDRESS,
                    abi: ERC20_ABI,
                    functionName: 'transfer',
                    args: [paymentRequired.recipient as Address, parseEther(paymentRequired.fluxRequired)],
                    account: walletAddress as Address
                });
                toast.info("Payment broadcasted. Waiting for confirmation...");
                // Wait for Receipt
                await publicClient.waitForTransactionReceipt({ hash });
                toast.success("Payment confirmed!");
            }

            setProcessingStatus('verifying'); // Or generating directly?

            // 3. Retry Message
            // If topup, we just retry. If transfer, we pass the hash.
            // For topup, the hash is technically the topup tx, but chat doesn't need paymentTxHash 
            // because it checks session balance. But we can pass it for logging.
            // Actually, for Allocation model, the chat endpoint doesn't use `paymentTxHash` in the body to verify payment.
            // It checks the session balance. So `paymentTxHash` is optional or unused for allocation retry.
            setProcessingStatus('generating');
            await sendMessage(paymentRequired.projectId, paymentRequired.pendingPrompt, hash, true);

        } catch (err) {
            console.error(err);
            toast.error("Payment failed or rejected");
            setProcessingStatus('idle');
        } finally {
            setIsPaying(false);
        }
    }, [paymentRequired, publicClient, sendMessage, writeContractAsync, walletAddress]);

    // Delete Project
    const deleteProject = async (projectId: string) => {
        try {
            const res = await fetch(`/api/x402/projects/${projectId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            // Update local cache
            const stored = JSON.parse(localStorage.getItem('flux_projects') || '[]');
            const updated = stored.filter((p: any) => p.projectId !== projectId);
            localStorage.setItem('flux_projects', JSON.stringify(updated));

            // Remove messages if any for this project locally? 
            // We fetch messages now, so no need to clear local message state as it will be replaced.

            toast.success("Project deleted");
            return true;
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete project');
            return false;
        }
    };

    // Load Messages
    const loadMessages = useCallback(async (projectId: string) => {
        try {
            const res = await fetch(`/api/x402/projects/${projectId}/messages`);
            const data = await res.json();
            if (data.success) {
                setMessages(data.data);
            }
        } catch (err) {
            console.error("Failed to load messages", err);
        }
    }, [setMessages]);

    return {
        createProject,
        deleteProject,
        getProjects,
        refreshProjects,
        sendMessage,
        loadMessages,
        messages,
        isChatting,
        paymentRequired,
        payForCompute,
        isPaying,
        processingStatus,
        setMessages,
        setPaymentRequired
    };
}
