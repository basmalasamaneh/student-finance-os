import { ApiError } from "./http-errors.ts";

export function positive(v: { minor: number; currency: string }): bigint {
  if (!Number.isSafeInteger(v.minor) || v.minor <= 0) throw new ApiError("BAD_REQUEST");
  return BigInt(v.minor);
}
export function checked(n: bigint, overflowCode: "CONFLICT" | "BAD_REQUEST" = "CONFLICT"): bigint {
  if (n < 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) throw new ApiError(overflowCode);
  return n;
}