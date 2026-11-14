import { RegistrationMode, RoleId, UserProfile, UserStatus } from '../models/user.model';

/** Roles a brand-new sign-in may give itself (also enforced in firestore.rules). */
export const NEW_USER_ROLES: readonly RoleId[] = ['member'];

/** Missing or unknown settings/registration.mode is treated as 'open' (the documented default). */
export function normalizeRegistrationMode(value: unknown): RegistrationMode {
  return value === 'approval' ? 'approval' : 'open';
}

/** open → active member; approval → pending (no write access until an admin approves). */
export function initialStatusForMode(mode: RegistrationMode | null | undefined): UserStatus {
  return normalizeRegistrationMode(mode) === 'approval' ? 'pending' : 'active';
}

/** The profile a first-time sign-in writes to users/{uid}. Must satisfy the users create rule. */
export function buildNewUserProfile(
  input: { uid: string; email: string; displayName?: string | null },
  mode: RegistrationMode | null | undefined,
  nowIso: string = new Date().toISOString()
): UserProfile {
  return {
    uid: input.uid,
    email: input.email,
    displayName: input.displayName ?? undefined,
    status: initialStatusForMode(mode),
    roles: [...NEW_USER_ROLES],
    detachmentScopes: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}
