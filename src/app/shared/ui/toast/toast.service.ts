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

  show(_message: string, _type: ToastMessage['type'] = 'info', _duration = 3000): void {
    // All toast notifications are completely disabled across the application per user request
  }

  dismiss(_id: string): void {
    this.toasts.set([]);
  }
}

