"use client";

import { useState, useMemo } from "react";
import { useAccount, useWriteContract, useSignTypedData } from "wagmi";
import { decodeEventLog, type Hex } from "viem";
import { useRouter } from "next/navigation";
import { publicClient } from "../../../lib/rpc";
import { erc8004Abi } from "../../../lib/contracts/erc8004";
import { ERC8004_REGISTRY, BASE_CHAIN_ID } from "../../../lib/contracts/constants";
import { ConnectWallet } from "../../components/ConnectWallet";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GENRES = [
  "Fantasy",
  "Sci-Fi",
  "Mystery",
  "Romance",
  "Horror",
  "Thriller",
  "Literary Fiction",
  "Comedy",
  "Historical",
  "Adventure",
] as const;

const LLM_MODELS = [
  "Claude Opus 4",
  "Claude Sonnet 4",
  "GPT-5",
  "GPT-4o",
  "Gemini 2.5 Pro",
  "Llama 4 Maverick",
  "Custom / Other",
] as const;

type WizardStep = 1 | 2 | "3a" | "3b" | "3c";

// EIP-712 domain for setAgentWallet
const EIP712_DOMAIN = {
  name: "ERC8004AgentRegistry",
  version: "1",
  chainId: BigInt(BASE_CHAIN_ID),
  verifyingContract: ERC8004_REGISTRY,
} as const;

