import type { GmXmlhttpRequestOption, GmResponseEvent } from '$';

export interface Reply { body: unknown; status?: number; headers?: string; finalUrl?: string }
export const values = new Map<string, unknown>();
export const menus = new Map<string, () => void>();
export const GM_info = { scriptHandler: 'ScriptCat', sandboxMode: 'raw', scriptMetaStr: '// @inject-into content', version: '1.5.2' };
export const requests: GmXmlhttpRequestOption<'json'>[] = [];
const listeners = new Map<number, { key: string; callback: (key: string, oldValue: unknown, value: unknown, remote: boolean) => void }>();
let listenerId = 0;
const menuNames = new Map<number, string>();
let menuId = 0;
let handler: (options: GmXmlhttpRequestOption<'json'>) => Promise<Reply> = async () => { throw new Error('Unexpected HTTP request'); };
export function setHttpHandler(next: typeof handler): void { handler = next; }
export function resetGM(): void { values.clear(); menus.clear(); menuNames.clear(); requests.length = 0; listeners.clear(); GM_info.scriptHandler = 'ScriptCat'; handler = async () => { throw new Error('Unexpected HTTP request'); }; }
export function GM_getValue<T>(key: string, fallback?: T): T { return structuredClone(values.has(key) ? values.get(key) : fallback) as T; }
export function GM_setValue(key: string, value: unknown): void {
  const old = values.get(key); values.set(key, structuredClone(value));
  for (const entry of listeners.values()) if (entry.key === key) queueMicrotask(() => entry.callback(key, old, structuredClone(value), true));
}
export const GM = {
  async getValue<T>(key: string, fallback?: T): Promise<T> { return GM_getValue(key, fallback); },
  async setValue(key: string, value: unknown): Promise<void> { GM_setValue(key, value); },
  async deleteValue(key: string): Promise<void> { values.delete(key); },
  async listValues(): Promise<string[]> { return [...values.keys()]; },
  addValueChangeListener(key: string, callback: (key: string, oldValue: unknown, value: unknown, remote: boolean) => void): number { listeners.set(++listenerId, { key, callback }); return listenerId; },
  removeValueChangeListener(id: number): void { listeners.delete(id); },
  async registerMenuCommand(name: string, callback: () => void): Promise<number> { const id = ++menuId; menus.set(name, callback); menuNames.set(id, name); return id; },
  async unregisterMenuCommand(id: string | number): Promise<void> { const name = menuNames.get(Number(id)); if (name) menus.delete(name); menuNames.delete(Number(id)); },
  async notification(): Promise<void> {},
  xmlHttpRequest(options: GmXmlhttpRequestOption<'json'>) {
    requests.push(options); let aborted = false;
    const result = Promise.resolve().then(() => handler(options)).then(reply => {
      if (aborted) throw new DOMException('Aborted', 'AbortError');
      return { responseHeaders: reply.headers || '', readyState: 4, response: reply.body, responseText: JSON.stringify(reply.body), responseXML: null, status: reply.status || 200, statusText: '', finalUrl: reply.finalUrl || options.url, context: undefined } as GmResponseEvent<'json'>;
    });
    return Object.assign(result, { abort: () => { aborted = true; } });
  },
};
export function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
