import { Component, input } from '@angular/core';

@Component({
  selector: 'app-mcl-crest',
  standalone: true,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Marine Corps League Department of Florida Crest"
    >
      <!-- Outer Gold Ring -->
      <circle cx="32" cy="32" r="30" fill="#001B3A" stroke="#C19B57" stroke-width="2.5" />
      <!-- Scarlet Inner Medallion -->
      <circle cx="32" cy="32" r="24" fill="#A62D3B" stroke="#CFB53B" stroke-width="1" />
      <!-- Inner Navy Field -->
      <circle cx="32" cy="32" r="19" fill="#142c49" />
      <!-- Stylized Globe Latitude/Longitude -->
      <circle cx="32" cy="33" r="11" stroke="#C19B57" stroke-width="1.3" fill="none" />
      <ellipse cx="32" cy="33" rx="5.5" ry="11" stroke="#C19B57" stroke-width="1.1" fill="none" />
      <line x1="21" y1="33" x2="43" y2="33" stroke="#C19B57" stroke-width="1.1" />
      <path d="M23 27.5 Q32 29.5 41 27.5" stroke="#C19B57" stroke-width="1" fill="none" />
      <path d="M23 38.5 Q32 36.5 41 38.5" stroke="#C19B57" stroke-width="1" fill="none" />
      <!-- Anchor Crossbar & Stock -->
      <line x1="32" y1="18" x2="32" y2="47" stroke="#CFB53B" stroke-width="2" stroke-linecap="round" />
      <line x1="27" y1="21" x2="37" y2="21" stroke="#CFB53B" stroke-width="1.8" stroke-linecap="round" />
      <path d="M25 43 Q32 49 39 43" stroke="#CFB53B" stroke-width="2" stroke-linecap="round" fill="none" />
      <!-- Top Star / Eagle Accent -->
      <polygon
        points="32,10 33.7,14.2 38.2,14.4 34.7,17.2 35.9,21.5 32,19 28.1,21.5 29.3,17.2 25.8,14.4 30.3,14.2"
        fill="#CFB53B"
      />
    </svg>
  `,
})
export class MclCrestComponent {
  readonly size = input<number>(42);
}

