export const EXPECTED_SAMPLES = 7;
export const MINIMUM_SAMPLES = 5;
export const OVERRIDE_ENV = "AIRDROP_FINALIZE_ALLOW_PARTIAL_TWAP";

export function validateTwapSamples(
  count: number,
  overrideEnabled: boolean,
): { ok: true; warning?: string } | { ok: false; error: string } {
  if (count === 0) {
    return { ok: false, error: "No daily price entries found for TWAP window" };
  }
  if (count < MINIMUM_SAMPLES && !overrideEnabled) {
    return {
      ok: false,
      error:
        `TWAP requires >=${MINIMUM_SAMPLES} daily samples, got ${count}. ` +
        `Investigate pl_daily_prices cron coverage OR set ${OVERRIDE_ENV}=1 to proceed with partial data.`,
    };
  }
  if (count < EXPECTED_SAMPLES) {
    return {
      ok: true,
      warning: `TWAP using ${count} samples (expected ${EXPECTED_SAMPLES}). Verify pl_daily_prices cron coverage.`,
    };
  }
  return { ok: true };
}
