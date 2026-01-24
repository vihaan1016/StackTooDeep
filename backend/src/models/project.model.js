import mongoose from "mongoose"

const projectSchema = new mongoose.Schema({
    projectId: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    ownerAddress: {
        type: String,
        required: true,
        lowercase: true
    },
    paymentModel: {
        type: String,
        enum: ["paper", "allocation"],
        required: true,
        default: "paper"
    },
    // Only for allocation model - on-chain session ID
    sessionId: {
        type: Number,
        default: null
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ""
    }
}, { timestamps: true })

export const Project = mongoose.model("Project", projectSchema)