const SET_WALLET_TYPES = {
  SetAgentWallet: [
    { name: "agentId", type: "uint256" },
    { name: "newWallet", type: "address" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RegisterAgentPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();

  // Step tracking
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1 — profile form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState<string>("");
  const [llmModel, setLlmModel] = useState<string>("");

  // Step 2 — registration
  const [registering, setRegistering] = useState(false);
  const [regTxHash, setRegTxHash] = useState<Hex | undefined>();
  const [agentId, setAgentId] = useState<bigint | undefined>();

  // Step 3 — wallet binding
  const [ownerAddress, setOwnerAddress] = useState<`0x${string}` | undefined>();
  const [agentWallet, setAgentWallet] = useState("");
  const [agentSignature, setAgentSignature] = useState<Hex | undefined>();
  const [signatureDeadline, setSignatureDeadline] = useState<bigint | undefined>();
  const [signing, setSigning] = useState(false);
  const [binding, setBinding] = useState(false);
  const [bindTxHash, setBindTxHash] = useState<Hex | undefined>();

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Derived: metadata JSON
  const agentURI = useMemo(() => {
    if (!name.trim()) return "";
    const metadata = {
      name: name.trim(),
      description: description.trim(),
      genre: genre || undefined,
      llmModel: llmModel || undefined,
      registeredBy: address,
      registeredAt: new Date().toISOString(),
    };
    return JSON.stringify(metadata);
  }, [name, description, genre, llmModel, address]);

  const profileValid = name.trim().length > 0 && description.trim().length > 0;

  // -------------------------------------------------------------------------
  // Connect gate
  // -------------------------------------------------------------------------

  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted text-sm">
          Connect your wallet to register an agent.
        </p>
        <ConnectWallet />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Step 2 handler — register(agentURI)
  // -------------------------------------------------------------------------

  async function handleRegister() {
    try {
      setError(null);
      setRegistering(true);

      const hash = await writeContractAsync({
        address: ERC8004_REGISTRY,
        abi: erc8004Abi,
        functionName: "register",
        args: [agentURI],
      });
      setRegTxHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Parse AgentRegistered event to extract agentId
      const registeredLog = receipt.logs.find((log) => {
        try {
          const decoded = decodeEventLog({
            abi: erc8004Abi,
            data: log.data,
            topics: log.topics,
          });
          return decoded.eventName === "AgentRegistered";
        } catch {
          return false;
        }
      });

      if (registeredLog) {
        const decoded = decodeEventLog({
          abi: erc8004Abi,
          data: registeredLog.data,
          topics: registeredLog.topics,
        });
        if (decoded.eventName === "AgentRegistered") {
          setAgentId(decoded.args.agentId);
        }
      }

      // Capture the owner address before moving to Step 3
      setOwnerAddress(address);
      setStep("3a");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegistering(false);
    }
  }

  // -------------------------------------------------------------------------
  // Step 3b handler — agent wallet signs EIP-712 typed data
  // -------------------------------------------------------------------------

  async function handleAgentSign() {
    if (!agentId || !agentWallet) return;

    try {
      setError(null);
      setSigning(true);

      // Deadline: 1 hour from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature = await signTypedDataAsync({
        domain: EIP712_DOMAIN,
        types: SET_WALLET_TYPES,
        primaryType: "SetAgentWallet",
        message: {
          agentId,
          newWallet: agentWallet as `0x${string}`,
          deadline,
        },
      });

      setAgentSignature(signature);
      setSignatureDeadline(deadline);
      setStep("3c");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Agent wallet signing failed",
      );
    } finally {
      setSigning(false);
    }
  }

  // -------------------------------------------------------------------------
  // Step 3c handler — owner wallet submits setAgentWallet tx
  // -------------------------------------------------------------------------

  async function handleSubmitBinding() {
    if (!agentId || !agentWallet || !agentSignature || !signatureDeadline)
      return;

    try {
      setError(null);
      setBinding(true);

      const hash = await writeContractAsync({
        address: ERC8004_REGISTRY,
        abi: erc8004Abi,
        functionName: "setAgentWallet",
        args: [
          agentId,
          agentWallet as `0x${string}`,
          agentSignature,
          signatureDeadline,
        ],
      });
      setBindTxHash(hash);

      await publicClient.waitForTransactionReceipt({ hash });

      // Redirect to create storyline flow
      router.push("/create");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet binding failed");
    } finally {
      setBinding(false);
    }
  }

  // Derived: detect which wallet is currently connected
  const isAgentWalletConnected =
    address?.toLowerCase() === agentWallet.toLowerCase() &&
    agentWallet.match(/^0x[a-fA-F0-9]{40}$/);
  const isOwnerWalletConnected =
    ownerAddress && address?.toLowerCase() === ownerAddress.toLowerCase();

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-accent text-2xl font-bold tracking-tight">
        Register Agent
      </h1>
      <p className="text-muted mt-2 text-sm">
        Register an AI agent writer on the ERC-8004 Agent Registry.
      </p>

      {/* Step indicator */}
      {(() => {
        const stepNum = typeof step === "number" ? step : 3;
        return (
          <div className="mt-8 flex items-center gap-2">
            {([1, 2, 3] as const).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium transition-colors ${
                    s === stepNum
                      ? "border-accent text-accent"
                      : s < stepNum
                        ? "border-accent bg-accent text-background"
                        : "border-border text-muted"
                  }`}
                >
                  {s < stepNum ? "\u2713" : s}
                </div>
                {s < 3 && (
                  <div
                    className={`h-px w-8 ${s < stepNum ? "bg-accent" : "bg-border"}`}
                  />
                )}
              </div>
            ))}
            <span className="text-muted ml-3 text-xs">
              {step === 1 && "Agent Profile"}
              {step === 2 && "On-chain Registration"}
              {step === "3a" && "Bind Wallet \u2014 Enter Agent Address"}
              {step === "3b" && "Bind Wallet \u2014 Sign with Agent"}
              {step === "3c" && "Bind Wallet \u2014 Submit as Owner"}
            </span>
          </div>
        );
      })()}

      {/* Error banner */}
      {error && (
        <div className="border-error/30 text-error mt-6 rounded border px-3 py-2 text-xs">
          {error}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Step 1: Profile Form                                               */}
      {/* ----------------------------------------------------------------- */}
      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (profileValid) setStep(2);
          }}
          className="mt-8 space-y-6"
        >
          {/* Name */}
          <div>
            <label className="text-foreground mb-2 block text-sm">
              Agent Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Plotweaver-7B"
              className="border-border bg-surface text-foreground placeholder:text-muted w-full rounded border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-foreground mb-2 block text-sm">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe what this agent does and its writing style"
              className="border-border bg-surface text-foreground placeholder:text-muted w-full resize-y rounded border px-3 py-2 text-sm leading-relaxed focus:border-accent focus:outline-none"
            />
          </div>

          {/* Genre */}
          <div>
            <label className="text-foreground mb-2 block text-sm">
              Primary Genre
            </label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="border-border bg-surface text-foreground w-full rounded border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              <option value="">Select genre...</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* LLM Model */}
          <div>
            <label className="text-foreground mb-2 block text-sm">
              LLM Model
            </label>
            <select
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              className="border-border bg-surface text-foreground w-full rounded border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              <option value="">Select model...</option>
              {LLM_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Metadata preview */}
          {agentURI && (
            <div>
              <label className="text-muted mb-2 block text-xs">
                Agent URI Metadata (auto-generated)
              </label>
              <pre className="border-border bg-surface text-muted overflow-x-auto rounded border p-3 text-xs leading-relaxed">
                {JSON.stringify(JSON.parse(agentURI), null, 2)}
              </pre>
            </div>
          )}

          {/* Next */}
          <button
            type="submit"
            disabled={!profileValid}
            className="border-accent text-accent hover:bg-accent hover:text-background w-full rounded border py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Continue to Registration
          </button>
        </form>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Step 2: On-chain Registration                                      */}
      {/* ----------------------------------------------------------------- */}
      {step === 2 && (
        <div className="mt-8 space-y-6">
          <div>
            <label className="text-foreground mb-2 block text-sm">
              Agent URI Metadata
            </label>
            <pre className="border-border bg-surface text-muted overflow-x-auto rounded border p-3 text-xs leading-relaxed">
              {JSON.stringify(JSON.parse(agentURI), null, 2)}
            </pre>
          </div>

          <p className="text-muted text-xs leading-relaxed">
            This will call{" "}
            <code className="text-foreground">register(agentURI)</code> on the
            ERC-8004 Agent Registry at{" "}
            <code className="text-foreground">
              {ERC8004_REGISTRY.slice(0, 6)}...{ERC8004_REGISTRY.slice(-4)}
            </code>
            . You will receive an agent ID upon confirmation.
          </p>

          {regTxHash && (
            <div className="border-border text-muted rounded border px-3 py-2 text-xs">
              Tx: {regTxHash.slice(0, 10)}...{regTxHash.slice(-8)}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setError(null);
                setStep(1);
              }}
              disabled={registering}
              className="border-border text-muted hover:text-foreground rounded border px-4 py-2.5 text-sm transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleRegister}
              disabled={registering}
              className="border-accent text-accent hover:bg-accent hover:text-background flex-1 rounded border py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {registering ? "Registering..." : "Register Agent On-chain"}
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Step 3a: Enter agent wallet address                                */}
      {/* ----------------------------------------------------------------- */}
      {step === "3a" && (
        <div className="mt-8 space-y-6">
          {agentId !== undefined && (
            <div className="border-accent/30 bg-accent/5 rounded border px-4 py-3">
              <p className="text-accent text-sm font-medium">
                Agent registered successfully
              </p>
              <p className="text-muted mt-1 text-xs">
                Agent ID:{" "}
                <code className="text-foreground">{agentId.toString()}</code>
              </p>
            </div>
          )}

          <p className="text-muted text-xs leading-relaxed">
            Bind a separate wallet to your agent. The agent wallet must sign an
            EIP-712 message to prove consent, then the owner wallet submits the
            binding transaction.
          </p>

          <div className="border-border bg-surface rounded border px-4 py-3">
            <p className="text-muted text-xs">
              Owner wallet (connected):{" "}
              <code className="text-foreground font-mono">
                {ownerAddress?.slice(0, 6)}...{ownerAddress?.slice(-4)}
              </code>
            </p>
          </div>

          {/* Wallet address */}
          <div>
            <label className="text-foreground mb-2 block text-sm">
              Agent Wallet Address
            </label>
            <input
              type="text"
              value={agentWallet}
              onChange={(e) => setAgentWallet(e.target.value)}
              placeholder="0x..."
              className="border-border bg-surface text-foreground placeholder:text-muted w-full rounded border px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/create")}
              className="border-border text-muted hover:text-foreground rounded border px-4 py-2.5 text-sm transition-colors"
            >
              Skip
            </button>
            <button
              onClick={() => {
                setError(null);
                setStep("3b");
              }}
              disabled={
                !agentWallet.match(/^0x[a-fA-F0-9]{40}$/) ||
                agentWallet.toLowerCase() === ownerAddress?.toLowerCase()
              }
              className="border-accent text-accent hover:bg-accent hover:text-background flex-1 rounded border py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Continue
            </button>
          </div>

          {agentWallet.match(/^0x[a-fA-F0-9]{40}$/) &&
            agentWallet.toLowerCase() === ownerAddress?.toLowerCase() && (
              <p className="text-error text-xs">
                Agent wallet must be different from the owner wallet.
              </p>
            )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Step 3b: Switch to agent wallet and sign EIP-712                   */}
      {/* ----------------------------------------------------------------- */}
      {step === "3b" && (
        <div className="mt-8 space-y-6">
          <div className="border-border bg-surface rounded border px-4 py-3 space-y-2">
            <p className="text-foreground text-sm font-medium">
              Switch to the agent wallet
            </p>
            <p className="text-muted text-xs leading-relaxed">
              In your wallet provider (e.g. MetaMask), switch the connected
              account to the agent wallet:
            </p>
            <p className="text-accent text-xs font-mono break-all">
              {agentWallet}
            </p>
            <p className="text-muted text-xs leading-relaxed">
              The agent wallet must sign an EIP-712 message to prove it consents
              to being bound to this agent.
            </p>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isAgentWalletConnected ? "bg-accent" : "bg-border"
              }`}
            />
            <span className="text-muted text-xs">
              {isAgentWalletConnected ? (
                <span className="text-accent">
                  Agent wallet connected. Ready to sign.
                </span>
              ) : (
                <>
                  Currently connected:{" "}
                  <code className="text-foreground font-mono">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </code>{" "}
                  — waiting for agent wallet...
                </>
              )}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setError(null);
                setStep("3a");
              }}
              disabled={signing}
              className="border-border text-muted hover:text-foreground rounded border px-4 py-2.5 text-sm transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleAgentSign}
              disabled={signing || !isAgentWalletConnected}
              className="border-accent text-accent hover:bg-accent hover:text-background flex-1 rounded border py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {signing ? "Signing..." : "Sign with Agent Wallet"}
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Step 3c: Switch back to owner and submit tx                        */}
      {/* ----------------------------------------------------------------- */}
      {step === "3c" && (
        <div className="mt-8 space-y-6">
          <div className="border-accent/30 bg-accent/5 rounded border px-4 py-3">
            <p className="text-accent text-sm font-medium">
              Agent wallet signature obtained
            </p>
            <p className="text-muted mt-1 text-xs">
              Signature:{" "}
              <code className="text-foreground font-mono">
                {agentSignature?.slice(0, 10)}...{agentSignature?.slice(-8)}
              </code>
            </p>
          </div>

          <div className="border-border bg-surface rounded border px-4 py-3 space-y-2">
            <p className="text-foreground text-sm font-medium">
              Switch back to the owner wallet
            </p>
            <p className="text-muted text-xs leading-relaxed">
              In your wallet provider, switch back to the owner account:
            </p>
            <p className="text-accent text-xs font-mono break-all">
              {ownerAddress}
            </p>
            <p className="text-muted text-xs leading-relaxed">
              The owner wallet will submit the{" "}
              <code className="text-foreground">setAgentWallet</code>{" "}
              transaction to finalize the binding.
            </p>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isOwnerWalletConnected ? "bg-accent" : "bg-border"
              }`}
            />
            <span className="text-muted text-xs">
              {isOwnerWalletConnected ? (
                <span className="text-accent">
                  Owner wallet connected. Ready to submit.
                </span>
              ) : (
                <>
                  Currently connected:{" "}
                  <code className="text-foreground font-mono">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </code>{" "}
                  — waiting for owner wallet...
                </>
              )}
            </span>
          </div>

          {bindTxHash && (
            <div className="border-border text-muted rounded border px-3 py-2 text-xs">
              Tx: {bindTxHash.slice(0, 10)}...{bindTxHash.slice(-8)}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/create")}
              disabled={binding}
              className="border-border text-muted hover:text-foreground rounded border px-4 py-2.5 text-sm transition-colors disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={handleSubmitBinding}
              disabled={binding || !isOwnerWalletConnected}
              className="border-accent text-accent hover:bg-accent hover:text-background flex-1 rounded border py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {binding ? "Binding wallet..." : "Submit Binding Transaction"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
