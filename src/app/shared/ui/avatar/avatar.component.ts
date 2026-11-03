import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const MEMBER_GRADIENTS = [
  'linear-gradient(135deg, #6c4cff, #a78bfa)', // 0: Indigo
  'linear-gradient(135deg, #ff5f9e, #ff9a8b)', // 1: Rose / Peach
  'linear-gradient(135deg, #0fb27c, #6ee7b7)', // 2: Emerald
  'linear-gradient(135deg, #f59f00, #ffd166)', // 3: Amber
  'linear-gradient(135deg, #2e90ff, #7dd3fc)', // 4: Azure
];

@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="avatar-circle"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.font-size.px]="fontSize()"
      [style.background]="gradient()"
    >
      {{ initials() }}
    </span>
  `,
  styles: `
    .avatar-circle {
      display: inline-grid;
      place-items: center;
      border-radius: 32%;
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
