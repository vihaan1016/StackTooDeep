import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

let genAI = null;

function getGenAI() {
    if (!genAI) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is missing in environment variables.");
        }
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI;
}

let cachedModel = null;

/**
 * Tries a list of Gemini models and returns the first one
 * that successfully handles a small test request.
 */
async function getAvailableModel() {
    if (cachedModel) {
        return cachedModel;
    }

    const modelsToTry = [
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-2.5-flash",
        "gemini-pro",
    ];

    for (const modelName of modelsToTry) {
        try {
            const model = getGenAI().getGenerativeModel({ model: modelName });

            const testResult = await model.generateContent("Hi");
            await testResult.response.text();

            cachedModel = modelName;
            console.log(`Using Gemini model: ${modelName}`);
            return modelName;
        } catch (err) {
            continue;
        }
    }

    throw new Error("No available Gemini models found. Check your API key or quota.");
}

/**
 * Roughly estimates input tokens for a prompt.
 */
export const estimateRequestTokens = (prompt) => {
    if (!prompt) return 0;
    return Math.ceil(prompt.length / 4);
};

/**
 * Estimates TOTAL tokens (input + expected output).
 * Actual token usage may differ significantly.
 */
export const estimateTotalTokens = (prompt) => {
    const inputTokens = estimateRequestTokens(prompt);
    const estimatedOutputTokens = Math.max(500, Math.ceil(inputTokens * 2));
    return inputTokens + estimatedOutputTokens;
};

export const generateAIResponse = async (prompt, context = []) => {
    try {
        const modelName = await getAvailableModel();
        const model = getGenAI().getGenerativeModel({ model: modelName });

        let fullPrompt = "";

        for (const msg of context) {
            if (msg.role === "user") {
                fullPrompt += `User: ${msg.content}\n\n`;
            } else if (msg.role === "assistant") {
                fullPrompt += `Assistant: ${msg.content}\n\n`;
            }
        }

        fullPrompt += `User: ${prompt}\n\nAssistant:`;

        /**
         * Generate content.
         */
        const result = await model.generateContent({
            contents: [
                {
                    role: "user",
                    parts: [{ text: fullPrompt }],
                },
            ],
            generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.7,
            },
        });

        const response = result.response;
        const text = response.text();

        const usageMetadata = response.usageMetadata || {};
        const totalTokens =
            usageMetadata.totalTokenCount ||
            estimateRequestTokens(fullPrompt) +
                estimateRequestTokens(text);

        console.log(
            `Gemini response: ${totalTokens} tokens (model: ${modelName})`
        );

        return {
            response: text,
            tokensUsed: totalTokens,
        };
    } catch (error) {
        console.error("Gemini API Error:", error.message);
        throw error;
    }
};
