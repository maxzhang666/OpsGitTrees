import { beforeEach, vi } from 'vitest';
import { resetGM } from './gm';
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 0));
vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
const lockTails = new Map<string, Promise<unknown>>();
Object.defineProperty(navigator, 'locks', { configurable: true, value: {
  request(name: string, callback: () => Promise<unknown>) {
    const result = (lockTails.get(name) || Promise.resolve()).then(callback);
    lockTails.set(name, result.catch(() => undefined));
    return result;
  },
} });
beforeEach(() => { resetGM(); document.body.replaceChildren(); document.head.replaceChildren(); history.replaceState(null, '', '/'); });
