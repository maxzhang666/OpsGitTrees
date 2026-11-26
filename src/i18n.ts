import { zhCN } from './zh-CN';

export type LanguagePreference = 'auto' | 'en' | 'zh-CN';
export type Locale = Exclude<LanguagePreference, 'auto'>;
export type MessageKey = keyof typeof zhCN;
export interface Message { key: MessageKey; values?: Record<string, string | number | Date | Message> }
export type Text = string | Message;
let preference: LanguagePreference = 'auto';
const listeners = new Set<() => void>();
function resolveLanguage(value: LanguagePreference): Locale {
  if (value !== 'auto') return value;
  for (const language of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    if (/^zh(?:-|$)/i.test(language)) return 'zh-CN';
    if (/^en(?:-|$)/i.test(language)) return 'en';
  }
  return 'en';
}
let locale = resolveLanguage(preference);
export function getLanguage(): Locale { return locale; }
export function setLanguage(value: LanguagePreference): void {
  preference = value;
  const next = resolveLanguage(value);
  if (next === locale) return;
  locale = next;
  for (const listener of listeners) listener();
}
export function observeLanguage(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function msg(key: MessageKey, values?: Message['values']): Message { return values ? { key, values } : { key }; }
export function t(key: MessageKey, values?: Message['values']): string {
  const text = locale === 'zh-CN' ? zhCN[key] : key;
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = values[name]!;
    if (typeof value === 'number') return value.toLocaleString(locale);
    if (value instanceof Date) return value.toLocaleTimeString(locale);
    return typeof value === 'string' ? value : renderText(value);
  });
}
export function createTranslations(): { bind<T extends Node>(node: T, text: Text, attribute?: string): T; refresh(): void } {
  const updates: (() => void)[] = [];
  return {
    bind(node, text, attribute) {
      const update = () => { if (attribute && node instanceof Element) node.setAttribute(attribute, renderText(text)); else node.textContent = renderText(text); };
      updates.push(update); update(); return node;
    },
    refresh() { for (const update of updates) update(); },
  };
}
export function renderText(text: Text): string { return typeof text === 'string' ? text : t(text.key, text.values); }
window.addEventListener('languagechange', () => { if (preference === 'auto') setLanguage('auto'); });
