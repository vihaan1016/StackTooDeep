import mongoose from "mongoose"

const gasSpendSchema = new mongoose.Schema({
    date: {
        type: String, // Format: YYYY-MM-DD
        required: true,
        index: true
    },
    amountWei: {
        type: String, // Storing large numbers as string to avoid precision loss
        required: true
    },
    txHash: {
        type: String,
        required: true
    }
}, { timestamps: true })

export const GasSpend = mongoose.model("GasSpend", gasSpendSchema)
