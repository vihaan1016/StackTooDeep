import express from "express"
import cors from "cors"
import x402Routes from "./routes/x402.routes.js"

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }))
app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({}))
app.use(express.static("public"))

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

app.use("/api/x402", x402Routes)

app.use((req, res) => res.status(404).json({ success: false, error: "Not found" }))

app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ success: false, error: err.message || "Server error" })
})

export { app }