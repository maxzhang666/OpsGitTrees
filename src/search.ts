import type { IndexView } from './types';
import { ancestors } from './tree-index';

export function filterTree(index: IndexView, query: string): { included: ReadonlySet<string>; autoExpanded: ReadonlySet<string> } {
  const needle = query.trim().toLowerCase();
  const included = new Set<string>();
  const autoExpanded = new Set<string>();
  const stack = (index.children.get('') || []).map(path => ({ path, inherited: false }));
  while (stack.length) {
    const { path, inherited } = stack.pop()!;
    const entry = index.entries.get(path)!;
    const hit = !needle || path.toLowerCase().includes(needle);
    if (hit || inherited) included.add(path);
    if (hit && !inherited) {
      for (const parent of ancestors(path)) { included.add(parent); autoExpanded.add(parent); }
    }
    if (entry.type === 'tree') for (const child of index.children.get(path) || []) stack.push({ path: child, inherited: inherited || hit });
  }
  return { included, autoExpanded };
}
export function visiblePaths(index: IndexView, included: ReadonlySet<string> | null, expanded: ReadonlySet<string>): readonly string[] {
  const result: string[] = [];
  const stack = [...(index.children.get('') || [])].reverse();
  while (stack.length) {
    const path = stack.pop()!;
    if (included && !included.has(path)) continue;
    result.push(path);
    if (expanded.has(path)) {
      const children = index.children.get(path) || [];
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]!);
    }
  }
  return result;
}
