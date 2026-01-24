// src/X402DirectPayment.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {FluxToken} from "./Flux.sol";

/// @title X402 Direct Payment for AI
/// @notice TRUE x402 - Pay FLUX per request, no sessions!
/// @dev Complements AIPaymentProtocol (sessions) with direct payments
contract X402DirectPayment {
    FluxToken public immutable fluxToken;
    address public immutable owner;
    address public backend;
    
    // Pricing
    uint256 public pricePerRequest = 100 ether; // 100 FLUX per request
    
    // Statistics
    uint256 public totalRequests;
    uint256 public totalBurned;
    mapping(address => uint256) public userRequests;
    
    // Payment tracking (prevent double-use)
    mapping(bytes32 => bool) public processedPayments;
    
    event DirectPaymentReceived(
        address indexed from,
        uint256 amount,
        bytes32 indexed requestId,
        uint256 timestamp
    );
    
    event TokensBurned(
        uint256 amount,
        bytes32 indexed requestId
    );
    
    event PriceUpdated(uint256 newPrice);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyBackend() {
        require(msg.sender == backend, "Not backend");
        _;
    }
    
    constructor(address _fluxToken, address _backend) {
        require(_fluxToken != address(0), "Invalid token");
        require(_backend != address(0), "Invalid backend");
        
        fluxToken = FluxToken(_fluxToken);
        owner = msg.sender;
        backend = _backend;
    }
    
    /// @notice Direct payment for AI request (standard ERC20)
    /// @param amount FLUX amount (must be >= pricePerRequest)
    /// @param requestId Unique identifier for this request
    function payForRequest(uint256 amount, bytes32 requestId) external returns (bool) {
        require(amount >= pricePerRequest, "Insufficient payment");
        require(!processedPayments[requestId], "Request already processed");
        
        // Transfer FLUX from user to this contract
        bool success = fluxToken.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");
        
        // Mark as processed
        processedPayments[requestId] = true;
        
        // Burn the tokens immediately
        fluxToken.burn(amount);
        
        // Update statistics
        totalRequests++;
        totalBurned += amount;
        userRequests[msg.sender]++;
        
        emit DirectPaymentReceived(msg.sender, amount, requestId, block.timestamp);
        emit TokensBurned(amount, requestId);
        
        return true;
    }
    
    /// @notice Direct payment using EIP-3009 gasless authorization
    /// @dev Backend calls this after user signs authorization
    function payWithAuthorization(
        address from,
        uint256 amount,
        bytes32 requestId,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external onlyBackend returns (bool) {
        require(amount >= pricePerRequest, "Insufficient payment");
        require(!processedPayments[requestId], "Request already processed");
        
        // Use EIP-3009 gasless transfer (user signed off-chain)
        fluxToken.receiveWithAuthorization(
            from,
            address(this),
            amount,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
        
        // Mark as processed
        processedPayments[requestId] = true;
        
        // Burn immediately
        fluxToken.burn(amount);
        
        // Update statistics
        totalRequests++;
        totalBurned += amount;
        userRequests[from]++;
        
        emit DirectPaymentReceived(from, amount, requestId, block.timestamp);
        emit TokensBurned(amount, requestId);
        
        return true;
    }
    
    /// @notice Verify if payment was processed
    function isPaymentProcessed(bytes32 requestId) external view returns (bool) {
        return processedPayments[requestId];
    }
    
    /// @notice Get user statistics
    function getUserStats(address user) external view returns (
        uint256 requests,
        uint256 totalSpent
    ) {
        return (
            userRequests[user],
            userRequests[user] * pricePerRequest
        );
    }
    
    /// @notice Get contract statistics
    function getStats() external view returns (
        uint256 requests,
        uint256 burned,
        uint256 price,
        uint256 remainingSupply
    ) {
        return (
            totalRequests,
            totalBurned,
            pricePerRequest,
            fluxToken.totalSupply()
        );
    }
    
    /// @notice Update price (owner only)
    function setPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Invalid price");
        pricePerRequest = newPrice;
        emit PriceUpdated(newPrice);
    }
    
    /// @notice Update backend address (owner only)
    function setBackend(address newBackend) external onlyOwner {
        require(newBackend != address(0), "Invalid backend");
        backend = newBackend;
    }
}