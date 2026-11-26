import { expect, it } from 'vitest';
import { filterTree, visiblePaths } from '../src/search';
import { TreeIndex } from '../src/tree-index';
import { entry } from './fixtures';

it('directoryMatchDoesNotExpandDescendants', () => {
  const index = new TreeIndex(); index.add([entry('src/auth', 'tree'), entry('src/auth/nested', 'tree'), entry('src/auth/nested/a.ts'), entry('src/auth/b.ts'), entry('src/other.ts')]);
  const view = index.view('complete'), filtered = filterTree(view, ' AUTH ');
  expect([...filtered.autoExpanded]).toEqual(['src']);
  expect(visiblePaths(view, filtered.included, filtered.autoExpanded)).toEqual(['src', 'src/auth']);
  expect(visiblePaths(view, filtered.included, new Set(['src', 'src/auth']))).toEqual(['src', 'src/auth', 'src/auth/nested', 'src/auth/b.ts']);
});
it('caseInsensitiveSearchPreservesDistinctPaths', () => {
  const index = new TreeIndex(); index.add([entry('A.ts'), entry('a.ts'), entry('B.ts')]);
  const view = index.view('complete'), filtered = filterTree(view, 'a.TS');
  expect(visiblePaths(view, filtered.included, filtered.autoExpanded)).toEqual(['A.ts', 'a.ts']);
});
it('fileMatchKeepsOnlyRequiredAncestors', () => {
  const index = new TreeIndex(); index.add([entry('src/deep/target.ts'), entry('src/deep/other.ts'), entry('docs/help.md')]);
  const view = index.view('complete'), filtered = filterTree(view, 'target');
  expect(visiblePaths(view, filtered.included, filtered.autoExpanded)).toEqual(['src', 'src/deep', 'src/deep/target.ts']);
});
