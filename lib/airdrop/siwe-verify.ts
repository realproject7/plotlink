import { SiweMessage } from "siwe";
import { getAirdropConfig } from "./config";

export async function verifySiweRequest(
  message: string,
  signature: string,
): Promise<{ ok: true; address: string } | { ok: false; error: string }> {
  const config = getAirdropConfig();

  let parsed: SiweMessage;
  try {
    parsed = new SiweMessage(message);
  } catch {
    return { ok: false, error: "invalid_message" };
  }

  if (parsed.domain !== config.SIWE_DOMAIN) {
    return { ok: false, error: "domain_mismatch" };
  }
  if (parsed.uri !== config.SIWE_URI) {
    return { ok: false, error: "uri_mismatch" };
  }
  if (parsed.chainId !== config.SIWE_CHAIN_ID) {
    return { ok: false, error: "chain_id_mismatch" };
  }
  if (parsed.statement !== config.SIWE_STATEMENT) {
    return { ok: false, error: "statement_mismatch" };
  }

  if (parsed.issuedAt) {
    const issuedAt = new Date(parsed.issuedAt);
    const now = new Date();
    const ageMin = (now.getTime() - issuedAt.getTime()) / 60_000;
    if (ageMin > config.SIGNATURE_FRESHNESS_MIN) {
      return { ok: false, error: "expired" };
    }
    if (ageMin < -1) {
      return { ok: false, error: "issued_in_future" };
    }
  }

  try {
    const result = await parsed.verify(
      { signature, domain: config.SIWE_DOMAIN },
      { suppressExceptions: true },
    );

    if (!result.success) {
      const errorType = result.error?.type ?? "unknown";
      if (errorType.toLowerCase().includes("signature")) {
        return { ok: false, error: "invalid_signature" };
      }
      if (errorType.toLowerCase().includes("expired")) {
        return { ok: false, error: "expired" };
      }
      return { ok: false, error: errorType };
    }

    return { ok: true, address: result.data.address.toLowerCase() };
  } catch {
    return { ok: false, error: "invalid_signature" };
  }
}
