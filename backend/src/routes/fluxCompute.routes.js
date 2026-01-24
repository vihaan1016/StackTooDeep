import { Router } from "express"
import * as ctrl from "../controllers/x402.controller.js"

const router = Router()

// X402 routes
router.post("/chat", ctrl.chat)
router.get("/projects", ctrl.getUserProjects)
router.post("/projects", ctrl.createProject)
router.get("/projects/:id", ctrl.getProject)
router.delete("/projects/:id", ctrl.deleteProject)
router.get("/projects/:id/messages", ctrl.getMessages)

// Session routes
router.post("/sessions", ctrl.createSession)
router.get("/sessions/:sessionId", ctrl.getSession)
router.post("/sessions/:sessionId/topup", ctrl.topupSession)
router.post("/sessions/:sessionId/close", ctrl.closeSessionEndpoint)

export default router
