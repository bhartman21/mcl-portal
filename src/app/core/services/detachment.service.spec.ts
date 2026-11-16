import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Detachment } from '../models/detachment.model';
import { AuthService } from './auth.service';
import { DetachmentService } from './detachment.service';
import { FirebaseService } from './firebase.service';

describe('DetachmentService.updateDetachment (#15)', () => {
  let service: DetachmentService;
  // The seed no longer has a number-less row (Archambault is #819), so these tests add one.
  const pending = () =>
    service.detachments().find((d) => d.name === 'Pending Detachment') as Detachment;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: FirebaseService, useValue: { isConfigured: false, firestore: null } },
        {
          provide: AuthService,
          useValue: { user: signal(null), isActive: () => false, isAdmin: () => true },
        },
      ],
    });
    service = TestBed.inject(DetachmentService);
  });

  beforeEach(async () => {
    await service.addDetachment({ name: 'Pending Detachment', number: '', active: true });
  });

  it('a number-less detachment is added as needing verification', () => {
    expect(pending().needsVerification).toBe(true);
    expect(pending().number ?? '').toBe('');
  });

  it('recording a number in the edit form clears needsVerification (issue #15 repro)', async () => {
    await service.updateDetachment(pending(), { name: 'Pending Detachment', number: '99' });
    expect(pending().number).toBe('99');
    expect(pending().needsVerification).toBe(false);
    expect(pending().displayName).toBe('Detachment #99 — Pending Detachment');
  });

  it('editing other fields without a number leaves the flag set', async () => {
    await service.updateDetachment(pending(), {
      name: 'Pending Detachment',
      number: '',
      city: 'Tampa',
    });
    expect(pending().needsVerification).toBe(true);
    expect(pending().city).toBe('Tampa');
  });

  it('a flagged single-source seed row keeps its flag when only the city is edited', async () => {
    const d1476 = () => service.detachments().find((d) => d.id === 'dof-1476') as Detachment;
    expect(d1476().needsVerification).toBe(true);
    await service.updateDetachment(d1476(), { name: d1476().name, number: '1476', city: 'Marianna' });
    expect(d1476().needsVerification).toBe(true);
  });
});
