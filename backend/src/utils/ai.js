import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Cache for available model
let cachedModel = null;

async function getAvailableModel() {
    if (cachedModel) {
        return cachedModel;
    }

    // Try models in order of preference
    const modelsToTry = [
        'gemini-2.5-flash',
        'gemini-flash-latest',
        'gemini-2.0-flash',
        'gemini-2.5-pro',
        'gemini-pro-latest',
    ];

    for (const modelName of modelsToTry) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            // Test if model works
            const testResult = await model.generateContent('Hi');
            await testResult.response.text();

            cachedModel = modelName;
            console.log(`Using Gemini model: ${modelName}`);
            return modelName;
        } catch (err) {
            continue;
        }
    }

    throw new Error('No available Gemini models found. Check your API key.');
}

export const estimateRequestTokens = (prompt) => {
    if (!prompt) return 0;
    return Math.ceil(prompt.length / 4);
};

export const generateAIResponse = async (prompt, context = []) => {
    try {
        // Get available model
        const modelName = await getAvailableModel();
        const model = genAI.getGenerativeModel({ model: modelName });

        // Build prompt from context
        let fullPrompt = '';
        for (const msg of context) {
            if (msg.role === 'user') {
                fullPrompt += `User: ${msg.content}\n\n`;
            } else if (msg.role === 'assistant') {
                fullPrompt += `Assistant: ${msg.content}\n\n`;
            }
        }
        fullPrompt += `User: ${prompt}\n\nAssistant: `;

        // Generate content
        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [{ text: fullPrompt }]
            }],
            generationConfig: {
                maxOutputTokens: 1000,
                temperature: 0.7,
            }
        });

        const response = result.response;
        const text = response.text();

        // Get usage metadata
        const usageMetadata = response.usageMetadata || {};
        const totalTokens = usageMetadata.totalTokenCount ||
            (estimateRequestTokens(fullPrompt) + estimateRequestTokens(text));

        console.log(`Gemini response: ${totalTokens} tokens (model: ${modelName})`);

        return {
            response: text,
            tokensUsed: totalTokens
        };
    } catch (error) {
        console.error("Gemini API Error:", error.message);
        throw error;
    }
};
