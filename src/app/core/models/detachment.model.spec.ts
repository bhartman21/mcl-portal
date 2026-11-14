import { SEED_DETACHMENTS } from './detachment.model';

describe('SEED_DETACHMENTS (DoF directory seed)', () => {
  it('#54 is Morris F. Dixon Jr.', () => {
    const d54 = SEED_DETACHMENTS.filter((d) => d.number === '54');
    expect(d54.length).toBe(1);
    expect(d54[0].name).toContain('Morris F. Dixon Jr');
    expect(d54[0].needsVerification).toBeFalsy();
  });

  it('S/Sgt Ted Archambault is separate, number-less, and needsVerification', () => {
    const a = SEED_DETACHMENTS.find((d) => d.name.includes('Archambault'));
    expect(a).toBeDefined();
    expect(a!.number).toBe('');
    expect(a!.needsVerification).toBe(true);
    expect(a!.id).not.toBe('dof-054');
  });

  it('has unique ids, all in the dof department', () => {
    const ids = SEED_DETACHMENTS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SEED_DETACHMENTS.every((d) => d.departmentId === 'dof')).toBe(true);
  });
});
