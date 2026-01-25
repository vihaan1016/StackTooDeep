import { createPublicClient, http, parseEther, formatEther, encodeFunctionData, getAddress } from 'viem';
import { sepolia } from 'viem/chains';

const FLUX_POOL_ADDRESS = '0x9c40D14B5c0704c50A9963EA6940d6BAd722dEBf';
const USER_ADDRESS = '0x4a7d06807d50d302C1bBee0349240eda17a08C91';

const FLUX_POOL_ABI = [
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
        name: 'getReserves',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }, { name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
] as const;

// Use Alchemy public endpoint
const client = createPublicClient({
    chain: sepolia,
    transport: http('https://eth-sepolia.g.alchemy.com/v2/demo'),
});

async function main() {
    console.log('=== DEBUGGING SWAP REVERT ===\n');

    // Get reserves
    const reserves = await client.readContract({
        address: FLUX_POOL_ADDRESS,
        abi: FLUX_POOL_ABI,
        functionName: 'getReserves',
    });

    console.log('Pool Reserves:');
    console.log('  ETH:', formatEther(reserves[0]), 'ETH');
    console.log('  FLUX:', formatEther(reserves[1]), 'FLUX');

    // Calculate expected output for 0.01 ETH
    const amountIn = parseEther('0.01');
    const [ethRes, fluxRes] = reserves;

    const inputWithFee = amountIn * 997n;
    const numerator = inputWithFee * fluxRes;
    const denominator = ethRes * 1000n + inputWithFee;
    const expectedOut = numerator / denominator;

    console.log('\nSwap Calculation:');
    console.log('  Input: 0.01 ETH');
    console.log('  Expected Output:', formatEther(expectedOut), 'FLUX');

    // Use a very low minOut
    const minOut = 1n; // 1 wei

    console.log('\nSimulating swap with:');
    console.log('  From:', USER_ADDRESS);
    console.log('  Value:', formatEther(amountIn), 'ETH');
    console.log('  minFluxOut:', minOut.toString(), '(1 wei)');

    const data = encodeFunctionData({
        abi: FLUX_POOL_ABI,
        functionName: 'swapEthForFlux',
        args: [minOut, getAddress(USER_ADDRESS)],
    });

    try {
        const result = await client.call({
            account: getAddress(USER_ADDRESS),
            to: FLUX_POOL_ADDRESS,
            data: data,
            value: amountIn,
        });
        console.log('\n✅ Simulation SUCCESS!');
        console.log('Result:', result);
    } catch (error: any) {
        console.log('\n❌ Simulation FAILED!');

        // Extract error signature
        const errData = error.cause?.data || error.data;
        if (errData) {
            const sig = typeof errData === 'string' ? errData.slice(0, 10) : null;
            console.log('Error signature:', sig);

            const errorMap: Record<string, string> = {
                '0xff4e1b2b': 'FluxPool__InvalidInputAmount',
                '0x40517e3a': 'FluxPool__SlippageExceeded',
                '0xc9618dff': 'FluxPool__InsufficientLiquidity',
                '0x81a26881': 'FluxPool__InvariantCheckFailed',
            };
            console.log('Error name:', errorMap[sig || ''] || 'Unknown');
        }

        console.log('\nFull error:', error.shortMessage || error.message);
    }
}

main().catch(e => console.error('Script error:', e.message));
