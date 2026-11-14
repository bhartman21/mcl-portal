import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Detachment } from '../models/detachment.model';
import { AuthService } from './auth.service';
import { DetachmentService } from './detachment.service';
import { FirebaseService } from './firebase.service';

describe('DetachmentService.updateDetachment (#15)', () => {
  let service: DetachmentService;
  const archambault = () =>
    service.detachments().find((d) => d.name === 'S/Sgt Ted Archambault') as Detachment;

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

  it('seeds Archambault as needing verification with no number', () => {
    expect(archambault().needsVerification).toBe(true);
    expect(archambault().number ?? '').toBe('');
  });

  it('recording a number in the edit form clears needsVerification (issue #15 repro)', async () => {
    await service.updateDetachment(archambault(), { name: 'S/Sgt Ted Archambault', number: '99' });
    expect(archambault().number).toBe('99');
    expect(archambault().needsVerification).toBe(false);
    expect(archambault().displayName).toBe('Detachment #99 — S/Sgt Ted Archambault');
  });

  it('editing other fields without a number leaves the flag set', async () => {
    await service.updateDetachment(archambault(), {
      name: 'S/Sgt Ted Archambault',
      number: '',
      city: 'Tampa',
    });
    expect(archambault().needsVerification).toBe(true);
    expect(archambault().city).toBe('Tampa');
  });
});
