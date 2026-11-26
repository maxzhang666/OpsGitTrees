import { beforeEach, vi } from 'vitest';
import { resetGM } from './gm';
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 0));
vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
let lockTail: Promise<unknown> = Promise.resolve();
Object.defineProperty(navigator, 'locks', { configurable: true, value: {
  request(name: string, callback: () => Promise<unknown>) {
    const result = lockTail.then(callback);
    lockTail = result.catch(() => undefined);
    return result;
  },
} });
beforeEach(() => { resetGM(); document.body.replaceChildren(); document.head.replaceChildren(); history.replaceState(null, '', '/'); });
