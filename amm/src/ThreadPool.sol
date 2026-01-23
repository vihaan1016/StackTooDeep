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

    function getReserves() public view returns (uint256, uint256) {
        return (s_ethReserve, s_threadReserve);
    }

    function swapEthForThread(uint256 minThreadOut, address _user) external payable {
        if (msg.value == 0) revert ThreadPool__InvalidInputAmount();

        uint256 ethReserveBefore = s_ethReserve;
        uint256 threadReserveBefore = s_threadReserve;

        uint256 threadOut = ThreadPoolUtils.getAmountOut(msg.value, ethReserveBefore, threadReserveBefore);

        if (threadOut < minThreadOut) revert ThreadPool__SlippageExceeded();
        if (threadOut > threadReserveBefore) revert ThreadPool__InsufficientLiquidity();

        i_thread.safeTransfer(_user, threadOut);

        uint256 ethBalanceAfter = address(this).balance;
        uint256 threadBalanceAfter = i_thread.balanceOf(address(this));

        uint256 ethAmountIn = msg.value;
        uint256 threadAmountIn = 0;

        uint256 ethBalanceAdjusted = (ethBalanceAfter * 1000) - (ethAmountIn * 3);
        uint256 threadBalanceAdjusted = (threadBalanceAfter * 1000) - (threadAmountIn * 3);

        if (ethBalanceAdjusted * threadBalanceAdjusted < ethReserveBefore * threadReserveBefore * 1000 ** 2) {
            revert ThreadPool__InvariantCheckFailed();
        }

        _updateReserves();

        emit Swap(msg.sender, msg.value, threadOut);
    }

    function swapThreadForEth(uint256 minEthOut, uint256 threadIn, address to) external {
        if (minEthOut == 0) revert ThreadPool__InvalidOutputAmount();

        uint256 ethReserveBefore = s_ethReserve;
        uint256 threadReserveBefore = s_threadReserve;

        uint256 balanceBefore = i_thread.balanceOf(address(this));
        i_thread.safeTransferFrom(msg.sender, address(this), threadIn);
        uint256 actualThreadIn = i_thread.balanceOf(address(this)) - balanceBefore;

        if (actualThreadIn == 0) revert ThreadPool__InvalidInputAmount();

        uint256 ethOut = ThreadPoolUtils.getAmountOut(actualThreadIn, threadReserveBefore, ethReserveBefore);

        if (ethOut < minEthOut) revert ThreadPool__SlippageExceeded();
        if (ethOut > ethReserveBefore) revert ThreadPool__InsufficientLiquidity();

        (bool success,) = to.call{value: ethOut}("");
        require(success, "ETH_TRANSFER_FAILED");

        uint256 ethBalanceAfter = address(this).balance;
        uint256 threadBalanceAfter = i_thread.balanceOf(address(this));

        uint256 ethAmountIn = 0;
        uint256 threadAmountIn = actualThreadIn;

        uint256 ethBalanceAdjusted = (ethBalanceAfter * 1000) - (ethAmountIn * 3);
        uint256 threadBalanceAdjusted = (threadBalanceAfter * 1000) - (threadAmountIn * 3);

        if (ethBalanceAdjusted * threadBalanceAdjusted < ethReserveBefore * threadReserveBefore * 1000 ** 2) {
            revert ThreadPool__InvariantCheckFailed();
        }

        _updateReserves();

        emit Swap(msg.sender, actualThreadIn, ethOut);
    }

    function getSpotPrice(bool ethToThread) external view returns (uint256) {
        (uint256 ethReserve, uint256 threadReserve) = getReserves();
        require(ethReserve > 0 && threadReserve > 0, "No liquidity");

        if (ethToThread) {
            return (threadReserve * 1e18) / ethReserve;
        } else {
            return (ethReserve * 1e18) / threadReserve;
        }
    }

    function _updateReserves() internal {
        s_ethReserve = address(this).balance;
        s_threadReserve = i_thread.balanceOf(address(this));
    }

    function addLiquidity(uint256 minThreadIn) external payable returns (uint256 liquidityMinted) {
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

            i_thread.safeTransferFrom(msg.sender, address(this), requiredThread);

            liquidityMinted = (msg.value * s_totalLiquidity) / ethReserve;
        }

        s_liquidityBalance[msg.sender] += liquidityMinted;
        s_totalLiquidity += liquidityMinted;

        _updateReserves();
    }

    function removeLiquidity(uint256 liquidityAmount) external returns (uint256 ethOut, uint256 threadOut) {
        if (liquidityAmount == 0) revert ThreadPool__InvalidInputAmount();
        if (s_liquidityBalance[msg.sender] < liquidityAmount) {
            revert ThreadPool__InsufficientLiquidity();
        }

        ethOut = (liquidityAmount * s_ethReserve) / s_totalLiquidity;

        threadOut = (liquidityAmount * s_threadReserve) / s_totalLiquidity;

        s_liquidityBalance[msg.sender] -= liquidityAmount;
        s_totalLiquidity -= liquidityAmount;

        (bool success,) = msg.sender.call{value: ethOut}("");
        require(success, "ETH_TRANSFER_FAILED");

        i_thread.safeTransfer(msg.sender, threadOut);

        _updateReserves();
    }

    receive() external payable {
        _updateReserves();
    }
}