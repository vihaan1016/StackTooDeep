import { createContext, useContext, ReactNode } from 'react';
import { useAccount, useBalance, useDisconnect, useReadContract, useConnect } from 'wagmi';
import { formatEther } from 'viem';
import { FLUX_TOKEN_ADDRESS, ERC20_ABI } from '../config/contracts';

interface WalletContextType {
  isConnected: boolean;
  walletAddress: string | null;
  balance: string;
  ethBalance: string;
  fluxBalance: string;
  connect: () => void;
  disconnect: () => void;
  chainId: number | undefined;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors, connect: wagmiConnect } = useConnect();

  // ETH Balance
  const { data: balanceData } = useBalance({
    address: address,
  });

  // FLUX Token Balance
  const { data: fluxBalanceData } = useReadContract({
    address: FLUX_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const formattedBalance = balanceData
    ? parseFloat(formatEther(balanceData.value)).toFixed(4)
    : '0.00';

  const ethBalance = balanceData
    ? parseFloat(formatEther(balanceData.value)).toFixed(6)
    : '0';

  const fluxBalance = fluxBalanceData
    ? parseFloat(formatEther(fluxBalanceData as bigint)).toFixed(4)
    : '0';

  const connect = () => {
    // Find MetaMask connector and connect directly
    const metaMaskConnector = connectors.find(
      (c) => c.name.toLowerCase().includes('metamask') || c.id === 'injected'
    );
    if (metaMaskConnector) {
      wagmiConnect({ connector: metaMaskConnector });
    } else if (connectors.length > 0) {
      // Fallback to first available connector
      wagmiConnect({ connector: connectors[0] });
    }
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        walletAddress: address || null,
        balance: formattedBalance,
        ethBalance,
        fluxBalance,
        connect,
        disconnect,
        chainId,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
