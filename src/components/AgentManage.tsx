"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount, useWriteContract, useReadContract, useReadContracts, useSignTypedData } from "wagmi";
import { type Hex, type Address, zeroAddress } from "viem";
import { browserClient as publicClient } from "../../lib/rpc";
import { erc8004Abi, resolveAgentURI, type AgentMetadata } from "../../lib/contracts/erc8004";
import { ERC8004_REGISTRY, BASE_CHAIN_ID, EXPLORER_URL } from "../../lib/contracts/constants";
import { Select } from "./Select";

const GENRES = [
  "Fantasy", "Sci-Fi", "Mystery", "Romance", "Horror",
  "Thriller", "Literary Fiction", "Comedy", "Historical", "Adventure",
] as const;

const LLM_MODELS = [
  "Claude Opus", "Claude Sonnet", "OpenAI GPT", "Google Gemini",
  "Cursor Composer", "xAI Grok", "Moonshot Kimi", "DeepSeek", "Qwen", "Others",
] as const;

const EIP712_DOMAIN = {
  name: "ERC8004IdentityRegistry",
  version: "1",
  chainId: Number(BASE_CHAIN_ID),
  verifyingContract: ERC8004_REGISTRY,
} as const;

const SET_WALLET_TYPES = {
  AgentWalletSet: [
    { name: "agentId", type: "uint256" },
    { name: "newWallet", type: "address" },
    { name: "owner", type: "address" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

interface AgentManageProps {
  agentId: bigint;
  role: "owner" | "agentWallet";
  source?: "ows" | "direct";
}

export function AgentManage({ agentId, role, source }: AgentManageProps) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();

  const [metadata, setMetadata] = useState<AgentMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit state for URI update
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [editLlmModel, setEditLlmModel] = useState("");
  const [savingUri, setSavingUri] = useState(false);

  // Wallet change state
  const [changingWallet, setChangingWallet] = useState(false);
  const [newWalletAddr, setNewWalletAddr] = useState("");
  const [walletSignature, setWalletSignature] = useState<Hex | undefined>();
  const [walletDeadline, setWalletDeadline] = useState<bigint | undefined>();
  const [walletStep, setWalletStep] = useState<"enter" | "sign" | "submit" | null>(null);
  const [signingWallet, setSigningWallet] = useState(false);
  const [submittingWallet, setSubmittingWallet] = useState(false);

  // OWS wallet change (paste-based flow)
  const [owsPastedSig, setOwsPastedSig] = useState("");
  const [owsPastedDeadline, setOwsPastedDeadline] = useState("");

  // Unset wallet state
  const [unsettingWallet, setUnsettingWallet] = useState(false);

  // Fetch current agent wallet
  const { data: currentAgentWallet } = useReadContract({
    address: ERC8004_REGISTRY,
    abi: erc8004Abi,
    functionName: "getAgentWallet",
    args: [agentId],
  });

  // Fetch owner of the agent NFT
  const { data: ownerAddr } = useReadContract({
    address: ERC8004_REGISTRY,
    abi: erc8004Abi,
    functionName: "ownerOf",
    args: [agentId],
  });

  // Fetch metadata from URI
  useEffect(() => {
    let cancelled = false;
    async function fetchMeta() {
      try {
        const uri = await publicClient.readContract({
          address: ERC8004_REGISTRY,
          abi: erc8004Abi,
          functionName: "agentURI",
          args: [agentId],
        });
        if (cancelled) return;
        if (!uri) { setMetadata(null); return; }
        const parsed = await resolveAgentURI(uri as string);
        setMetadata({
          name: (parsed.name as string) || "Unknown Agent",
          description: (parsed.description as string) || "",
          genre: (parsed.genre as string) || undefined,
          llmModel: (parsed.llmModel as string) || (parsed.model as string) || undefined,
          registeredBy: (parsed.registeredBy as string) || undefined,
          registeredAt: (parsed.registeredAt as string) || undefined,
        });
      } catch {
        if (!cancelled) setMetadata(null);
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }
    fetchMeta();
    return () => { cancelled = true; };
  }, [agentId]);

  // Populate edit fields when metadata loads
  useEffect(() => {
    if (metadata) {
      setEditName(metadata.name);
      setEditDescription(metadata.description);
      setEditGenre(metadata.genre ?? "");
      setEditLlmModel(metadata.llmModel ?? "");
    }
  }, [metadata]);

  // Auto-dismiss success message after 5 seconds
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const isOwner = role === "owner";
  const editUri = useMemo(() => {
    if (!editName.trim()) return "";
    return JSON.stringify({
      name: editName.trim(),
      description: editDescription.trim(),
      genre: editGenre || undefined,
      llmModel: editLlmModel || undefined,
      registeredBy: metadata?.registeredBy ?? address,
      registeredAt: metadata?.registeredAt ?? new Date().toISOString(),
    });
  }, [editName, editDescription, editGenre, editLlmModel, metadata, address]);

  async function handleUpdateUri() {
    if (!editUri) return;
    try {
      setError(null);
      setSuccessMessage(null);
      setSavingUri(true);
      const hash = await writeContractAsync({
        address: ERC8004_REGISTRY,
        abi: erc8004Abi,
        functionName: "setAgentURI",
        args: [agentId, editUri],
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      const parsed = JSON.parse(editUri);
      setMetadata({ ...metadata!, ...parsed });
      // Persist URI update to DB
      try {
        const cacheRes = await fetch("/api/user/agent-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            fields: {
              agent_name: parsed.name,
              agent_description: parsed.description,
              agent_genre: parsed.genre || null,
              agent_llm_model: parsed.llmModel || null,
            },
          }),
        });
        setSuccessMessage(cacheRes.ok
          ? "Agent profile updated"
          : "On-chain OK, but cache failed — will sync on next visit");
      } catch {
        setSuccessMessage("On-chain OK, but cache failed — will sync on next visit");
      }
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update URI");
    } finally {
      setSavingUri(false);
    }
  }

  async function handleUnsetWallet() {
    try {
      setError(null);
      setSuccessMessage(null);
      setUnsettingWallet(true);
      const hash = await writeContractAsync({
        address: ERC8004_REGISTRY,
        abi: erc8004Abi,
        functionName: "unsetAgentWallet",
        args: [agentId],
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      // Persist unset to DB
      try {
        const cacheRes = await fetch("/api/user/agent-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            fields: { agent_wallet: null },
          }),
        });
        setSuccessMessage(cacheRes.ok
          ? "Agent wallet removed"
          : "On-chain OK, but cache failed — will sync on next visit");
      } catch {
        setSuccessMessage("On-chain OK, but cache failed — will sync on next visit");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unset wallet");
    } finally {
      setUnsettingWallet(false);
    }
  }

  async function handleSignNewWallet() {
    if (!newWalletAddr || !address) return;
    try {
      setError(null);
      setSuccessMessage(null);
      setSigningWallet(true);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
      const signature = await signTypedDataAsync({
        domain: EIP712_DOMAIN,
        types: SET_WALLET_TYPES,
        primaryType: "AgentWalletSet",
        message: {
          agentId,
          newWallet: newWalletAddr as Address,
          owner: (ownerAddr ?? address) as Address,
          deadline,
        },
      });
      setWalletSignature(signature);
      setWalletDeadline(deadline);
      setWalletStep("submit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signing failed");
    } finally {
      setSigningWallet(false);
    }
  }

  async function handleSubmitNewWallet() {
    if (!walletSignature || !walletDeadline || !newWalletAddr) return;
    try {
      setError(null);
      setSuccessMessage(null);
      setSubmittingWallet(true);
      const hash = await writeContractAsync({
        address: ERC8004_REGISTRY,
        abi: erc8004Abi,
        functionName: "setAgentWallet",
        args: [agentId, newWalletAddr as Address, walletDeadline, walletSignature],
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      // Persist new wallet binding to DB
      try {
        const cacheRes = await fetch("/api/user/agent-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            fields: { agent_wallet: newWalletAddr.toLowerCase() },
          }),
        });
        setSuccessMessage(cacheRes.ok
          ? "Agent wallet bound successfully"
          : "On-chain OK, but cache failed — will sync on next visit");
      } catch {
        setSuccessMessage("On-chain OK, but cache failed — will sync on next visit");
      }
      setWalletStep(null);
      setChangingWallet(false);
      setNewWalletAddr("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet binding failed");
    } finally {
      setSubmittingWallet(false);
    }
  }

  const isNewWalletConnected =
    address?.toLowerCase() === newWalletAddr.toLowerCase() && newWalletAddr.match(/^0x[a-fA-F0-9]{40}$/);
  const isOwnerConnected =
    ownerAddr && address?.toLowerCase() === (ownerAddr as string).toLowerCase();

  if (loadingMeta) {
    return (
      <div className="mt-6 py-8 text-center">
        <p className="text-muted text-sm">Loading agent info...</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Agent Info Header */}
      <div className="border-accent/30 bg-accent/5 rounded border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-accent text-sm font-medium">
                {metadata?.name ?? "Agent"} #{agentId.toString()}
              </p>
              {source && (
                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${
                  source === "ows" ? "border-accent/30 text-accent" : "border-border text-muted"
                }`}>
                  {source === "ows" ? "OWS Writer" : "Direct"}
                </span>
              )}
            </div>
            <p className="text-muted mt-0.5 text-xs">
              {role === "owner" ? "You own this agent" : "Your wallet is bound to this agent"}
            </p>
          </div>
          {isOwner && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="border-border text-muted hover:text-foreground rounded border px-3 py-1 text-xs transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="border-error/30 text-error rounded border px-3 py-2 text-xs">{error}</div>
      )}

      {successMessage && (
        <div className="border-accent/30 bg-accent/5 text-accent rounded border px-3 py-2 text-xs font-medium">
          {successMessage}
        </div>
      )}

      {txHash && (
        <div className="border-border text-muted rounded border px-3 py-2 text-xs">
          Tx:{" "}
          <a
            href={`${EXPLORER_URL}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </a>
        </div>
      )}

      {/* View / Edit Metadata */}
      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="text-foreground mb-2 block text-sm">Agent Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="border-border bg-surface text-foreground w-full rounded border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="text-foreground mb-2 block text-sm">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              className="border-border bg-surface text-foreground w-full resize-y rounded border px-3 py-2 text-sm leading-relaxed focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="text-foreground mb-2 block text-sm">Primary Genre</label>
            <Select value={editGenre} onChange={setEditGenre} placeholder="Select genre..." options={GENRES.map((g) => ({ value: g, label: g }))} />
          </div>
          <div>
            <label className="text-foreground mb-2 block text-sm">LLM Model</label>
            <Select value={editLlmModel} onChange={setEditLlmModel} placeholder="Select model..." options={LLM_MODELS.map((m) => ({ value: m, label: m }))} />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(false)}
              disabled={savingUri}
              className="border-border text-muted hover:text-foreground rounded border px-4 py-2 text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateUri}
              disabled={savingUri || !editName.trim()}
              className="border-accent text-accent hover:bg-accent hover:text-background flex-1 rounded border py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {savingUri ? "Saving..." : "Update Agent URI"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {metadata?.description && (
            <p className="text-foreground text-sm leading-relaxed">{metadata.description}</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs">
            {metadata?.genre && (
              <span className="border-border text-muted rounded border px-2 py-1">{metadata.genre}</span>
            )}
            {metadata?.llmModel && (
              <span className="border-border text-muted rounded border px-2 py-1">{metadata.llmModel}</span>
            )}
          </div>
        </div>
      )}

      {/* Wallet Info */}
      <div className="border-border rounded border divide-y divide-[var(--border)]">
        <div className="px-4 py-3">
          <p className="text-muted text-xs mb-1">Owner Wallet</p>
          <p className="text-foreground text-xs font-mono break-all">
            {ownerAddr ? (ownerAddr as string) : "—"}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-muted text-xs mb-1">Agent Wallet</p>
          <p className="text-foreground text-xs font-mono break-all">
            {currentAgentWallet && currentAgentWallet !== zeroAddress
              ? (currentAgentWallet as string)
              : "Not set"}
          </p>
        </div>
      </div>

      {/* Owner-only management actions */}
      {isOwner && !editing && (
        <div className="space-y-3">
          {/* Change Agent Wallet */}
          {!changingWallet ? (
            <div className="flex gap-3">
              <button
                onClick={() => { setChangingWallet(true); setWalletStep("enter"); setError(null); }}
                className="border-border text-muted hover:text-foreground flex-1 rounded border py-2 text-xs transition-colors"
              >
                {currentAgentWallet && currentAgentWallet !== zeroAddress ? "Change" : "Set"} Agent Wallet
              </button>
              {currentAgentWallet && currentAgentWallet !== zeroAddress && (
                <button
                  onClick={handleUnsetWallet}
                  disabled={unsettingWallet}
                  className="border-border text-muted hover:text-error rounded border px-4 py-2 text-xs transition-colors disabled:opacity-50"
                >
                  {unsettingWallet ? "Unsetting..." : "Unset Wallet"}
                </button>
              )}
            </div>
          ) : source === "ows" ? (
            /* OWS agents: paste-based flow (signature generated on local OWS app) */
            <div className="border-border rounded border p-4 space-y-4">
              <div>
                <label className="text-foreground mb-2 block text-sm">New OWS Wallet Address</label>
                <input type="text" value={newWalletAddr} onChange={(e) => setNewWalletAddr(e.target.value)} placeholder="0x..."
                  className="border-border bg-surface text-foreground placeholder:text-muted w-full rounded border px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none" />
              </div>
              <p className="text-muted text-xs leading-relaxed">
                Go to your OWS app &rarr; Settings &rarr; enter Agent ID <code className="text-accent">{agentId.toString()}</code> &rarr; click &quot;Generate Wallet Bind Code&quot;. Paste the signature and deadline below.
              </p>
              <div>
                <label className="text-foreground mb-1 block text-xs">Wallet Bind Signature</label>
                <input type="text" value={owsPastedSig} onChange={(e) => setOwsPastedSig(e.target.value)} placeholder="0x..."
                  className="border-border bg-surface text-foreground placeholder:text-muted w-full rounded border px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs">Deadline (unix timestamp)</label>
                <input type="text" value={owsPastedDeadline} onChange={(e) => setOwsPastedDeadline(e.target.value)} placeholder="e.g. 1712345678"
                  className="border-border bg-surface text-foreground placeholder:text-muted w-full rounded border px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setChangingWallet(false); setNewWalletAddr(""); setOwsPastedSig(""); setOwsPastedDeadline(""); }}
                  className="border-border text-muted hover:text-foreground rounded border px-4 py-2 text-xs transition-colors">Cancel</button>
                <button
                  onClick={async () => {
                    if (!newWalletAddr || !owsPastedSig || !owsPastedDeadline) return;
                    try {
                      setError(null);
                      setSubmittingWallet(true);
                      const hash = await writeContractAsync({
                        address: ERC8004_REGISTRY,
                        abi: erc8004Abi,
                        functionName: "setAgentWallet",
                        args: [agentId, newWalletAddr as Address, BigInt(owsPastedDeadline), owsPastedSig as Hex],
                      });
                      setTxHash(hash);
                      await publicClient.waitForTransactionReceipt({ hash });
                      fetch("/api/user/agent-update", { method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ walletAddress: address, fields: { agent_wallet: newWalletAddr.toLowerCase() } }),
                      }).catch(() => {});
                      setSuccessMessage("Agent wallet updated");
                      setChangingWallet(false); setNewWalletAddr(""); setOwsPastedSig(""); setOwsPastedDeadline("");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Wallet binding failed");
                    } finally {
                      setSubmittingWallet(false);
                    }
                  }}
                  disabled={submittingWallet || !newWalletAddr.match(/^0x[a-fA-F0-9]{40}$/) || !owsPastedSig.startsWith("0x") || !owsPastedDeadline}
                  className="border-accent text-accent hover:bg-accent hover:text-background flex-1 rounded border py-2 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {submittingWallet ? "Binding..." : "Submit Wallet Binding"}
                </button>
              </div>
            </div>
          ) : (
            /* Direct agents: browser-based sign flow (existing) */
            <div className="border-border rounded border p-4 space-y-4">
              {walletStep === "enter" && (
                <>
                  <div>
                    <label className="text-foreground mb-2 block text-sm">New Agent Wallet Address</label>
                    <input
                      type="text"
                      value={newWalletAddr}
                      onChange={(e) => setNewWalletAddr(e.target.value)}
                      placeholder="0x..."
                      className="border-border bg-surface text-foreground placeholder:text-muted w-full rounded border px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none"
                    />
                  </div>
                  <p className="text-muted text-xs leading-relaxed">
                    The new agent wallet must sign an EIP-712 message. Switch to that wallet and sign within 5 minutes.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setChangingWallet(false); setWalletStep(null); setNewWalletAddr(""); }}
                      className="border-border text-muted hover:text-foreground rounded border px-4 py-2 text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setWalletStep("sign")}
                      disabled={!newWalletAddr.match(/^0x[a-fA-F0-9]{40}$/)}
                      className="border-accent text-accent hover:bg-accent hover:text-background flex-1 rounded border py-2 text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      Continue
                    </button>
                  </div>
                </>
              )}

              {walletStep === "sign" && (
                <>
                  <div className="border-border bg-surface rounded border px-4 py-3 space-y-2">
                    <p className="text-foreground text-sm font-medium">Switch to the new agent wallet</p>
                    <p className="text-accent text-xs font-mono break-all">{newWalletAddr}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${isNewWalletConnected ? "bg-accent" : "bg-border"}`} />
                    <span className="text-muted text-xs">
                      {isNewWalletConnected ? (
                        <span className="text-accent">New wallet connected. Ready to sign.</span>
                      ) : (
                        <>Currently: <code className="text-foreground font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</code></>
                      )}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setWalletStep("enter")}
                      disabled={signingWallet}
                      className="border-border text-muted hover:text-foreground rounded border px-4 py-2 text-xs transition-colors disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSignNewWallet}
                      disabled={signingWallet || !isNewWalletConnected}
                      className="border-accent text-accent hover:bg-accent hover:text-background flex-1 rounded border py-2 text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {signingWallet ? "Signing..." : "Sign with New Wallet"}
                    </button>
                  </div>
                </>
              )}

              {walletStep === "submit" && (
                <>
                  <div className="border-accent/30 bg-accent/5 rounded border px-4 py-3">
                    <p className="text-accent text-sm font-medium">Signature obtained</p>
                  </div>
                  <div className="border-border bg-surface rounded border px-4 py-3 space-y-2">
                    <p className="text-foreground text-sm font-medium">Switch back to the owner wallet</p>
                    <p className="text-accent text-xs font-mono break-all">{ownerAddr as string}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${isOwnerConnected ? "bg-accent" : "bg-border"}`} />
                    <span className="text-muted text-xs">
                      {isOwnerConnected ? (
                        <span className="text-accent">Owner wallet connected. Ready to submit.</span>
                      ) : (
                        <>Currently: <code className="text-foreground font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</code></>
                      )}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setChangingWallet(false); setWalletStep(null); }}
                      disabled={submittingWallet}
                      className="border-border text-muted hover:text-foreground rounded border px-4 py-2 text-xs transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitNewWallet}
                      disabled={submittingWallet || !isOwnerConnected}
                      className="border-accent text-accent hover:bg-accent hover:text-background flex-1 rounded border py-2 text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {submittingWallet ? "Binding..." : "Submit Binding Transaction"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/** Wrapper that enumerates all agents owned by the connected wallet */
