import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

const KNOWN_AVATARS: Record<string, string> = {
  vishwas: '/profiles/vishwas.jpeg',
  vikas: '/profiles/vikas.jpeg',
  bhavya: '/profiles/bhavya.jpeg',
  shruthi: '/profiles/shruthi.jpeg',
  csp: '/profiles/csp.jpeg',
};

const MEMBER_GRADIENTS = [
  'linear-gradient(135deg, #111216, #2a2b32)', // Obsidian
  'linear-gradient(135deg, #3b82f6, #60a5fa)', // Blue
  'linear-gradient(135deg, #0fb27c, #6ee7b7)', // Emerald
  'linear-gradient(135deg, #f59f00, #ffd166)', // Amber
  'linear-gradient(135deg, #ec4899, #f472b6)', // Pink
];

@Component({
  selector: 'app-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (resolvedImage() && !imageFailed()) {
      <img
        class="avatar-photo"
        [src]="resolvedImage()!"
        [alt]="name()"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.border-radius]="circular() ? '50%' : '32%'"
        (error)="imageFailed.set(true)"
      />
    } @else {
      <span
        class="avatar-circle"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="fontSize()"
        [style.border-radius]="circular() ? '50%' : '32%'"
        [style.background]="gradient()"
      >
        {{ initials() }}
      </span>
    }
  `,
  styles: `
    .avatar-photo {
      display: inline-block;
      object-fit: cover;
      object-position: center;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      user-select: none;
      background: #f2f3f6;
    }

    .avatar-circle {
      display: inline-grid;
      place-items: center;
      color: #ffffff;
      font-weight: 800;
      letter-spacing: -0.02em;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      user-select: none;
    }
  `,
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly colorIndex = input<number>(0);
  readonly size = input<number>(40);
  readonly avatarUrl = input<string | undefined>(undefined);
  readonly circular = input<boolean>(false);

  readonly imageFailed = signal(false);

  readonly resolvedImage = computed(() => {
    const explicit = this.avatarUrl();
    if (explicit) return explicit;
    const key = this.name().trim().toLowerCase();
    return KNOWN_AVATARS[key] || undefined;
  });

  readonly fontSize = computed(() => Math.round(this.size() * 0.42));

  readonly gradient = computed(() => {
    const idx = Math.abs(this.colorIndex()) % MEMBER_GRADIENTS.length;
    return MEMBER_GRADIENTS[idx];
  });

  readonly initials = computed(() => {
    const n = this.name().trim();
    if (!n) return '?';

    // If ends with a number (e.g. "Member 1"), show "1" or "M1"
    const digitMatch = n.match(/\d+$/);
    if (digitMatch && n.toLowerCase().startsWith('member')) {
      return `M${digitMatch[0]}`;
    }
    if (digitMatch) {
      return digitMatch[0];
    }

    // Otherwise first letters of words up to 2
    const parts = n.split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  });
}
