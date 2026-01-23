// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ThreadPoolUtils} from "./ThreadPoolUtils.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ThreadPool {
    using ThreadPoolUtils for uint256;
    using SafeERC20 for IERC20;

    event Swap(address indexed sender, uint256 indexed amountIn, uint256 indexed amountOut);

    error ThreadPool__InvalidThreadAddress();
    error ThreadPool__InvalidOutputAmount();
    error ThreadPool__InvalidInputAmount();
    error ThreadPool__InsufficientLiquidity();
    error ThreadPool__SlippageExceeded();
    error ThreadPool__InvariantCheckFailed();

    uint256 private s_threadReserve;
    uint256 private s_ethReserve;
    uint256 private s_totalLiquidity;
    IERC20 immutable i_thread;
    mapping(address => uint256) private s_liquidityBalance;

    constructor(address _threadAddress) {
        if (_threadAddress == address(0)) {
            revert ThreadPool__InvalidThreadAddress();
        }
        i_thread = IERC20(_threadAddress);
        s_ethReserve = address(this).balance;
        s_threadReserve = i_thread.balanceOf(address(this));
    }
}