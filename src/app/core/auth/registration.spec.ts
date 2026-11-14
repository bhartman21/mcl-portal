import {
  buildNewUserProfile,
  initialStatusForMode,
  normalizeRegistrationMode,
} from './registration';

describe('registration mode logic', () => {
  it('treats a missing or unknown mode as open', () => {
    expect(normalizeRegistrationMode(undefined)).toBe('open');
    expect(normalizeRegistrationMode(null)).toBe('open');
    expect(normalizeRegistrationMode('bogus')).toBe('open');
    expect(normalizeRegistrationMode('open')).toBe('open');
    expect(normalizeRegistrationMode('approval')).toBe('approval');
  });

  it('auto-activates new users while mode is open', () => {
    expect(initialStatusForMode('open')).toBe('active');
    expect(initialStatusForMode(undefined)).toBe('active');
  });

  it('makes new users pending while mode is approval', () => {
    expect(initialStatusForMode('approval')).toBe('pending');
  });

  it('builds a member-only profile with no detachment scopes', () => {
    const p = buildNewUserProfile(
      { uid: 'u1', email: 'a@example.com', displayName: null },
      'open',
      '2026-11-14T00:00:00Z'
    );
    expect(p).toEqual({
      uid: 'u1',
      email: 'a@example.com',
      displayName: undefined,
      status: 'active',
      roles: ['member'],
      detachmentScopes: [],
      createdAt: '2026-11-14T00:00:00Z',
      updatedAt: '2026-11-14T00:00:00Z',
    });
    expect(buildNewUserProfile({ uid: 'u2', email: 'b@example.com' }, 'approval').status).toBe(
      'pending'
    );
  });
});
