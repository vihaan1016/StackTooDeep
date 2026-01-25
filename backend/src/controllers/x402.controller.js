import { Project } from "../models/project.model.js"
import { Message } from "../models/message.model.js"
import { estimateRequestTokens, generateAIResponse, estimateTotalTokens } from "../utils/ai.js"
import { formatUnits } from "viem"
import {
    verifyPaymentTx, burnFlux, refundFlux, getBackendWallet, createSessionForUser,
    chargeForUsage, getSessionInfo, topupSessionForUser, closeSession, getConversionSync
} from "../utils/chain.js"

function error(res, status, msg) {
    return res.status(status).json({ success: false, error: msg })
}

export async function chat(req, res) {
    try {
        const { projectId, prompt, paymentTxHash } = req.body
        if (projectId === undefined) return error(res, 400, "projectId required")
        if (!prompt?.trim()) return error(res, 400, "prompt required")

        const project = await Project.findOne({ projectId })
        if (!project) return error(res, 404, "Project not found")

        // Paper model pays for estimated TOTAL usage (Input + Buffer).
        // Allocation model pays for ACTUAL usage.
        const estimatedTokens = estimateTotalTokens(prompt)
        const fluxRequired = getConversionSync(estimatedTokens)
        let txHash

        if (project.paymentModel === "paper") {
            if (!paymentTxHash) {
                return res.status(402).json({
                    success: false, error: "Payment Required",
                    payment: {
                        fluxRequired: fluxRequired.toString(),
                        estimatedTokens,
                        recipient: getBackendWallet(),
                        method: "transfer"
                    }
                })
            }
            const v = await verifyPaymentTx(paymentTxHash, fluxRequired)
            if (!v.verified) return error(res, 400, "Payment verification failed")

        } else {
            if (!project.sessionId) return error(res, 400, "No session. Create one first.")
            const session = await getSessionInfo(project.sessionId)
            if (!session.isActive) return error(res, 400, "Session inactive")
            if (session.remainingAITokens < BigInt(estimatedTokens)) {
                const deficit = BigInt(estimatedTokens) - session.remainingAITokens
                const fluxRequiredWei = getConversionSync(deficit)

                return res.status(402).json({
                    success: false, error: "Insufficient balance",
                    payment: {
                        fluxRequired: formatUnits(fluxRequiredWei, 18),
                        estimatedTokens,
                        recipient: null,
                        method: "topup",
                        sessionId: project.sessionId
                    }
                })
            }
        }

        const prev = await Message.find({ projectId }).sort({ createdAt: 1 }).limit(20)
        const context = prev.map(m => ({ role: m.role, content: m.content }))
        const aiResult = await generateAIResponse(prompt, context)

        if (project.paymentModel === "allocation") {
            txHash = (await chargeForUsage(project.sessionId, aiResult.tokensUsed)).txHash
        } else if (project.paymentModel === "paper") {
            // Calculate actual cost
            const actualFlux = getConversionSync(aiResult.tokensUsed)

            // Burn actual cost
            const burnRes = await burnFlux(actualFlux)
            txHash = burnRes.txHash

            // Refund difference
            if (fluxRequired > actualFlux) {
                const refundAmount = fluxRequired - actualFlux
                console.log(`Refund needed: ${refundAmount} (Paid: ${fluxRequired}, Used: ${actualFlux})`)
                await refundFlux(project.ownerAddress, refundAmount)
            }
        }

        await Message.create({ projectId, role: "user", content: prompt, tokensUsed: estimatedTokens, burnTxHash: txHash })
        await Message.create({ projectId, role: "assistant", content: aiResult.response, tokensUsed: aiResult.tokensUsed, burnTxHash: txHash })

        return res.json({ success: true, data: { response: aiResult.response, tokensUsed: aiResult.tokensUsed, txHash } })
    } catch (err) {
        console.error("chat error:", err)
        return error(res, 500, err.message)
    }
}

export async function getUserProjects(req, res) {
    try {
        const { owner } = req.query
        if (!owner) return error(res, 400, "Owner address required")

        const projects = await Project.find({ ownerAddress: owner.toLowerCase() }).sort({ createdAt: -1 })

        // Hydrate with session info if needed
        const hydrated = await Promise.all(projects.map(async (p) => {
            let session = null
            if (p.paymentModel === "allocation" && p.sessionId) {
                const s = await getSessionInfo(p.sessionId)
                session = {
                    ...s,
                    authorizedAmount: formatUnits(s.authorizedAmount, 18),
                    usedAmount: formatUnits(s.usedAmount, 18),
                    remainingAmount: formatUnits(s.remainingAmount, 18),
                    remainingAITokens: formatUnits(s.remainingAITokens, 18)
                }
            }
            return { ...p.toObject(), session }
        }))

        return res.json({ success: true, data: hydrated })
    } catch (err) {
        return error(res, 500, err.message)
    }
}

