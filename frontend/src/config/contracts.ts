// FluxPool AMM Contract Configuration
// Update FLUX_POOL_ADDRESS when the contract is deployed

export const FLUX_TOKEN_ADDRESS = '0xE16224cF844c9F1750487004FDe10C5c943BD948' as const;
export const AI_PAYMENT_PROTOCOL_ADDRESS = '0x4A8B4AE5f4Af3b895b0B28117E4dA424CF96EF28' as const;
export const FLUX_POOL_ADDRESS = '0x5aa9de14b00268e52c21361d4303764085ee453d' as const;

export const FLUX_POOL_ABI = [
    {
        type: 'constructor',
        inputs: [{ name: '_fluxAddress', type: 'address' }],
    },
    {
        type: 'function',
        name: 'getReserves',
        inputs: [],
        outputs: [
            { name: '', type: 'uint256' },
            { name: '', type: 'uint256' },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getUserLiquidity',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getSpotPrice',
        inputs: [{ name: 'ethToFlux', type: 'bool' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'swapEthForFlux',
        inputs: [
            { name: 'minFluxOut', type: 'uint256' },
            { name: '_user', type: 'address' },
        ],
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        name: 'swapFluxForEth',
        inputs: [
            { name: 'minEthOut', type: 'uint256' },
            { name: 'fluxIn', type: 'uint256' },
            { name: 'to', type: 'address' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'addLiquidity',
        inputs: [{ name: 'minFluxIn', type: 'uint256' }],
        outputs: [{ name: 'liquidityMinted', type: 'uint256' }],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        name: 'removeLiquidity',
        inputs: [{ name: 'liquidityAmount', type: 'uint256' }],
        outputs: [
            { name: 'ethOut', type: 'uint256' },
            { name: 'fluxOut', type: 'uint256' },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'event',
        name: 'Swap',
        inputs: [
            { name: 'sender', type: 'address', indexed: true },
            { name: 'amountIn', type: 'uint256', indexed: true },
            { name: 'amountOut', type: 'uint256', indexed: true },
        ],
    },
] as const;

export const ERC20_ABI = [
    {
        type: 'function',
        name: 'approve',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'transfer',
        inputs: [
            { name: 'recipient', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'allowance',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'balanceOf',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'decimals',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'symbol',
        inputs: [],
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
    },
] as const;
