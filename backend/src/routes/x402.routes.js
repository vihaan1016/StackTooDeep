import { Router } from "express"
import * as ctrl from "../controllers/x402.controller.js"

const router = Router()

router.post("/chat", ctrl.chat)
router.post("/projects", ctrl.createProject)
router.get("/projects/:id", ctrl.getProject)
router.get("/projects/:id/messages", ctrl.getMessages)
router.post("/sessions", ctrl.createSession)
router.get("/sessions/:sessionId", ctrl.getSession)
router.post("/sessions/:sessionId/topup", ctrl.topupSession)
router.post("/sessions/:sessionId/close", ctrl.closeSessionEndpoint)

export default router