export async function deleteProject(req, res) {
    try {
        const projectId = parseInt(req.params.id, 10)
        if (isNaN(projectId)) return error(res, 400, "Invalid ID")

        const project = await Project.findOne({ projectId })
        if (!project) return error(res, 404, "Not found")

        await Project.deleteOne({ projectId })
        await Message.deleteMany({ projectId })

        return res.json({ success: true, message: "Project deleted" })
    } catch (err) {
        return error(res, 500, err.message)
    }
}

export async function createProject(req, res) {
    try {
        const { projectId, ownerAddress, name, description, paymentModel } = req.body
        if (!projectId || !ownerAddress || !name) return error(res, 400, "projectId, ownerAddress, name required")

        const model = paymentModel || "paper"
        if (!["paper", "allocation"].includes(model)) return error(res, 400, "Invalid paymentModel")
        if (await Project.findOne({ projectId })) return error(res, 400, "Project exists")

        const project = await Project.create({ projectId, ownerAddress: ownerAddress.toLowerCase(), name, description: description || "", paymentModel: model })
        return res.status(201).json({ success: true, data: project })
    } catch (err) {
        return error(res, 500, err.message)
    }
}

export async function getProject(req, res) {
    try {
        const projectId = parseInt(req.params.id, 10)
        if (isNaN(projectId)) return error(res, 400, "Invalid ID")

        const project = await Project.findOne({ projectId })
        if (!project) return error(res, 404, "Not found")

        let session = null
        if (project.paymentModel === "allocation" && project.sessionId) {
            const s = await getSessionInfo(project.sessionId)
            session = {
                ...s,
                authorizedAmount: formatUnits(s.authorizedAmount, 18),
                usedAmount: formatUnits(s.usedAmount, 18),
                remainingAmount: formatUnits(s.remainingAmount, 18),
                remainingAITokens: formatUnits(s.remainingAITokens, 18)
            }
        }
        return res.json({ success: true, data: { ...project.toObject(), session } })
    } catch (err) {
        return error(res, 500, err.message)
    }
}

export async function getMessages(req, res) {
    try {
        const projectId = parseInt(req.params.id, 10)
        if (isNaN(projectId)) return error(res, 400, "Invalid ID")
        const messages = await Message.find({ projectId }).sort({ createdAt: 1 })
        return res.json({ success: true, data: messages })
    } catch (err) {
        return error(res, 500, err.message)
    }
}

export async function createSession(req, res) {
    try {
        const { projectId, authorizedAmount } = req.body
        if (!projectId || !authorizedAmount) return error(res, 400, "projectId and authorizedAmount required")

        const project = await Project.findOne({ projectId })
        if (!project) return error(res, 404, "Project not found")
        if (project.paymentModel !== "allocation") return error(res, 400, "Not an allocation project")
        if (project.sessionId) return error(res, 400, "Session exists")

        const result = await createSessionForUser(project.ownerAddress, BigInt(authorizedAmount))
        project.sessionId = result.sessionId
        await project.save()

        return res.status(201).json({ success: true, data: result })
    } catch (err) {
        return error(res, 500, err.message)
    }
}

export async function getSession(req, res) {
    try {
        const sessionId = parseInt(req.params.sessionId, 10)
        if (isNaN(sessionId)) return error(res, 400, "Invalid ID")

        const s = await getSessionInfo(sessionId)
        return res.json({
            success: true, data: {
                sessionId, user: s.user, isActive: s.isActive,
                authorizedAmount: formatUnits(s.authorizedAmount, 18),
                usedAmount: formatUnits(s.usedAmount, 18),
                remainingAmount: formatUnits(s.remainingAmount, 18),
                remainingAITokens: formatUnits(s.remainingAITokens, 18)
            }
        })
    } catch (err) {
        return error(res, 500, err.message)
    }
}

export async function topupSession(req, res) {
    try {
        const sessionId = parseInt(req.params.sessionId, 10)
        const { additionalAmount } = req.body
        if (isNaN(sessionId)) return error(res, 400, "Invalid ID")
        if (!additionalAmount) return error(res, 400, "additionalAmount required")

        const project = await Project.findOne({ sessionId })
        if (!project) return error(res, 404, "Session not found")

        const result = await topupSessionForUser(sessionId, project.ownerAddress, BigInt(additionalAmount))
        return res.json({ success: true, data: { sessionId, txHash: result.txHash } })
    } catch (err) {
        return error(res, 500, err.message)
    }
}

export async function closeSessionEndpoint(req, res) {
    try {
        const sessionId = parseInt(req.params.sessionId, 10)
        if (isNaN(sessionId)) return error(res, 400, "Invalid ID")

        const project = await Project.findOne({ sessionId })
        if (!project) return error(res, 404, "Session not found")

        const result = await closeSession(sessionId)
        project.sessionId = null
        await project.save()

        return res.json({ success: true, data: { sessionId, txHash: result.txHash } })
    } catch (err) {
        return error(res, 500, err.message)
    }
}
