import { createPublicClient, createWalletClient, http, parseAbi, parseUnits, formatUnits } from "viem"
import { sepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import dotenv from "dotenv"

dotenv.config()

const FLUX_ADDR = process.env.FLUX_TOKEN_ADDRESS
const PROTOCOL_ADDR = process.env.AI_PAYMENT_PROTOCOL_ADDRESS
const BACKEND_WALLET = process.env.BACKEND_WALLET
const PRIVATE_KEY = process.env.BACKEND_WALLET_PRIVATE_KEY
const RATE = 5n

const publicClient = createPublicClient({ chain: sepolia, transport: http() })

let walletClient = null, account = null
if (PRIVATE_KEY) {
    account = privateKeyToAccount(PRIVATE_KEY)
    walletClient = createWalletClient({ account, chain: sepolia, transport: http() })
}

const FLUX_ABI = parseAbi([
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address, uint256) returns (bool)",
    "function burn(uint256)",
    "event Transfer(address indexed, address indexed, uint256)"
])

const PROTOCOL_ABI = parseAbi([
    "function createSessionForUser(address, uint256) returns (uint256)",
    "function chargeForUsage(uint256, uint256) returns (bool)",
    "function getSessionInfo(uint256) view returns (address, uint256, uint256, uint256, uint256, bool)",
    "function topupSessionForUser(uint256, address, uint256) returns (bool)",
    "function closeSession(uint256)",
    "function getConversion(uint256) view returns (uint256)"
])

function isLive() {
    return !!(FLUX_ADDR && PROTOCOL_ADDR && BACKEND_WALLET && walletClient)
}

export function getBackendWallet() {
    return BACKEND_WALLET || "0x0000000000000000000000000000000000000000"
}

export function getConversionSync(aiTokens) {
    const t = BigInt(aiTokens)
    return (t + RATE - 1n) / RATE
}

export async function verifyPaymentTx(txHash, expectedAmount, sender) {
    if (!isLive()) return { verified: true, amount: expectedAmount, sender }

    const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
    if (receipt.status !== "success") return { verified: false, error: "TX failed" }

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== FLUX_ADDR.toLowerCase()) continue
        if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
            const to = "0x" + log.topics[2].slice(26)
            if (to.toLowerCase() === BACKEND_WALLET.toLowerCase()) {
                return { verified: true, amount: BigInt(log.data), sender }
            }
        }
    }
    return { verified: false, error: "No transfer found" }
}

export async function burnFlux(amount) {
    if (!isLive()) return { txHash: `0xmock${Date.now().toString(16)}` }

    const hash = await walletClient.writeContract({
        address: FLUX_ADDR, abi: FLUX_ABI, functionName: "burn",
        args: [parseUnits(amount.toString(), 18)]
    })
    await publicClient.waitForTransactionReceipt({ hash })
    return { txHash: hash }
}

export async function createSessionForUser(userAddress, authorizedAmount) {
    if (!isLive()) return { sessionId: Date.now() % 10000, txHash: `0xmock${Date.now().toString(16)}` }

    const hash = await walletClient.writeContract({
        address: PROTOCOL_ADDR, abi: PROTOCOL_ABI, functionName: "createSessionForUser",
        args: [userAddress, parseUnits(authorizedAmount.toString(), 18)]
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    const sessionId = parseInt(receipt.logs[0]?.topics[1], 16)
    return { sessionId, txHash: hash }
}

export async function chargeForUsage(sessionId, aiTokensUsed) {
    const fluxAmount = getConversionSync(aiTokensUsed)
    if (!isLive()) return { txHash: `0xmock${Date.now().toString(16)}`, fluxCharged: fluxAmount }

    const hash = await walletClient.writeContract({
        address: PROTOCOL_ADDR, abi: PROTOCOL_ABI, functionName: "chargeForUsage",
        args: [BigInt(sessionId), parseUnits(aiTokensUsed.toString(), 18)]
    })
    try { await publicClient.waitForTransactionReceipt({ hash, timeout: 60000 }) } catch { }
    return { txHash: hash, fluxCharged: fluxAmount }
}

export async function getSessionInfo(sessionId) {
    if (!isLive()) {
        return {
            user: "0x0", authorizedAmount: 1000000n, usedAmount: 0n,
            remainingAmount: 1000000n, remainingAITokens: 1000000n * RATE, isActive: true
        }
    }

    const r = await publicClient.readContract({
        address: PROTOCOL_ADDR, abi: PROTOCOL_ABI, functionName: "getSessionInfo",
        args: [BigInt(sessionId)]
    })
    return {
        user: r[0], authorizedAmount: r[1], usedAmount: r[2],
        remainingAmount: r[3], remainingAITokens: r[4], isActive: r[5]
    }
}

export async function topupSessionForUser(sessionId, userAddress, additionalAmount) {
    if (!isLive()) return { txHash: `0xmock${Date.now().toString(16)}` }

    const hash = await walletClient.writeContract({
        address: PROTOCOL_ADDR, abi: PROTOCOL_ABI, functionName: "topupSessionForUser",
        args: [BigInt(sessionId), userAddress, parseUnits(additionalAmount.toString(), 18)]
    })
    await publicClient.waitForTransactionReceipt({ hash })
    return { txHash: hash }
}

export async function closeSession(sessionId) {
    if (!isLive()) return { txHash: `0xmock${Date.now().toString(16)}` }

    const hash = await walletClient.writeContract({
        address: PROTOCOL_ADDR, abi: PROTOCOL_ABI, functionName: "closeSession",
        args: [BigInt(sessionId)]
    })
    await publicClient.waitForTransactionReceipt({ hash })
    return { txHash: hash }
}

export async function getConversion(aiTokens) {
    if (!isLive()) return getConversionSync(aiTokens)
    try {
        return await publicClient.readContract({
            address: PROTOCOL_ADDR, abi: PROTOCOL_ABI, functionName: "getConversion",
            args: [BigInt(aiTokens)]
        })
    } catch { return getConversionSync(aiTokens) }
}
