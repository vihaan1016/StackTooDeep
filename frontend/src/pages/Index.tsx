import { Layout } from "@/components/layout/Layout";
import { Landing } from "@/components/landing/Landing";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const Index = () => {
  const { isConnected } = useWallet();
  const navigate = useNavigate();

  // Redirect to swap if already connected
  useEffect(() => {
    if (isConnected) {
      navigate("/swap");
    }
  }, [isConnected, navigate]);

  return (
    <Layout>
      <Landing />
    </Layout>
  );
};

export default Index;
