import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FakeAuth } from '../../../testing/fake-auth';
import { UserProfile } from '../models/user.model';
import { AdBookService } from './ad-book.service';
import { AdminService } from './admin.service';
import { AuthService } from './auth.service';

describe('AdBookService book visibility (#9)', () => {
  let auth: FakeAuth;
  let service: AdBookService;

  beforeEach(async () => {
    localStorage.clear();
    auth = new FakeAuth();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: AdminService, useValue: { users: signal<UserProfile[]>([]) } },
      ],
    });
    service = TestBed.inject(AdBookService);
    auth.signInAs('approver', ['member', 'adBookApprover']);
    const draft = await service.createBook({ title: 'Draft book', eventName: 'Fall' });
    await service.updateBookStatus(draft.id, 'draft');
    const locked = await service.createBook({ title: 'Locked book', eventName: 'Fall' });
    await service.updateBookStatus(locked.id, 'locked');
  });

  it('approvers see every book', () => {
    expect(service.visibleBooks().map((b) => b.status).sort()).toEqual(['draft', 'locked', 'open']);
  });

  it('members see only open books, by list and by id', () => {
    auth.signInAs('alice');
    expect(service.visibleBooks().map((b) => b.status)).toEqual(['open']);
    const locked = service.adBooks().find((b) => b.status === 'locked')!;
    expect(service.getVisibleBookById(locked.id)).toBeUndefined();
    const open = service.adBooks().find((b) => b.status === 'open')!;
    expect(service.getVisibleBookById(open.id)?.id).toBe(open.id);
  });
});
