// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FluxPoolUtils} from "./FluxPoolUtils.sol"; 
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract FluxPool {
    using FluxPoolUtils for uint256;
    using SafeERC20 for IERC20;

    event Swap(address indexed sender, uint256 indexed amountIn, uint256 indexed amountOut);

    error FluxPool__InvalidFluxAddress();
    error FluxPool__InvalidOutputAmount();
    error FluxPool__InvalidInputAmount();
    error FluxPool__InsufficientLiquidity();
    error FluxPool__SlippageExceeded();
    error FluxPool__InvariantCheckFailed();

    uint256 private s_fluxReserve;
    uint256 private s_ethReserve;
    uint256 private s_totalLiquidity;
    IERC20 immutable i_flux;
    mapping(address => uint256) private s_liquidityBalance;

    constructor(address _fluxAddress) {
        if (_fluxAddress == address(0)) {
            revert FluxPool__InvalidFluxAddress();
        }
        i_flux = IERC20(_fluxAddress);
        s_ethReserve = address(this).balance;
        s_fluxReserve = i_flux.balanceOf(address(this));
    }

    function getReserves() public view returns (uint256, uint256) {
        return (s_ethReserve, s_fluxReserve);
    }

    function swapEthForFlux(uint256 minFluxOut, address _user) external payable {
        if (msg.value == 0) revert FluxPool__InvalidInputAmount();

        uint256 ethReserveBefore = s_ethReserve;
        uint256 fluxReserveBefore = s_fluxReserve;

        uint256 fluxOut = FluxPoolUtils.getAmountOut(msg.value, ethReserveBefore, fluxReserveBefore);

        if (fluxOut < minFluxOut) revert FluxPool__SlippageExceeded();
        if (fluxOut > fluxReserveBefore) revert FluxPool__InsufficientLiquidity();

        i_flux.safeTransfer(_user, fluxOut);

        uint256 ethBalanceAfter = address(this).balance;
        uint256 fluxBalanceAfter = i_flux.balanceOf(address(this));

        uint256 ethAmountIn = msg.value;
        uint256 fluxAmountIn = 0;

        uint256 ethBalanceAdjusted = (ethBalanceAfter * 1000) - (ethAmountIn * 3);
        uint256 fluxBalanceAdjusted = (fluxBalanceAfter * 1000) - (fluxAmountIn * 3);

        if (ethBalanceAdjusted * fluxBalanceAdjusted < ethReserveBefore * fluxReserveBefore * 1000 ** 2) {
            revert FluxPool__InvariantCheckFailed();
        }

        _updateReserves();

        emit Swap(msg.sender, msg.value, fluxOut);
    }

    function swapFluxForEth(uint256 minEthOut, uint256 fluxIn, address to) external {
        if (minEthOut == 0) revert FluxPool__InvalidOutputAmount();

        uint256 ethReserveBefore = s_ethReserve;
        uint256 fluxReserveBefore = s_fluxReserve;

        uint256 balanceBefore = i_flux.balanceOf(address(this));
        i_flux.safeTransferFrom(msg.sender, address(this), fluxIn);
        uint256 actualFluxIn = i_flux.balanceOf(address(this)) - balanceBefore;

        if (actualFluxIn == 0) revert FluxPool__InvalidInputAmount();

        uint256 ethOut = FluxPoolUtils.getAmountOut(actualFluxIn, fluxReserveBefore, ethReserveBefore);

        if (ethOut < minEthOut) revert FluxPool__SlippageExceeded();
        if (ethOut > ethReserveBefore) revert FluxPool__InsufficientLiquidity();

        (bool success,) = to.call{value: ethOut}("");
        require(success, "ETH_TRANSFER_FAILED");

        uint256 ethBalanceAfter = address(this).balance;
        uint256 fluxBalanceAfter = i_flux.balanceOf(address(this));

        uint256 ethAmountIn = 0;
        uint256 fluxAmountIn = actualFluxIn;

        uint256 ethBalanceAdjusted = (ethBalanceAfter * 1000) - (ethAmountIn * 3);
        uint256 fluxBalanceAdjusted = (fluxBalanceAfter * 1000) - (fluxAmountIn * 3);

        if (ethBalanceAdjusted * fluxBalanceAdjusted < ethReserveBefore * fluxReserveBefore * 1000 ** 2) {
            revert FluxPool__InvariantCheckFailed();
        }

        _updateReserves();

        emit Swap(msg.sender, actualFluxIn, ethOut);
    }

    function getSpotPrice(bool ethToFlux) external view returns (uint256) {
        (uint256 ethReserve, uint256 fluxReserve) = getReserves();
        require(ethReserve > 0 && fluxReserve > 0, "No liquidity");

        if (ethToFlux) {
            return (fluxReserve * 1e18) / ethReserve;
        } else {
            return (ethReserve * 1e18) / fluxReserve;
        }
    }

    function _updateReserves() internal {
        s_ethReserve = address(this).balance;
        s_fluxReserve = i_flux.balanceOf(address(this));
    }

    function addLiquidity(uint256 minFluxIn) external payable returns (uint256 liquidityMinted) {
        if (msg.value == 0) {
            revert FluxPool__InvalidInputAmount();
        }

        uint256 ethReserve = s_ethReserve;
        uint256 fluxReserve = s_fluxReserve;

        if (s_totalLiquidity == 0) {
            i_flux.safeTransferFrom(msg.sender, address(this), minFluxIn);

            liquidityMinted = FluxPoolUtils.sqrt(msg.value * minFluxIn);
        } else {
            uint256 requiredFlux = (msg.value * fluxReserve) / ethReserve;

            if (requiredFlux < minFluxIn) {
                revert FluxPool__SlippageExceeded();
            }

            i_flux.safeTransferFrom(msg.sender, address(this), requiredFlux);

            liquidityMinted = (msg.value * s_totalLiquidity) / ethReserve;
        }

        s_liquidityBalance[msg.sender] += liquidityMinted;
        s_totalLiquidity += liquidityMinted;

        _updateReserves();
    }

    function removeLiquidity(uint256 liquidityAmount) external returns (uint256 ethOut, uint256 fluxOut) {
        if (liquidityAmount == 0) revert FluxPool__InvalidInputAmount();
        if (s_liquidityBalance[msg.sender] < liquidityAmount) {
            revert FluxPool__InsufficientLiquidity();
        }

        ethOut = (liquidityAmount * s_ethReserve) / s_totalLiquidity;

        fluxOut = (liquidityAmount * s_fluxReserve) / s_totalLiquidity;

        s_liquidityBalance[msg.sender] -= liquidityAmount;
        s_totalLiquidity -= liquidityAmount;

        (bool success,) = msg.sender.call{value: ethOut}("");
        require(success, "ETH_TRANSFER_FAILED");

        i_flux.safeTransfer(msg.sender, fluxOut);

        _updateReserves();
    }

    receive() external payable {
        _updateReserves();
    }
}