export function AgentManageAll() {
  const { address } = useAccount();

  const { data: balance, isLoading: balanceLoading } = useReadContract({
    address: ERC8004_REGISTRY,
    abi: erc8004Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const agentCount = balance !== undefined ? Number(balance) : 0;

  const tokenIndexCalls = useMemo(() => {
    if (!address || agentCount === 0) return [];
    return Array.from({ length: agentCount }, (_, i) => ({
      address: ERC8004_REGISTRY,
      abi: erc8004Abi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [address, BigInt(i)] as const,
    }));
  }, [address, agentCount]);

  const { data: tokenResults, isLoading: tokensLoading } = useReadContracts({
    contracts: tokenIndexCalls,
    query: { enabled: tokenIndexCalls.length > 0 },
  });

  const agentIds = useMemo(() => {
    if (!tokenResults) return [];
    return tokenResults
      .filter((r) => r.status === "success" && r.result !== undefined)
      .map((r) => r.result as bigint);
  }, [tokenResults]);

  // Fetch agentURI + getAgentWallet for each agent to determine source
  const metaCalls = useMemo(() => {
    if (agentIds.length === 0) return [];
    return agentIds.flatMap((id) => [
      { address: ERC8004_REGISTRY, abi: erc8004Abi, functionName: "agentURI" as const, args: [id] as const },
      { address: ERC8004_REGISTRY, abi: erc8004Abi, functionName: "getAgentWallet" as const, args: [id] as const },
    ]);
  }, [agentIds]);

  const { data: metaResults, isLoading: metaLoading } = useReadContracts({
    contracts: metaCalls,
    query: { enabled: metaCalls.length > 0 },
  });

  const agents = useMemo(() => {
    if (agentIds.length === 0 || !metaResults) return [];
    return agentIds.map((id, i) => {
      const uriResult = metaResults[i * 2];
      const walletResult = metaResults[i * 2 + 1];
      let source: "ows" | "direct" = "direct";
      if (uriResult?.status === "success" && uriResult.result) {
        try {
          const meta = JSON.parse(uriResult.result as string);
          if (meta.type === "ows-writer" || meta.owsWallet) source = "ows";
        } catch { /* not JSON */ }
      }
      const walletAddr = walletResult?.status === "success" ? (walletResult.result as string) : undefined;
      if (walletAddr && walletAddr !== ZERO_ADDR) source = "ows";
      return { agentId: id, source };
    });
  }, [agentIds, metaResults]);

  // Also check if connected wallet is an agent wallet
  const { data: selfAgentId } = useReadContract({
    address: ERC8004_REGISTRY,
    abi: erc8004Abi,
    functionName: "agentIdByWallet",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const isSelfAgent = selfAgentId !== undefined && selfAgentId > BigInt(0);
  const selfInList = agents.some((a) => a.agentId === selfAgentId);

  const isLoading = balanceLoading || tokensLoading || metaLoading;

  if (isLoading) {
    return (
      <div className="mt-6 py-8 text-center">
        <p className="text-muted text-sm">Loading agents...</p>
      </div>
    );
  }

  const hasAgents = agents.length > 0 || (isSelfAgent && !selfInList);

  if (!hasAgents) {
    return (
      <div className="mt-6 py-8 text-center">
        <p className="text-muted text-sm mb-2">You have no AI agents registered.</p>
        <p className="text-muted text-xs">
          Switch to the <span className="text-accent font-medium">Register</span> tab to register an agent.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-8">
      {agents.map((agent) => (
        <AgentManage key={agent.agentId.toString()} agentId={agent.agentId} role="owner" source={agent.source} />
      ))}
      {isSelfAgent && !selfInList && (
        <AgentManage agentId={selfAgentId} role="agentWallet" source="direct" />
      )}
    </div>
  );
}
