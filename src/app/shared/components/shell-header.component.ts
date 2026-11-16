import { Component, computed, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeService } from '../../core/services/theme.service';
import { MclCrestComponent } from './mcl-crest.component';
import { StatusBadgeComponent } from './status-badge.component';

type HeaderMenu = 'admin' | 'account' | 'theme';

/** Name suffixes skipped when picking the last word for initials (matched case-insensitively, period optional). */
const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);

/**
 * Two-letter initials for the account avatar: first and last word of the name, skipping trailing
 * suffixes (Jr, Sr, II, III, IV), else the email.
 */
export function initialsFor(displayName: string | null | undefined, email: string | null | undefined): string {
  const words = (displayName ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .split(/[\s,]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w.length > 0);
  while (words.length > 1 && NAME_SUFFIXES.has(words[words.length - 1].toLowerCase())) words.pop();
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  const local = (email ?? '').split('@')[0].replace(/[^\p{L}\p{N}]/gu, '');
  return local ? local.slice(0, 2).toUpperCase() : '?';
}

/**
 * App header per STYLE_GUIDE.md "App header layout" (Nov 15, 2026): brand | primary links + Admin |
 * bell + account avatar menu (signed out: theme icon + Sign In). Collapses below xl.
 */
@Component({
  selector: 'app-shell-header',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, MclCrestComponent, StatusBadgeComponent],
  templateUrl: './shell-header.component.html',
  styleUrl: './shell-header.component.scss',
})
export class ShellHeaderComponent {
  readonly auth = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly notifications = inject(NotificationService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Collapsed (below xl) hamburger menu. */
  readonly menuOpen = signal(false);
  /** Which desktop dropdown is open, if any. */
  readonly openMenu = signal<HeaderMenu | null>(null);

  readonly adminOpen = computed(() => this.openMenu() === 'admin');
  readonly accountOpen = computed(() => this.openMenu() === 'account');
  readonly themeOpen = computed(() => this.openMenu() === 'theme');

  readonly initials = computed(() => {
    const u = this.auth.user();
    return u ? initialsFor(u.displayName, u.email) : '';
  });

  readonly currentTheme = computed(
    () => this.themeService.options.find((o) => o.id === this.themeService.theme()) ?? this.themeService.options[0]
  );

  readonly bellLabel = computed(() => {
    const n = this.notifications.unreadCount();
    return `Notifications, ${n} unread`;
  });

  private readonly adminButton = viewChild<ElementRef<HTMLButtonElement>>('adminButton');
  private readonly accountButton = viewChild<ElementRef<HTMLButtonElement>>('accountButton');
  private readonly themeButton = viewChild<ElementRef<HTMLButtonElement>>('themeButton');

  toggleMenu(menu: HeaderMenu): void {
    this.openMenu.update((current) => (current === menu ? null : menu));
  }

  closeMenus(): void {
    this.menuOpen.set(false);
    this.openMenu.set(null);
  }

  /** Esc closes an open dropdown and returns focus to the button that opened it. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    const open = this.openMenu();
    if (open) {
      this.openMenu.set(null);
      this.buttonFor(open)?.nativeElement.focus();
    } else if (this.menuOpen()) {
      this.menuOpen.set(false);
    }
  }

  /** Clicking outside the header closes any open dropdown. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.openMenu()) return;
    const target = event.target as Node | null;
    const open = this.openMenu();
    const menuRoot = open ? this.host.nativeElement.querySelector(`[data-menu="${open}"]`) : null;
    if (target && menuRoot?.contains(target)) return;
    this.openMenu.set(null);
  }

  async signOut(): Promise<void> {
    this.closeMenus();
    await this.auth.signOut();
  }

  private buttonFor(menu: HeaderMenu): ElementRef<HTMLButtonElement> | undefined {
    switch (menu) {
      case 'admin':
        return this.adminButton();
      case 'account':
        return this.accountButton();
      case 'theme':
        return this.themeButton();
    }
  }
}
