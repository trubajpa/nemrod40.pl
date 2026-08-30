export function normalizeAuthorizedUserEmail(email: string) {
  return email.trim().toLowerCase()
}

export function authorizedUserIdentityMatches(tokenEmail: string, documentId: string) {
  return tokenEmail === documentId
}

export function isAuthorizedMemberProfile(value: unknown): value is { active: true; displayName: string; role?: string } {
  if (!value || typeof value !== 'object') return false
  const profile = value as { active?: unknown; displayName?: unknown }
  return profile.active === true && typeof profile.displayName === 'string' && Boolean(profile.displayName.trim())
}
