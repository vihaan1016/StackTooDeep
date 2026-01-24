// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {X402DirectPayment} from "../src/X402DirectPayment.sol";
import {FluxToken} from "../src/Flux.sol";

/**
 * @title DeployX402Direct
 * @notice Deploys X402DirectPayment contract for true pay-per-request AI
 */
contract DeployX402Direct is Script {
    function run() external returns (X402DirectPayment) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get addresses from environment
        address fluxTokenAddress = vm.envAddress("FLUX_TOKEN_ADDRESS");
        address backendWallet = vm.envOr("WALLET_ADDRESS", deployer);

        console.log("=== X402 Direct Payment Deployment ===");
        console.log("Deployer:", deployer);
        console.log("FLUX Token:", fluxTokenAddress);
        console.log("Backend Wallet:", backendWallet);
        console.log("");

        // Verify FLUX token exists
        FluxToken fluxToken = FluxToken(fluxTokenAddress);
        string memory tokenName = fluxToken.name();
        string memory tokenSymbol = fluxToken.symbol();
        uint256 totalSupply = fluxToken.totalSupply();
        
        console.log("FLUX Token Info:");
        console.log("  Name:", tokenName);
        console.log("  Symbol:", tokenSymbol);
        console.log("  Total Supply:", totalSupply / 1e18, "FLUX");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy X402DirectPayment
        console.log("Deploying X402DirectPayment...");
        X402DirectPayment x402Direct = new X402DirectPayment(
            fluxTokenAddress,
            backendWallet
        );
        
        console.log("X402DirectPayment deployed at:", address(x402Direct));
        console.log("");

        // Display contract info
        uint256 pricePerRequest = x402Direct.pricePerRequest();
        console.log("Contract Configuration:");
        console.log("  Price per request:", pricePerRequest / 1e18, "FLUX");
        console.log("  Owner:", x402Direct.owner());
        console.log("  Backend:", x402Direct.backend());
        console.log("");

        vm.stopBroadcast();

        // Summary
        console.log("=== Deployment Summary ===");
        console.log("X402DirectPayment:", address(x402Direct));
        console.log("");
        
        console.log("=== Next Steps ===");
        console.log("1. Update backend/.env:");
        console.log("   X402_CONTRACT_ADDRESS=", address(x402Direct));
        console.log("");
        console.log("2. Users need to approve X402DirectPayment:");
        console.log("   fluxToken.approve(", address(x402Direct), ", amount)");
        console.log("");
        console.log("3. Test the contract:");
        console.log("   cast call", address(x402Direct), '"pricePerRequest()"');
        console.log("");
        console.log("4. Make a payment:");
        console.log("   x402Direct.payForRequest(100 FLUX, requestId)");
        console.log("");
        
        console.log("=== Statistics Endpoints ===");
        console.log("Get stats:");
        console.log("  cast call", address(x402Direct), '"getStats()"');
        console.log("");
        console.log("Check if paid:");
        console.log("  cast call", address(x402Direct), '"isPaymentProcessed(bytes32)" <requestId>');

        return x402Direct;
    }
}