import { RoleId } from '../models/user.model';
import { canManageUser, grantableRoles, NON_ADMIN_ROLES, roleOptionsFor } from './role-grants';

const actor = (roles: RoleId[], patch: { uid?: string; status?: string } = {}) => ({
  uid: 'actor',
  status: 'active',
  roles,
  ...patch,
});
const target = (roles: RoleId[], uid = 'target') => ({ uid, roles });

describe('admin grant hierarchy (UI role options)', () => {
  it('siteAdmin can grant every role, including siteAdmin', () => {
    expect(grantableRoles(['member', 'siteAdmin']).sort()).toEqual(
      [...NON_ADMIN_ROLES, 'departmentAdmin', 'nationalAdmin', 'siteAdmin'].sort()
    );
  });

  it('nationalAdmin can grant national and department admin plus non-admin roles, not siteAdmin', () => {
    const roles = grantableRoles(['member', 'nationalAdmin']);
    expect(roles).toContain('nationalAdmin');
    expect(roles).toContain('departmentAdmin');
    expect(roles).not.toContain('siteAdmin');
    NON_ADMIN_ROLES.forEach((r) => expect(roles).toContain(r));
  });

  it('departmentAdmin can grant department admin plus non-admin roles only', () => {
    const roles = grantableRoles(['member', 'departmentAdmin']);
    expect(roles).toContain('departmentAdmin');
    expect(roles).not.toContain('nationalAdmin');
    expect(roles).not.toContain('siteAdmin');
    NON_ADMIN_ROLES.forEach((r) => expect(roles).toContain(r));
  });

  it('non-admins grant nothing', () => {
    for (const r of [['member'], ['member', 'adBookApprover'], ['departmentVavsRep'], []] as RoleId[][]) {
      expect(grantableRoles(r)).toEqual([]);
    }
    expect(grantableRoles(undefined)).toEqual([]);
  });

  it('the highest admin role wins when a user holds several', () => {
    expect(grantableRoles(['departmentAdmin', 'siteAdmin'])).toContain('siteAdmin');
    expect(grantableRoles(['departmentAdmin', 'nationalAdmin'])).toContain('nationalAdmin');
  });

  it('roleOptionsFor offers only grantable roles, in catalog order', () => {
    expect(roleOptionsFor(actor(['member', 'departmentAdmin'])).map((o) => o.id)).toEqual([
      'member',
      'detachmentVavsRep',
      'departmentVavsRep',
      'adBookApprover',
      'departmentAdmin',
    ]);
    expect(roleOptionsFor(actor(['nationalAdmin'])).map((o) => o.id)).toEqual([
      'member',
      'detachmentVavsRep',
      'departmentVavsRep',
      'adBookApprover',
      'departmentAdmin',
      'nationalAdmin',
    ]);
    expect(roleOptionsFor(actor(['siteAdmin'])).map((o) => o.id)).toContain('siteAdmin');
    expect(roleOptionsFor(actor(['member']))).toEqual([]);
  });

  it('pending or suspended admins get no options and cannot manage anyone', () => {
    for (const status of ['pending', 'suspended']) {
      expect(roleOptionsFor(actor(['siteAdmin'], { status }))).toEqual([]);
      expect(canManageUser(actor(['siteAdmin'], { status }), target(['member']))).toBe(false);
    }
    expect(roleOptionsFor(null)).toEqual([]);
    expect(canManageUser(null, target(['member']))).toBe(false);
  });

  it('nobody can manage (or raise) their own roles', () => {
    expect(canManageUser(actor(['siteAdmin']), target(['siteAdmin'], 'actor'))).toBe(false);
    expect(canManageUser(actor(['departmentAdmin']), target(['departmentAdmin'], 'actor'))).toBe(false);
  });

  it('admins cannot manage users holding a role above their own (revoke follows the grant table)', () => {
    const dept = actor(['member', 'departmentAdmin']);
    expect(canManageUser(dept, target(['member']))).toBe(true);
    expect(canManageUser(dept, target(['member', 'departmentAdmin']))).toBe(true);
    expect(canManageUser(dept, target(['member', 'nationalAdmin']))).toBe(false);
    expect(canManageUser(dept, target(['member', 'siteAdmin']))).toBe(false);

    const natl = actor(['member', 'nationalAdmin']);
    expect(canManageUser(natl, target(['member', 'nationalAdmin']))).toBe(true);
    expect(canManageUser(natl, target(['member', 'siteAdmin']))).toBe(false);

    const site = actor(['member', 'siteAdmin']);
    expect(canManageUser(site, target(['member', 'siteAdmin']))).toBe(true);
    expect(canManageUser(site, target(['member', 'nationalAdmin']))).toBe(true);

    expect(canManageUser(actor(['member', 'adBookApprover']), target(['member']))).toBe(false);
  });
});
