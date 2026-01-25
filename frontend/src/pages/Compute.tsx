import { useState, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, MessageSquare, Box, ArrowRight, Loader2, Wallet, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCompute } from "@/hooks/useCompute";
import { useWallet } from "@/contexts/WalletContext";

interface Project {
  projectId: string;
  name: string;
  description: string;
  paymentModel: 'paper' | 'allocation';
  sessionInfo?: any;
}

export default function Compute() {
  const { isConnected, connect, walletAddress } = useWallet();
  const {
    createProject,
    deleteProject,
    getProjects,
    refreshProjects,
    sendMessage,
    loadMessages,
    messages,
    isChatting,
    paymentRequired,
    payForCompute,
    isPaying,
    processingStatus,
    setMessages,
    setPaymentRequired
  } = useCompute();

  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isStoreOpen, setIsCreateOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [allocationAmount, setAllocationAmount] = useState("10");
  const [paymentModel, setPaymentModel] = useState<'paper' | 'allocation'>('paper');

  // Load projects on mount or when wallet changes
  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setProjects([]);
      setSelectedProject(null);
      setMessages([]);
      return;
    }

    const load = async () => {
      // First load from local (cache)
      setProjects(getProjects());

      // Then sync from DB if connected
      if (isConnected && walletAddress) {
        const hydrated = await refreshProjects(walletAddress);
        setProjects(hydrated);
      }
    };
    load();
  }, [refreshProjects, isStoreOpen, getProjects, isConnected, walletAddress]);

  // Load messages when project changes
  useEffect(() => {
    if (selectedProject?.projectId) {
      loadMessages(selectedProject.projectId);
    } else {
      setMessages([]);
    }
  }, [selectedProject?.projectId, loadMessages]);

  // Sync selected project with fresh data (allocations etc)
  useEffect(() => {
    if (selectedProject) {
      const fresh = projects.find((p: Project) => p.projectId === selectedProject.projectId);
      if (fresh && fresh !== selectedProject) {
        setSelectedProject(fresh);
      }
    }
  }, [projects, selectedProject]);

  // ...

  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProject = async () => {
    if (!newProjectName) return;
    try {
      setIsCreating(true);
      await createProject(newProjectName, "Created via Frontend", paymentModel, allocationAmount);
      setNewProjectName("");
      setIsCreateOpen(false);
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!prompt.trim() || !selectedProject) return;
    const currentPrompt = prompt;
    setPrompt("");
    await sendMessage(selectedProject.projectId, currentPrompt);
  };

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this project?")) {
      const success = await deleteProject(projectId);
      if (success) {
        const updated = projects.filter(p => p.projectId !== projectId);
        setProjects(updated);
        if (selectedProject?.projectId === projectId) {
          setSelectedProject(null);
        }
      }
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-6rem)] p-6">
        <div className="max-w-7xl mx-auto h-full min-h-[80vh] grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Sidebar: Projects */}
          <div className="glass rounded-3xl p-4 flex flex-col h-full lg:col-span-1">
            <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="font-medium flex items-center gap-2">
                <Box className="w-4 h-4 text-lavender" />
                Projects
              </h2>
              <Dialog open={isStoreOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-muted/50 rounded-full">
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass border-border/50 rounded-3xl">
                  <DialogHeader>
                    <DialogTitle>Create Project</DialogTitle>
                    <DialogDescription>Deploy a new AI compute environment.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Name</label>
                      <Input
                        placeholder="My Awesome Project"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        className="bg-muted/50 border-0"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Payment Model</label>
                      <Select value={paymentModel} onValueChange={(v: any) => setPaymentModel(v)}>
                        <SelectTrigger className="bg-muted/50 border-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paper">Pay Per Request (x402)</SelectItem>
                          <SelectItem value="allocation">Token Allocation (Session)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {paymentModel === 'allocation' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Allocation Amount (FLUX)</label>
                        <Input
                          placeholder="Amount to authorize (default: 10)"
                          value={allocationAmount}
                          onChange={(e) => setAllocationAmount(e.target.value)}
                          className="bg-muted/50 border-0"
                          type="number"
                        />
                        <p className="text-xs text-muted-foreground">
                          You will be asked to approve this amount for the protocol.
                        </p>
                      </div>
                    )}
                    <Button onClick={handleCreateProject} disabled={isCreating} className="w-full btn-gradient">
                      {isCreating ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                        </div>
                      ) : (
                        "Create Project"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {projects.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-10">
                  No projects yet.
                </div>
              ) : (
                projects.map((p) => (
                  <div key={p.projectId} className="relative group">
                    <button
                      onClick={() => {
                        setSelectedProject(p);
                      }}
                      className={cn(
                        "w-full text-left p-3 rounded-xl text-sm transition-all flex items-center justify-between group pr-8",
                        selectedProject?.projectId === p.projectId
                          ? "bg-primary/10 border border-primary/20 text-foreground"
                          : "hover:bg-muted/30 text-muted-foreground"
                      )}
                    >
                      <span className="truncate max-w-[120px]">{p.name}</span>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full border",
                        p.paymentModel === 'paper'
                          ? "border-mint/20 text-mint bg-mint/5"
                          : "border-lavender/20 text-lavender bg-lavender/5"
                      )}>
                        {p.paymentModel === 'paper' ? 'PAYG' : 'ALLOC'}
                      </span>
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, p.projectId)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Main Area: Chat / Dashboard */}
          <div className="glass rounded-3xl lg:col-span-3 flex flex-col h-[80vh] relative overflow-hidden">
            {!selectedProject ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                  <Box className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p>Select or create a project to start computing</p>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-border/30 flex items-center justify-between bg-white/5 backdrop-blur-sm z-10">
                  <div>
                    <h3 className="font-medium text-foreground">{selectedProject.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      ID: {selectedProject.projectId}
                      {selectedProject.sessionInfo && (
                        <span className="text-mint flex items-center gap-1 bg-mint/10 px-2 rounded-md">
                          Credits: {parseFloat(selectedProject.sessionInfo.remainingAITokens).toFixed(0)} ({parseFloat(selectedProject.sessionInfo.remainingAmount).toFixed(2)} FLUX)
                        </span>
                      )}
                    </p>
                  </div>
                  {/* Status Indicator */}
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/30 border border-white/5">
                    <span className="w-2 h-2 rounded-full bg-mint animate-pulse" />
                    <span className="text-xs text-muted-foreground font-mono">ONLINE</span>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar scroll-smooth">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-30">
                      <MessageSquare className="w-12 h-12 mb-2" />
                      <p>Start a conversation with your AI compute node</p>
                    </div>
                  )}
                  {messages.map((msg, idx) => (
                    <div key={idx} className={cn(
                      "flex w-full",
                      msg.role === 'user' ? "justify-end" : "justify-start"
                    )}>
                      <div className={cn(
                        "max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed",
                        msg.role === 'user'
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "glass border border-white/10 rounded-bl-sm"
                      )}>
                        {msg.role === 'assistant' ? (
                          <div className="markdown-body text-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          msg.content
                        )}
                        {msg.txHash && (
                          <div className="mt-2 pt-2 border-t border-white/10 text-[10px] font-mono opacity-50 flex items-center gap-1">
                            <span>TX: {msg.txHash.slice(0, 6)}...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {processingStatus !== 'idle' && (
                    <div className="flex justify-start">
                      <div className="bg-muted/30 rounded-2xl p-4 rounded-bl-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-lavender" />
                        <span className="text-xs text-muted-foreground capitalize">
                          {processingStatus === 'generating' ? 'Generating Response' : `${processingStatus}...`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white/5 border-t border-border/30 backdrop-blur-md">
                  <div className="relative">
                    <Input
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder={paymentRequired ? "Payment required to continue..." : "Ask anything..."}
                      className="pr-12 py-6 bg-muted/40 border-white/5 focus:bg-muted/60"
                      disabled={!!paymentRequired || isChatting}
                    />
                    <Button
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={!prompt.trim() || !!paymentRequired || isChatting}
                      className="absolute right-1 top-1 h-10 w-10 btn-gradient rounded-xl"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* Payment Modal */}
                  <Dialog open={!!paymentRequired && processingStatus !== 'verifying' && processingStatus !== 'generating'} onOpenChange={(open) => !open && setPaymentRequired(null)}>
                    <DialogContent className="glass border-border/50 rounded-3xl max-w-sm sm:max-w-md">
                      <DialogHeader>
                        <div className="mx-auto w-12 h-12 rounded-full bg-mint/10 flex items-center justify-center mb-4">
                          <Wallet className="w-6 h-6 text-mint" />
                        </div>
                        <DialogTitle className="text-center text-xl">Confirm Compute Payment</DialogTitle>
                        <DialogDescription className="text-center text-muted-foreground">
                          This request requires additional computation credits.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="py-6 space-y-4">
                        <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
                          <span className="text-sm text-muted-foreground">Tokens Required</span>
                          <span className="font-mono">{paymentRequired?.estimatedTokens}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-xl bg-primary/5 border border-primary/20">
                          <span className="text-sm text-foreground">Total Cost</span>
                          <span className="font-mono text-xl font-medium text-mint">
                            {paymentRequired ? parseFloat(paymentRequired.fluxRequired).toFixed(4) : "0.00"} FLUX
                          </span>
                        </div>
                      </div>

                      <Button
                        onClick={() => payForCompute()}
                        disabled={isPaying}
                        className="w-full btn-gradient rounded-xl py-6 text-lg font-medium"
                      >
                        {isPaying ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" /> Verifying...
                          </div>
                        ) : "Approve & Continue"}
                      </Button>
                      <p className="text-center text-xs text-muted-foreground mt-2">
                        Transaction will be processed on-chain.
                      </p>
                    </DialogContent>
                  </Dialog>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
