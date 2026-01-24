// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {FluxToken} from "./Flux.sol";

/**
 * @title AIPaymentProtocol
 * @notice Direct payment protocol for AI services with x402 integration
 * @dev Supports both standard ERC20 and EIP-3009 gasless transactions
 */
contract AIPaymentProtocol {
    struct UserSession {
        address user;
        uint256 authorizedAmount;      // FLUX tokens authorized
        uint256 usedAmount;             // FLUX tokens already used
        bool isActive;
        uint256 createdAt;
        uint256 lastUsedAt;
    }
    
    mapping(uint256 => UserSession) public sessions;
    uint256 public nextSessionId;
    uint256 public conversionRate = 5; // 1 FLUX = 5 AI tokens
    
    FluxToken public fluxToken;
    address public x402Protocol;      // x402 protocol address
    address public backendWallet;     // Backend for admin functions

    // Events
    event SessionCreated(uint256 indexed sessionId, address indexed user, uint256 authorizedAmount);
    event TokensCharged(uint256 indexed sessionId, address indexed user, uint256 fluxAmount, uint256 aiTokensUsed);
    event TokensBurned(uint256 indexed sessionId, uint256 amount);
    event SessionClosed(uint256 indexed sessionId, uint256 unusedAmount);
    event X402ProtocolUpdated(address indexed newProtocol);
    event ConversionRateUpdated(uint256 newRate);
    event SessionToppedUp(uint256 indexed sessionId, address indexed user, uint256 additionalAmount);

    modifier onlyX402() {
        require(msg.sender == x402Protocol, "Only x402 protocol");
        _;
    }

    modifier onlyBackend() {
        require(msg.sender == backendWallet, "Only backend");
        _;
    }

    constructor(
        address _fluxTokenAddress, 
        address _x402Protocol,
        address _backendWallet
    ) {
        require(_fluxTokenAddress != address(0), "Invalid token address");
        require(_x402Protocol != address(0), "Invalid x402 address");
        require(_backendWallet != address(0), "Invalid backend address");
        
        fluxToken = FluxToken(_fluxTokenAddress);
        x402Protocol = _x402Protocol;
        backendWallet = _backendWallet;
    }

    /**
     * @notice User creates a session and authorizes FLUX tokens (standard method)
     * @dev User must approve this contract first via fluxToken.approve()
     * @param authorizedAmount Amount of FLUX tokens to authorize for this session
     * @return sessionId The created session ID
     */
    function createSession(uint256 authorizedAmount) external returns (uint256) {
        require(authorizedAmount > 0, "Amount must be > 0");
        
        // Check user has approved enough tokens
        uint256 allowance = fluxToken.allowance(msg.sender, address(this));
        require(allowance >= authorizedAmount, "Insufficient allowance");

        // Verify user has enough balance
        uint256 balance = fluxToken.balanceOf(msg.sender);
        require(balance >= authorizedAmount, "Insufficient balance");

        uint256 sessionId = nextSessionId++;

        sessions[sessionId] = UserSession({
            user: msg.sender,
            authorizedAmount: authorizedAmount,
            usedAmount: 0,
            isActive: true,
            createdAt: block.timestamp,
            lastUsedAt: block.timestamp
        });

        emit SessionCreated(sessionId, msg.sender, authorizedAmount);
        return sessionId;
    }

    /**
     * @notice Create session for a user (backend/relayer can call)
     * @dev Backend creates session on behalf of user after off-chain verification
     * @param user The user creating the session
     * @param authorizedAmount Amount of FLUX tokens to authorize
     * @return sessionId The created session ID
     */
    function createSessionForUser(
        address user,
        uint256 authorizedAmount
    ) external onlyBackend returns (uint256) {
        require(user != address(0), "Invalid user address");
        require(authorizedAmount > 0, "Amount must be > 0");
        
        // Verify user has enough balance
        uint256 balance = fluxToken.balanceOf(user);
        require(balance >= authorizedAmount, "Insufficient balance");
        
        uint256 sessionId = nextSessionId++;

        sessions[sessionId] = UserSession({
            user: user,
            authorizedAmount: authorizedAmount,
            usedAmount: 0,
            isActive: true,
            createdAt: block.timestamp,
            lastUsedAt: block.timestamp
        });

        emit SessionCreated(sessionId, user, authorizedAmount);
        return sessionId;
    }

    /**
     * @notice x402 charges user for AI token usage (standard method)
     * @dev Pulls FLUX from user's wallet using transferFrom, then burns
     * @param sessionId The session to charge
     * @param aiTokensUsed Number of AI tokens consumed
     * @return success Whether the charge succeeded
     */
    function chargeForUsage(uint256 sessionId, uint256 aiTokensUsed) 
        external 
        onlyX402 
        returns (bool) 
    {
        UserSession storage session = sessions[sessionId];
        
        require(session.isActive, "Session not active");
        require(aiTokensUsed > 0, "Usage must be > 0");

        // Convert AI tokens to FLUX amount using getConversion
        uint256 fluxAmount = getConversion(aiTokensUsed);
        require(fluxAmount > 0, "Flux amount must be > 0");

        // Check if user has enough authorized amount remaining
        uint256 remainingAuthorized = session.authorizedAmount - session.usedAmount;
        require(fluxAmount <= remainingAuthorized, "Insufficient authorized amount");

        // Transfer FLUX from user to this contract
        bool transferSuccess = fluxToken.transferFrom(session.user, address(this), fluxAmount);
        require(transferSuccess, "Token transfer failed");

        // Burn the tokens
        fluxToken.burn(fluxAmount);

        // Update session
        session.usedAmount += fluxAmount;
        session.lastUsedAt = block.timestamp;

        emit TokensCharged(sessionId, session.user, fluxAmount, aiTokensUsed);
        emit TokensBurned(sessionId, fluxAmount);

        return true;
    }

    /**
     * @notice x402 charges user using EIP-3009 gasless transaction
     * @dev Uses receiveWithAuthorization for gasless payment and burning
     * @param sessionId The session to charge
     * @param aiTokensUsed Number of AI tokens consumed
     * @param validAfter Timestamp after which the authorization is valid
     * @param validBefore Timestamp before which the authorization is valid
     * @param nonce Unique nonce for the authorization
     * @param v,r,s Signature components from user
     * @return success Whether the charge succeeded
     */
    function chargeForUsageWithAuthorization(
        uint256 sessionId,
        uint256 aiTokensUsed,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) 
        external 
        onlyX402 
        returns (bool) 
    {
        UserSession storage session = sessions[sessionId];
        
        require(session.isActive, "Session not active");
        require(aiTokensUsed > 0, "Usage must be > 0");

        // Convert AI tokens to FLUX amount using getConversion
        uint256 fluxAmount = getConversion(aiTokensUsed);
        require(fluxAmount > 0, "Flux amount must be > 0");

        // Check if user has enough authorized amount remaining
        uint256 remainingAuthorized = session.authorizedAmount - session.usedAmount;
        require(fluxAmount <= remainingAuthorized, "Insufficient authorized amount");

        // Use EIP-3009 to receive tokens from user (gasless for user)
        fluxToken.receiveWithAuthorization(
            session.user,      // from
            address(this),     // to (this contract)
            fluxAmount,        // value
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );

        // Burn the tokens
        fluxToken.burn(fluxAmount);

        // Update session
        session.usedAmount += fluxAmount;
        session.lastUsedAt = block.timestamp;

        emit TokensCharged(sessionId, session.user, fluxAmount, aiTokensUsed);
        emit TokensBurned(sessionId, fluxAmount);

        return true;
    }

    /**
     * @notice Close a session (user or backend can call)
     * @param sessionId The session to close
     */
    function closeSession(uint256 sessionId) external {
        UserSession storage session = sessions[sessionId];
        
        require(
            msg.sender == session.user || msg.sender == backendWallet || msg.sender == x402Protocol,
            "Not authorized"
        );
        require(session.isActive, "Session already closed");

        uint256 unusedAmount = session.authorizedAmount - session.usedAmount;
        session.isActive = false;

        emit SessionClosed(sessionId, unusedAmount);
    }

    /**
     * @notice Get session details
     * @param sessionId The session to query
     * @return user Session owner
     * @return authorizedAmount Total authorized FLUX
     * @return usedAmount FLUX already used
     * @return remainingAmount FLUX remaining
     * @return remainingAITokens AI tokens remaining
     * @return isActive Session status
     */
    function getSessionInfo(uint256 sessionId) 
        external 
        view 
        returns (
            address user,
            uint256 authorizedAmount,
            uint256 usedAmount,
            uint256 remainingAmount,
            uint256 remainingAITokens,
            bool isActive
        ) 
    {
        UserSession storage session = sessions[sessionId];
        
        uint256 remaining = session.isActive ? 
            session.authorizedAmount - session.usedAmount : 0;
        uint256 aiTokensRemaining = remaining * conversionRate;

        return (
            session.user,
            session.authorizedAmount,
            session.usedAmount,
            remaining,
            aiTokensRemaining,
            session.isActive
        );
    }

    /**
     * @notice Convert AI tokens to FLUX amount
     * @param aiTokens Number of AI tokens
     * @return fluxAmount Equivalent FLUX tokens (rounded up)
     */
    function getFluxFromAITokens(uint256 aiTokens) public view returns (uint256) {
        // Round up to ensure we charge enough
        return (aiTokens + conversionRate - 1) / conversionRate;
    }

    /**
     * @notice Get conversion from AI tokens used to FLUX tokens required
     * @dev Used by x402 to calculate FLUX tokens needed based on AI tokens consumed
     * @param aiTokensUsed Number of AI tokens used
     * @return fluxAmount Equivalent FLUX tokens required (rounded up)
     */
    function getConversion(uint256 aiTokensUsed) public view returns (uint256) {
        // Round up to ensure we charge enough
        return (aiTokensUsed + conversionRate - 1) / conversionRate;
    }

    /**
     * @notice Convert FLUX to AI tokens
     * @param fluxAmount Number of FLUX tokens
     * @return aiTokens Equivalent AI tokens
     */
    function getAITokensFromFlux(uint256 fluxAmount) public view returns (uint256) {
        return fluxAmount * conversionRate;
    }

    /**
     * @notice Check how much a user has authorized for a session
     * @param sessionId The session to check
     * @return remainingFlux Remaining FLUX tokens
     * @return remainingAITokens Remaining AI tokens
     */
    function getRemainingBalance(uint256 sessionId) 
        external 
        view 
        returns (uint256 remainingFlux, uint256 remainingAITokens) 
    {
        UserSession storage session = sessions[sessionId];
        
        if (!session.isActive) {
            return (0, 0);
        }

        remainingFlux = session.authorizedAmount - session.usedAmount;
        remainingAITokens = remainingFlux * conversionRate;
    }

    /**
     * @notice Check user's FLUX balance
     * @param user Address to check
     * @return balance User's FLUX token balance
     */
    function getUserBalance(address user) external view returns (uint256) {
        return fluxToken.balanceOf(user);
    }

    /**
     * @notice Check user's allowance to this contract
     * @param user Address to check
     * @return allowanceAmount Approved amount
     */
    function getUserAllowance(address user) external view returns (uint256) {
        return fluxToken.allowance(user, address(this));
    }

    // ==================== Admin Functions ====================

    /**
     * @notice Update x402 protocol address
     * @param newX402Protocol New x402 address
     */
    function setX402Protocol(address newX402Protocol) external onlyBackend {
        require(newX402Protocol != address(0), "Invalid address");
        x402Protocol = newX402Protocol;
        emit X402ProtocolUpdated(newX402Protocol);
    }

    /**
     * @notice Update conversion rate
     * @param newRate New conversion rate (1 FLUX = newRate AI tokens)
     */
    function setConversionRate(uint256 newRate) external onlyBackend {
        require(newRate > 0, "Rate must be > 0");
        conversionRate = newRate;
        emit ConversionRateUpdated(newRate);
    }

    /**
     * @notice Emergency function to recover any tokens sent to contract by mistake
     * @dev Only backend can call this
     * @param token Token address to recover
     * @param amount Amount to recover
     */
    function recoverTokens(address token, uint256 amount) external onlyBackend {
        require(token != address(0), "Invalid token");
        FluxToken(token).transfer(backendWallet, amount);
    }
    /**
 * @notice Top up an existing session with more FLUX tokens
 * @dev User must approve additional tokens first
 * @param sessionId The session to top up
 * @param additionalAmount Additional FLUX tokens to authorize
 * @return success Whether the top-up succeeded
 */
function topupSession(uint256 sessionId, uint256 additionalAmount) 
    external 
    returns (bool) 
{
    UserSession storage session = sessions[sessionId];
    
    require(session.isActive, "Session not active");
    require(msg.sender == session.user, "Only session owner can top up");
    require(additionalAmount > 0, "Amount must be > 0");
    
    // Check user has approved enough tokens
    uint256 allowance = fluxToken.allowance(msg.sender, address(this));
    require(allowance >= additionalAmount, "Insufficient allowance");

    // Verify user has enough balance
    uint256 balance = fluxToken.balanceOf(msg.sender);
    require(balance >= additionalAmount, "Insufficient balance");

    // Update session authorized amount
    session.authorizedAmount += additionalAmount;
    session.lastUsedAt = block.timestamp;

    emit SessionToppedUp(sessionId, msg.sender, additionalAmount);
    return true;
}

    /**
    * @notice Top up session for a user (backend/relayer can call)
    * @dev Backend tops up session on behalf of user after off-chain verification
    * @param sessionId The session to top up
    * @param additionalAmount Additional FLUX tokens to authorize
    * @return success Whether the top-up succeeded
    */
    function topupSessionForUser(
        uint256 sessionId,
        address user,
        uint256 additionalAmount
    ) 
        external 
        onlyBackend 
        returns (bool) 
    {
        UserSession storage session = sessions[sessionId];
        
        require(session.isActive, "Session not active");
        require(session.user == user, "User mismatch");
        require(additionalAmount > 0, "Amount must be > 0");
        
        // Verify user has enough balance
        uint256 balance = fluxToken.balanceOf(user);
        require(balance >= additionalAmount, "Insufficient balance");

        // Update session authorized amount
        session.authorizedAmount += additionalAmount;
        session.lastUsedAt = block.timestamp;

        emit SessionToppedUp(sessionId, user, additionalAmount);
        return true;
    }
}