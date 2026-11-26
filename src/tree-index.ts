import type { IndexView, LoadState, TreeEntry } from './types';
import type { Text } from './i18n';

export function parentPath(path: string): string { const slash = path.lastIndexOf('/'); return slash < 0 ? '' : path.slice(0, slash); }
export function ancestors(path: string): string[] { const result: string[] = []; for (let parent = parentPath(path); parent; parent = parentPath(parent)) result.push(parent); return result; }
export class TreeIndex {
  readonly entries = new Map<string, TreeEntry>();
  readonly children = new Map<string, string[]>([['', []]]);
  private readonly dirty = new Set<string>();
  add(entries: readonly TreeEntry[], prefix = ''): void {
    for (const entry of entries) {
      const path = prefix ? prefix + '/' + entry.path : entry.path;
      for (const ancestor of ancestors(path).reverse()) {
        if (!this.entries.has(ancestor)) this.insert({ path: ancestor, name: ancestor.slice(ancestor.lastIndexOf('/') + 1), sha: '', mode: '040000', type: 'tree' });
      }
      this.insert({ ...entry, path, name: path.slice(path.lastIndexOf('/') + 1) });
    }
  }
  private insert(entry: TreeEntry): void {
    const old = this.entries.get(entry.path);
    this.entries.set(entry.path, entry);
    if (entry.type === 'tree' && !this.children.has(entry.path)) this.children.set(entry.path, []);
    const parent = parentPath(entry.path);
    if (!this.children.has(parent)) this.children.set(parent, []);
    if (!old) this.children.get(parent)!.push(entry.path);
    this.dirty.add(parent);
  }
  view(state: LoadState, pending = 0, reason?: Text): IndexView {
    for (const parent of this.dirty) {
      this.children.get(parent)?.sort((a, b) => {
        const left = this.entries.get(a)!, right = this.entries.get(b)!;
        if ((left.type === 'tree') !== (right.type === 'tree')) return left.type === 'tree' ? -1 : 1;
        return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
      });
    }
    this.dirty.clear();
    return { entries: this.entries, children: this.children, state, pending, reason };
  }
}
