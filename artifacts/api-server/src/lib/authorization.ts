import { ApiError } from "./http-errors.ts";

// Server-side identity only. A future verified session/auth adapter may supply
// this value; never construct it from request body, query, or role headers.
export interface TrustedPrincipal {
  readonly userId: string;
  readonly roles: readonly string[];
}

export function requirePrincipal(principal: TrustedPrincipal | null | undefined): TrustedPrincipal {
  if (!principal || typeof principal.userId !== "string" || !principal.userId.trim() ||
      !Array.isArray(principal.roles)) {
    throw new ApiError("UNAUTHENTICATED");
  }
  return principal;
}

export function requireRole(
  principal: TrustedPrincipal | null | undefined,
  role: string,
): TrustedPrincipal {
  const authenticated = requirePrincipal(principal);
  if (!role || !authenticated.roles.includes(role)) throw new ApiError("FORBIDDEN");
  return authenticated;
}

export function requireOwner(
  principal: TrustedPrincipal | null | undefined,
  ownerUserId: string,
): TrustedPrincipal {
  const authenticated = requirePrincipal(principal);
  if (!ownerUserId || authenticated.userId !== ownerUserId) throw new ApiError("FORBIDDEN");
  return authenticated;
}