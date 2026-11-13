import { Component, computed, input } from '@angular/core';

export type BadgeVariant =
  | 'active'
  | 'pending'
  | 'suspended'
  | 'needsVerification'
  | 'role'
  | 'demo';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span class="badge rounded-pill" [class]="badgeClass()">
      {{ label() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly variant = input.required<BadgeVariant>();
  readonly label = input.required<string>();

  readonly badgeClass = computed(() => {
    switch (this.variant()) {
      case 'active':
        return 'text-bg-success';
      case 'pending':
        return 'text-bg-warning text-dark';
      case 'suspended':
        return 'text-bg-danger';
      case 'needsVerification':
        return 'bg-warning-subtle text-dark border border-warning';
      case 'demo':
        return 'bg-light text-dark border border-secondary';
      case 'role':
      default:
        return 'bg-primary text-white border border-secondary';
    }
  });
}

