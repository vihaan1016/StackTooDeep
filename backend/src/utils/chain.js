import { createPublicClient, createWalletClient, http, parseAbi, parseUnits, formatUnits } from "viem"
import { sepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { GasSpend } from "../models/gasSpend.model.js"
import dotenv from "dotenv"

dotenv.config()

const FLUX_ADDR = process.env.FLUX_TOKEN_ADDRESS
const PROTOCOL_ADDR = process.env.AI_PAYMENT_PROTOCOL_ADDRESS
const BACKEND_WALLET = process.env.BACKEND_WALLET
const PRIVATE_KEY = process.env.BACKEND_WALLET_PRIVATE_KEY
const RATE = 100n

const MAX_GAS_GWEI = 50n // 50 Gwei max base fee
const DAILY_GAS_LIMIT_ETH = parseUnits("0.1", 18) // 0.1 ETH daily limit

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
    "function receiveWithAuthorization(address, address, uint256, uint256, uint256, bytes32, uint8, bytes32, bytes32)",
    "event Transfer(address indexed, address indexed, uint256)"
])

const PROTOCOL_ABI = parseAbi([
    "function createSessionForUser(address, uint256) returns (uint256)",
    "function chargeForUsage(uint256, uint256) returns (bool)",
    "function getSessionInfo(uint256) view returns (address, uint256, uint256, uint256, uint256, bool)",
    "function topupSessionForUser(uint256, address, uint256) returns (bool)",
    "function closeSession(uint256)",
    "function getConversion(uint256) view returns (uint256)",
    "function conversionRate() view returns (uint256)",
    "function setConversionRate(uint256)"
])

class Mutex {
    constructor() {
        this.queue = [];
        this.locked = false;
    }

    async runExclusive(callback) {
        if (this.locked) {
            await new Promise(resolve => this.queue.push(resolve));
        }
        this.locked = true;
        try {
            return await callback();
        } finally {
            if (this.queue.length > 0) {
                const next = this.queue.shift();
                next();
            } else {
                this.locked = false;
            }
        }
    }
}

const txLock = new Mutex();

function isLive() {
    return !!(FLUX_ADDR && PROTOCOL_ADDR && BACKEND_WALLET && walletClient)
}

export function getBackendWallet() {
    return BACKEND_WALLET || "0x0000000000000000000000000000000000000000"
}

export async function checkGasHealth() {
    if (!isLive()) return { healthy: true }

    // 1. Check Oracle (Instant Gas Price)
    try {
        const gasPrice = await publicClient.getGasPrice()
        const maxFeeWei = MAX_GAS_GWEI * (10n ** 9n)

        if (gasPrice > maxFeeWei) {
            return {
                healthy: false,
                reason: `Gas price flush! ${formatUnits(gasPrice, 9)} gwei > ${MAX_GAS_GWEI} gwei`
            }
        }

        // 2. Check Daily Spend Limit
        const today = new Date().toISOString().split('T')[0]
        const todaySpends = await GasSpend.find({ date: today })

        let totalSpent = 0n
        for (const s of todaySpends) {
            totalSpent += BigInt(s.amountWei)
        }

        if (totalSpent > DAILY_GAS_LIMIT_ETH) {
            return {
                healthy: false,
                reason: `Daily gas limit reached (${formatUnits(totalSpent, 18)} ETH)`
            }
        }

        return { healthy: true }

    } catch (e) {
        console.error("Gas health check failed:", e)
        // Fail open or closed? Closed for security.
        return { healthy: false, reason: "Gas check error" }
    }
}

export function getConversionSync(aiTokens) {
    const t = BigInt(aiTokens)
    // 1 FLUX = RATE (100) Tokens
    // Cost in FLUX = (Tokens / RATE)
    // Cost in Wei = (Tokens * 10^18) / RATE
    const decimals = 1000000000000000000n // 1e18
    return (t * decimals) / RATE
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

    return txLock.runExclusive(async () => {
        const hash = await walletClient.writeContract({
            address: FLUX_ADDR, abi: FLUX_ABI, functionName: "burn",
            args: [BigInt(amount)]
        })
        await publicClient.waitForTransactionReceipt({ hash })
        return { txHash: hash }
    })
}

export async function refundFlux(userAddress, amount) {
    if (!isLive()) return { txHash: `0xmock${Date.now().toString(16)}` }

    return txLock.runExclusive(async () => {
        const hash = await walletClient.writeContract({
            address: FLUX_ADDR, abi: FLUX_ABI, functionName: "transfer",
            args: [userAddress, BigInt(amount)]
        })
        await publicClient.waitForTransactionReceipt({ hash })
        return { txHash: hash }
    })
}

