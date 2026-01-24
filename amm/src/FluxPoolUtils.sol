// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library FluxPoolUtils {
    error Utils__InsufficientReserve();
    error Utils__InsufficientInput();
    error Utils__InsufficientOutput();

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        if (amountIn <= 0) {
            revert Utils__InsufficientInput();
        }
        if (reserveOut == 0 || reserveIn == 0) {
            revert Utils__InsufficientReserve();
        }

        uint256 amountInWithFees = amountIn * 997;
        uint256 numerator = (amountInWithFees * reserveOut);
        uint256 denominator = (reserveIn * 1000 + amountInWithFees);
        uint256 amountOut = numerator / denominator;

        return amountOut;
    }

    function getAmountIn(uint256 amountOut, uint256 reserveOut, uint256 reserveIn) internal pure returns (uint256) {
        if (amountOut <= 0) {
            revert Utils__InsufficientOutput();
        }
        if (reserveOut < amountOut || reserveIn == 0) {
            revert Utils__InsufficientReserve();
        }

        uint256 numerator = reserveIn * amountOut * 1000;
        uint256 denominator = (reserveOut - amountOut) * 997;
        uint256 amountIn = (numerator / denominator) + 1;

        return amountIn;
    }

    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
