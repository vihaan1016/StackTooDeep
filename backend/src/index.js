import dotenv from "dotenv"
import connectDB from "./db/connectDB.js"
import { app } from "./app.js"
import { ensureConversionRate } from "./utils/chain.js"

dotenv.config()

const PORT = process.env.PORT || 3000

connectDB()
  .then(async () => {
    await ensureConversionRate()
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err)
    process.exit(1)
  })