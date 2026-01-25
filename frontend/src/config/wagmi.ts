import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { baseSepolia, base, sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
    appName: 'Flux Compute',
    projectId: 'flux-compute-demo', // Replace with WalletConnect project ID for production
    chains: [baseSepolia, base, sepolia],
    transports: {
        [baseSepolia.id]: http(),
        [base.id]: http(),
        [sepolia.id]: http(),
    },
});

export { baseSepolia, base, sepolia };
