import { Project } from "../models/project.model.js"
import { estimateTotalTokens } from "../utils/ai.js"
import { getConversionSync, getBackendWallet, processGaslessPayment, checkGasHealth } from "../utils/chain.js"
import crypto from "crypto"

export async function x402Middleware(req, res, next) {
    try {
        // Skip for non-chat endpoints or if explicitly handled elsewhere? 
        // We will mount this specifically on /chat route in routes file.

        const { projectId, prompt } = req.body
        if (!projectId) return res.status(400).json({ success: false, error: "projectId required" })

        const project = await Project.findOne({ projectId })
        if (!project) return res.status(404).json({ success: false, error: "Project not found" })

        // Only enforce for Paper model
        if (project.paymentModel === "paper") {
            // Check Gas Health
            const gasHealth = await checkGasHealth()

            // 1. Check for Signature in Header
            const authHeader = req.get("X-Payment-Signature")

            if (authHeader && gasHealth.healthy) {
                try {
                    const signatureData = JSON.parse(authHeader)

                    // processGaslessPayment handles the on-chain verification and interaction
                    const result = await processGaslessPayment(signatureData)

                    if (result.verified) {
                        req.paymentTxHash = result.txHash
                        return next()
                    }

                    return res.status(400).json({ success: false, error: `Payment verification failed: ${result.error}` })
                } catch (e) {
                    console.error("Auth Header parse error", e)
                    return res.status(400).json({ success: false, error: "Invalid X-Payment-Signature format" })
                }
            }

            // 2. 402 Challenge
            // Estimate cost
            const tokens = estimateTotalTokens(prompt || "")
            const cost = getConversionSync(tokens).toString()
            const nonce = "0x" + crypto.randomBytes(32).toString("hex")
            const backendWallet = getBackendWallet()

            // Construct WWW-Authenticate header
            res.set("WWW-Authenticate", `x402 token="FLUX", amount="${cost}", recipient="${backendWallet}", gasless_available="${gasHealth.healthy}"`)

            // Return 402
            return res.status(402).json({
                success: false,
                error: "Payment Required",
                gaslessAvailable: gasHealth.healthy,
                gasReason: gasHealth.healthy ? null : gasHealth.reason
            })
        }

        // Allocation model - pass to controller for session checks
        next()

    } catch (e) {
        console.error("x402 middleware error", e)
        res.status(500).json({ success: false, error: "Middleware error" })
    }
}
