import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'danger';
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  readonly toasts = signal<ToastMessage[]>([]);

  show(message: string, type: ToastMessage['type'] = 'info', duration = 3000): void {
    const id = crypto.randomUUID();
    const item: ToastMessage = { id, message, type };

    this.toasts.update((prev) => [...prev, item]);

    setTimeout(() => {
      this.dismiss(id);
    }, duration);
  }

  dismiss(id: string): void {
    this.toasts.update((prev) => prev.filter((t) => t.id !== id));
  }
}
