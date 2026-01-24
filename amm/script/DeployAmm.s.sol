// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import {FluxPool} from "../src/FluxPool.sol";
import {FluxPoolUtils} from "../src/FluxPoolutils.sol";
import {Script} from "../lib/forge-std/src/Script.sol";

contract DeployAmm is Script {
    function run() public returns (FluxPool) {
        vm.startBroadcast();
        FluxPool fluxPool = new FluxPool(0xE16224cF844c9F1750487004FDe10C5c943BD948);
        vm.stopBroadcast();
        return fluxPool;
    }
}
