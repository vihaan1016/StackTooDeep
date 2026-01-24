// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {FluxToken} from "../src/Flux.sol";
import {AIPaymentProtocol} from "../src/EscrowContract.sol";

/**
 * @title DeployAll
 * @notice Deploys both FluxToken and AIPaymentProtocol in one script
 */
contract DeployAll is Script {
    function run() external returns (FluxToken, AIPaymentProtocol) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Get backend and x402 addresses from env or use deployer as default
        address deployer = vm.addr(deployerPrivateKey);
        address x402Protocol = vm.envOr("X402_PROTOCOL_ADDRESS", deployer);
        address backendWallet = vm.envOr("BACKEND_WALLET_ADDRESS", deployer);

        console.log("=== Deployment Configuration ===");
        console.log("Deployer:", deployer);
        console.log("X402 Protocol:", x402Protocol);
        console.log("Backend Wallet:", backendWallet);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy FluxToken with 10 million initial supply
        console.log("Deploying FluxToken...");
        FluxToken fluxToken = new FluxToken(10_000_000);
        console.log("FluxToken deployed at:", address(fluxToken));
        console.log("Initial supply:", fluxToken.totalSupply());
        console.log("");

        // 2. Deploy AIPaymentProtocol
        console.log("Deploying AIPaymentProtocol...");
        AIPaymentProtocol paymentProtocol = new AIPaymentProtocol(
            address(fluxToken),
            x402Protocol,
            backendWallet
        );
        console.log("AIPaymentProtocol deployed at:", address(paymentProtocol));
        console.log("Conversion Rate:", paymentProtocol.conversionRate(), "AI tokens per FLUX");
        console.log("");

        vm.stopBroadcast();

        // Summary
        console.log("=== Deployment Summary ===");
        console.log("FluxToken:", address(fluxToken));
        console.log("AIPaymentProtocol:", address(paymentProtocol));
        console.log("");
        console.log("Next steps:");
        console.log("1. Users need to approve AIPaymentProtocol to spend their FLUX tokens");
        console.log("2. Command: fluxToken.approve(address(paymentProtocol), amount)");

        return (fluxToken, paymentProtocol);
    }
}