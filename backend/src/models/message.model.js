import mongoose from "mongoose"

const messageSchema = new mongoose.Schema({
    projectId: {
        type: Number,
        required: true,
        index: true
    },
    role: {
        type: String,
        enum: ["user", "assistant"],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    tokensUsed: {
        type: Number,
        default: 0
    },
    burnTxHash: {
        type: String,
        default: null
    }
}, { timestamps: true })

// Index for fetching chat history
messageSchema.index({ projectId: 1, createdAt: 1 })

export const Message = mongoose.model("Message", messageSchema)
