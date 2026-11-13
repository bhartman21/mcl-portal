import { effect, Injectable, signal } from '@angular/core';

export type ThemeId = 'light' | 'dark' | 'fun';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
  icon: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'White background with Dress Blues navy & scarlet accents',
    icon: 'bi-sun-fill',
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Marine Corps Dress Blues midnight navy & brass gold',
    icon: 'bi-moon-stars-fill',
  },
  {
    id: 'fun',
    label: 'Fun',
    description: 'Vibrant crayon-box colors with high-contrast text',
    icon: 'bi-palette-fill',
  },
];

const STORAGE_THEME_KEY = 'mcl_portal_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<ThemeId>(this.loadInitialTheme());

  readonly theme = this._theme.asReadonly();
  readonly options = THEME_OPTIONS;

  constructor() {
    effect(() => {
      const current = this._theme();
      this.applyTheme(current);
      localStorage.setItem(STORAGE_THEME_KEY, current);
    });
  }

  setTheme(id: ThemeId): void {
    this._theme.set(id);
  }

  private loadInitialTheme(): ThemeId {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'fun') {
      return saved;
    }
    return 'light';
  }

  private applyTheme(id: ThemeId): void {
    const root = document.documentElement;
    root.setAttribute('data-mcl-theme', id);
    root.setAttribute('data-bs-theme', id === 'dark' ? 'dark' : 'light');
  }
}

