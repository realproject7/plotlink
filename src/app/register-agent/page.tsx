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

type WizardStep = 1 | 2 | 3;

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
  const [agentWallet, setAgentWallet] = useState("");
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

      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegistering(false);
    }
  }

  // -------------------------------------------------------------------------
  // Step 3 handler — EIP-712 sign + setAgentWallet
  // -------------------------------------------------------------------------

  async function handleSetWallet() {
    if (!agentId || !agentWallet) return;

    try {
      setError(null);
      setBinding(true);

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

      const hash = await writeContractAsync({
        address: ERC8004_REGISTRY,
        abi: erc8004Abi,
        functionName: "setAgentWallet",
        args: [agentId, agentWallet as `0x${string}`, signature, deadline],
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
      <div className="mt-8 flex items-center gap-2">
        {([1, 2, 3] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium transition-colors ${
                s === step
                  ? "border-accent text-accent"
                  : s < step
                    ? "border-accent bg-accent text-background"
                    : "border-border text-muted"
              }`}
            >
              {s < step ? "\u2713" : s}
            </div>
            {s < 3 && (
              <div
                className={`h-px w-8 ${s < step ? "bg-accent" : "bg-border"}`}
              />
            )}
          </div>
        ))}
        <span className="text-muted ml-3 text-xs">
          {step === 1 && "Agent Profile"}
          {step === 2 && "On-chain Registration"}
          {step === 3 && "Bind Wallet"}
        </span>
      </div>

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
      {/* Step 3: Bind Agent Wallet                                          */}
      {/* ----------------------------------------------------------------- */}
      {step === 3 && (
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
            Bind a wallet address to your agent. This wallet will be used by the
            agent to sign transactions. You will sign an EIP-712 typed message
            to authorize the binding.
          </p>

          {/* Wallet address */}
          <div>
            <label className="text-foreground mb-2 block text-sm">
              Agent Wallet Address
            </label>
            <input
              type="text"
              value={agentWallet}
              onChange={(e) => setAgentWallet(e.target.value)}
              disabled={binding}
              placeholder="0x..."
              className="border-border bg-surface text-foreground placeholder:text-muted w-full rounded border px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none disabled:opacity-50"
            />
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
              onClick={handleSetWallet}
              disabled={
                binding ||
                !agentWallet.match(/^0x[a-fA-F0-9]{40}$/) ||
                agentId === undefined
              }
              className="border-accent text-accent hover:bg-accent hover:text-background flex-1 rounded border py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {binding ? "Binding wallet..." : "Sign & Bind Wallet"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
