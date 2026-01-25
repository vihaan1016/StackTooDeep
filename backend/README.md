# Flux Compute Backend

Backend server for Flux Compute - a blockchain-powered AI payment system using the x402 protocol.

---

## Table of Contents

- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [File Roles](#file-roles)
- [Payment Flows](#payment-flows)
- [API Endpoints](#api-endpoints)
- [Running the Server](#running-the-server)

---

## Architecture

```mermaid
graph TB
    subgraph "Entry Point"
        INDEX[index.js<br/>Server Bootstrap]
    end
    
    subgraph "Application Layer"
        APP[app.js<br/>Express Setup]
        ROUTES[x402.routes.js<br/>Route Definitions]
        CTRL[x402.controller.js<br/>Business Logic]
    end
    
    subgraph "Data Layer"
        DB[connectDB.js<br/>MongoDB Connection]
        PROJ[project.model.js<br/>Project Schema]
        MSG[message.model.js<br/>Message Schema]
    end
    
    subgraph "Utility Layer"
        CHAIN[chain.js<br/>Blockchain Ops]
        AI[ai.js<br/>Gemini Integration]
        API_ERR[apiError.js]
        API_RES[apiResponse.js]
        ASYNC[asyncHandler.js]
    end
    
    INDEX --> APP
    INDEX --> DB
    INDEX --> CHAIN
    APP --> ROUTES
    ROUTES --> CTRL
    CTRL --> PROJ
    CTRL --> MSG
    CTRL --> CHAIN
    CTRL --> AI
```

---

## Directory Structure

```
backend/
├── src/
│   ├── index.js              # Application entry point
│   ├── app.js                # Express app configuration
│   ├── constants.js          # Database name constant
│   │
│   ├── controllers/
│   │   └── x402.controller.js    # Main business logic
│   │
│   ├── routes/
│   │   └── x402.routes.js        # API route definitions
│   │
│   ├── models/
│   │   ├── project.model.js      # Project schema
│   │   └── message.model.js      # Message schema
│   │
│   ├── db/
│   │   └── connectDB.js          # MongoDB connection
│   │
│   └── utils/
│       ├── chain.js              # Blockchain interactions
│       ├── ai.js                 # Gemini AI integration
│       ├── apiError.js           # Error class
│       ├── apiResponse.js        # Response class
│       └── asyncHandler.js       # Async error wrapper
│
├── package.json
└── public/                   # Static files
```

---

## File Roles

### Core Files

| File | Role | Dependencies |
|------|------|--------------|
| `index.js` | Bootstrap server, connect DB, ensure conversion rate | `app.js`, `connectDB.js`, `chain.js` |
| `app.js` | Express middleware, route mounting, error handling | `x402.routes.js` |

### Controllers

| File | Role | Key Functions |
|------|------|---------------|
| `x402.controller.js` | All business logic | `chat()`, `createProject()`, `createSession()`, `topupSession()`, `closeSessionEndpoint()` |

### Models

| File | Schema | Key Fields |
|------|--------|------------|
| `project.model.js` | Project | `projectId`, `ownerAddress`, `paymentModel`, `sessionId`, `name` |
| `message.model.js` | Message | `projectId`, `role`, `content`, `tokensUsed`, `burnTxHash` |

### Utilities

| File | Role | Exports |
|------|------|---------|
| `chain.js` | All blockchain operations | `burnFlux()`, `refundFlux()`, `createSessionForUser()`, `chargeForUsage()`, `getSessionInfo()` |
| `ai.js` | Gemini AI integration | `generateAIResponse()`, `estimateRequestTokens()`, `estimateTotalTokens()` |

---

## File Interactions

```mermaid
flowchart LR
    subgraph Request Flow
        REQ[HTTP Request] --> ROUTES
        ROUTES --> CTRL
    end
    
    subgraph Controller Actions
        CTRL --> |Query/Save| MODELS[(Models)]
        CTRL --> |Token Estimate| AI_UTIL[ai.js]
        CTRL --> |Blockchain| CHAIN_UTIL[chain.js]
    end
    
    subgraph External Services
        AI_UTIL --> GEMINI{{Gemini API}}
        CHAIN_UTIL --> ETH{{Ethereum}}
    end
```

---

## Payment Flows

### Flow 1: Pay-Per-Use ("Paper" Model)

```mermaid
sequenceDiagram
    participant C as Client
    participant CTRL as Controller
    participant AI as ai.js
    participant CHAIN as chain.js
    participant BC as Blockchain

    C->>CTRL: POST /chat (projectId, prompt)
    CTRL->>AI: estimateTotalTokens(prompt)
    AI-->>CTRL: estimated tokens
    CTRL->>CHAIN: getConversionSync(tokens)
    CHAIN-->>CTRL: fluxRequired
    CTRL-->>C: 402 {fluxRequired, recipient}
    
    Note over C: User sends FLUX to backend wallet
    
    C->>CTRL: POST /chat (projectId, prompt, txHash)
    CTRL->>CHAIN: verifyPaymentTx(txHash)
    CHAIN->>BC: getTransactionReceipt
    BC-->>CHAIN: receipt
    CHAIN-->>CTRL: {verified: true}
    
    CTRL->>AI: generateAIResponse(prompt)
    AI-->>CTRL: {response, tokensUsed}
    
    CTRL->>CHAIN: burnFlux(actualCost)
    CHAIN->>BC: writeContract(burn)
    BC-->>CHAIN: txHash
    
    alt Overpayment
        CTRL->>CHAIN: refundFlux(user, excess)
        CHAIN->>BC: writeContract(transfer)
    end
    
    CTRL-->>C: {response, txHash}
```

**Key Points:**
- Initial request returns 402 with cost estimate
- User transfers FLUX to backend wallet
- Backend verifies transfer on-chain
- Actual usage is burned, excess is refunded

---

### Flow 2: Create Project (Allocation Model)

```mermaid
sequenceDiagram
    participant C as Client
    participant CTRL as Controller
    participant CHAIN as chain.js
    participant BC as Blockchain
    participant AI as ai.js

    Note over C,BC: Phase 1: Project & Session Setup
    
    C->>CTRL: POST /projects
    CTRL-->>C: {projectId, paymentModel: "allocation"}
    
    C->>BC: approve(escrow, amount)
    BC-->>C: approval tx
    
    C->>CTRL: POST /sessions
    CTRL->>CHAIN: createSessionForUser(user, amount)
    CHAIN->>BC: writeContract
    BC-->>CHAIN: sessionId
    CTRL-->>C: {sessionId}
    
    Note over C,BC: Phase 2: Chat with Session
    
    C->>CTRL: POST /chat (projectId, prompt)
    CTRL->>CHAIN: getSessionInfo(sessionId)
    CHAIN->>BC: readContract
    BC-->>CHAIN: session data
    
    alt Insufficient Balance
        CTRL-->>C: 402 {method: "topup", sessionId}
        C->>CTRL: POST /sessions/:id/topup
        CTRL->>CHAIN: topupSessionForUser
    end
    
    CTRL->>AI: generateAIResponse(prompt)
    AI-->>CTRL: {response, tokensUsed}
    
    CTRL->>CHAIN: chargeForUsage(sessionId, tokens)
    CHAIN->>BC: writeContract(chargeForUsage)
    note over BC: transferFrom + burn
    
    CTRL-->>C: {response, txHash}
    
    Note over C,BC: Phase 3: Close Session
    
    C->>CTRL: POST /sessions/:id/close
    CTRL->>CHAIN: closeSession(sessionId)
    CHAIN->>BC: writeContract
    CTRL-->>C: {closed: true}
```

**Key Points:**
- User creates project with `allocation` payment model
- User approves FLUX and creates session on-chain
- Each chat deducts from session (no per-request payment)
- Top-up if balance insufficient
- Close session when done

---

## Controller Functions

### chat()
The main endpoint handling both payment models:

```javascript
// Paper Model Flow
if (project.paymentModel === "paper") {
    if (!paymentTxHash) → 402 Payment Required
    verify payment → generate AI → burn actual → refund excess
}

// Allocation Model Flow  
if (project.paymentModel === "allocation") {
    check session balance → if insufficient → 402 topup required
    generate AI → chargeForUsage(sessionId, tokens)
}
```

### Session Functions

| Function | Description |
|----------|-------------|
| `createSession()` | Initialize session on-chain |
| `getSession()` | Retrieve session balance/status |
| `topupSession()` | Add more FLUX to session |
| `closeSessionEndpoint()` | Deactivate session |

---

## API Endpoints

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/x402/projects` | Create new project |
| `GET` | `/api/x402/projects` | List user's projects |
| `GET` | `/api/x402/projects/:id` | Get project details |
| `DELETE` | `/api/x402/projects/:id` | Delete project |
| `GET` | `/api/x402/projects/:id/messages` | Get chat history |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/x402/chat` | Send prompt (handles payment) |

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/x402/sessions` | Create session |
| `GET` | `/api/x402/sessions/:id` | Get session info |
| `POST` | `/api/x402/sessions/:id/topup` | Top-up session |
| `POST` | `/api/x402/sessions/:id/close` | Close session |

---

## Chain Utility Functions

```mermaid
graph TD
    subgraph "Read Operations"
        A[verifyPaymentTx] --> BC[Blockchain]
        B[getSessionInfo] --> BC
        C[getConversion] --> BC
    end
    
    subgraph "Write Operations"
        D[burnFlux] --> BC
        E[refundFlux] --> BC
        F[createSessionForUser] --> BC
        G[chargeForUsage] --> BC
        H[topupSessionForUser] --> BC
        I[closeSession] --> BC
    end
    
    subgraph "Sync Utilities"
        J[getConversionSync] --> |local calc| K[Return]
        L[getBackendWallet] --> |env var| K
    end
```

### Transaction Mutex
All write operations use a mutex lock to serialize transactions and prevent nonce conflicts:

```javascript
const txLock = new Mutex();

// All blockchain writes wrapped in:
return txLock.runExclusive(async () => {
    // transaction logic
});
```

---

## Running the Server

```bash
# Development
npm run dev

# Production
npm start
```

Server starts on configured PORT (default: 3000).

### Startup Sequence

1. Load environment variables
2. Connect to MongoDB
3. Sync conversion rate with smart contract
4. Start Express server

---

## Error Handling

All errors return JSON:

```json
{
    "success": false,
    "error": "Error message"
}
```

Common status codes:
- `400` - Bad request / validation error
- `402` - Payment required
- `404` - Resource not found
- `500` - Server error
