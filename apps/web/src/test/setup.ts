import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sem `globals`, o Testing Library não limpa sozinho entre os testes.
afterEach(cleanup);

// O jsdom não traz PointerEvent: sem isso, `clientX`, `button` e `pointerType` se perdem nos testes de arrastar.
if (typeof window !== 'undefined' && !('PointerEvent' in window)) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  Object.defineProperty(window, 'PointerEvent', { value: PointerEventPolyfill, configurable: true });
}