export async function processGaslessPayment(signatureData) {
    if (!isLive()) return { verified: true, txHash: `0xmock${Date.now().toString(16)}` }

    const { from, to, value, validAfter, validBefore, nonce, v, r, s } = signatureData

    // Verify recipient is backend wallet to prevent burning tokens sent to randoms
    if (to.toLowerCase() !== BACKEND_WALLET.toLowerCase()) {
        return { verified: false, error: "Invalid recipient" }
    }

    return txLock.runExclusive(async () => {
        // Double Check Gas Health inside lock (optional but safer)
        const health = await checkGasHealth()
        if (!health.healthy) return { verified: false, error: health.reason }

        try {
            const hash = await walletClient.writeContract({
                address: FLUX_ADDR,
                abi: FLUX_ABI,
                functionName: "receiveWithAuthorization",
                args: [
                    from,
                    to,
                    BigInt(value),
                    BigInt(validAfter),
                    BigInt(validBefore),
                    nonce,
                    v,
                    r,
                    s
                ]
            })
            const receipt = await publicClient.waitForTransactionReceipt({ hash })
            if (receipt.status !== "success") return { verified: false, error: "TX failed on-chain" }

            // Record Gas Spend
            const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice
            const today = new Date().toISOString().split('T')[0]

            try {
                await GasSpend.create({
                    date: today,
                    amountWei: gasUsed.toString(),
                    txHash: hash
                })
            } catch (err) {
                console.error("Failed to log gas spend:", err)
            }

            return { verified: true, txHash: hash }
        } catch (e) {
            console.error("Gasless payment failed:", e)
            return { verified: false, error: e.message || "Execution failed" }
        }
    })
}

export async function createSessionForUser(userAddress, authorizedAmount) {
    if (!isLive()) return { sessionId: Date.now() % 10000, txHash: `0xmock${Date.now().toString(16)}` }

    return txLock.runExclusive(async () => {
        const hash = await walletClient.writeContract({
            address: PROTOCOL_ADDR, abi: PROTOCOL_ABI, functionName: "createSessionForUser",
            args: [userAddress, parseUnits(authorizedAmount.toString(), 18)]
        })
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        const sessionId = parseInt(receipt.logs[0]?.topics[1], 16)
        return { sessionId, txHash: hash }
    })
}

export async function chargeForUsage(sessionId, aiTokensUsed) {
    const fluxAmount = getConversionSync(aiTokensUsed)
    if (!isLive()) return { txHash: `0xmock${Date.now().toString(16)}`, fluxCharged: fluxAmount }

    return txLock.runExclusive(async () => {
        const hash = await walletClient.writeContract({
            address: PROTOCOL_ADDR, abi: PROTOCOL_ABI, functionName: "chargeForUsage",
            args: [BigInt(sessionId), parseUnits(aiTokensUsed.toString(), 18)]
        })
        try { await publicClient.waitForTransactionReceipt({ hash, timeout: 60000 }) } catch { }
        return { txHash: hash, fluxCharged: fluxAmount }
    })
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

    return txLock.runExclusive(async () => {
        const hash = await walletClient.writeContract({
            address: PROTOCOL_ADDR, abi: PROTOCOL_ABI, functionName: "topupSessionForUser",
            args: [BigInt(sessionId), userAddress, parseUnits(additionalAmount.toString(), 18)]
        })
        await publicClient.waitForTransactionReceipt({ hash })
        return { txHash: hash }
    })
}

export async function closeSession(sessionId) {
    if (!isLive()) return { txHash: `0xmock${Date.now().toString(16)}` }

    return txLock.runExclusive(async () => {
        const hash = await walletClient.writeContract({
            address: PROTOCOL_ADDR, abi: PROTOCOL_ABI, functionName: "closeSession",
            args: [BigInt(sessionId)]
        })
        await publicClient.waitForTransactionReceipt({ hash })
        return { txHash: hash }
    })
}

export async function ensureConversionRate() {
    if (!isLive()) return
    // Lock to prevent race conditions during startup if called multiple times
    try {
        const currentRate = await publicClient.readContract({
            address: PROTOCOL_ADDR, abi: PROTOCOL_ABI, functionName: "conversionRate"
        })

        if (currentRate !== RATE) {
            console.log(`Syncing Conversion Rate: ${currentRate} -> ${RATE}`)
            await txLock.runExclusive(async () => {
                const hash = await walletClient.writeContract({
                    address: PROTOCOL_ADDR, abi: PROTOCOL_ABI, functionName: "setConversionRate",
                    args: [RATE]
                })
                await publicClient.waitForTransactionReceipt({ hash })
                console.log("Conversion Rate Synced.")
            })
        }
    } catch (e) {
        console.error("Failed to sync conversion rate:", e)
    }
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
