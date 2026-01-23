// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ThreadPoolUtils} from "./ThreadPoolUtils.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ThreadPool {
    using ThreadPoolUtils for uint256;
    using SafeERC20 for IERC20;

    event Swap(
        address indexed sender,
        uint256 indexed amountIn,
        uint256 indexed amountOut
    );

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

    function getReserves() public view returns (uint256, uint256) {
        return (s_ethReserve, s_threadReserve);
    }

    function _updateReserves() internal {
        s_ethReserve = address(this).balance;
        s_threadReserve = i_thread.balanceOf(address(this));
    }

    receive() external payable {
        _updateReserves();
    }

    function addLiquidity(
        uint256 minThreadIn
    ) external payable returns (uint256 liquidityMinted) {
        if (msg.value == 0) {
            revert ThreadPool__InvalidInputAmount();
        }

        uint256 ethReserve = s_ethReserve;
        uint256 threadReserve = s_threadReserve;

        if (s_totalLiquidity == 0) {
            i_thread.safeTransferFrom(msg.sender, address(this), minThreadIn);

            liquidityMinted = ThreadPoolUtils.sqrt(msg.value * minThreadIn);
        } else {
            uint256 requiredThread = (msg.value * threadReserve) / ethReserve;

            if (requiredThread < minThreadIn) {
                revert ThreadPool__SlippageExceeded();
            }

            i_thread.safeTransferFrom(
                msg.sender,
                address(this),
                requiredThread
            );

            liquidityMinted = (msg.value * s_totalLiquidity) / ethReserve;
        }

        s_liquidityBalance[msg.sender] += liquidityMinted;
        s_totalLiquidity += liquidityMinted;

        _updateReserves();
    }

    function removeLiquidity(
        uint256 liquidityAmount
    ) external returns (uint256 ethOut, uint256 threadOut) {
        if (liquidityAmount == 0) revert ThreadPool__InvalidInputAmount();
        if (s_liquidityBalance[msg.sender] < liquidityAmount) {
            revert ThreadPool__InsufficientLiquidity();
        }

        ethOut = (liquidityAmount * s_ethReserve) / s_totalLiquidity;

        threadOut = (liquidityAmount * s_threadReserve) / s_totalLiquidity;

        s_liquidityBalance[msg.sender] -= liquidityAmount;
        s_totalLiquidity -= liquidityAmount;

        (bool success, ) = msg.sender.call{value: ethOut}("");
        require(success, "ETH_TRANSFER_FAILED");

        i_thread.safeTransfer(msg.sender, threadOut);

        _updateReserves();
    }
}
