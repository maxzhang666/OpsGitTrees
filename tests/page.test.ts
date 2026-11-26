import { describe, expect, it } from 'vitest';
import { fileUrl, readPage } from '../src/page';
import type { PageContext } from '../src/types';

const commit = '502a981024b79219b447ed5f376a529df50118e3';
function fixture(path: string, ref = 'feature/a', route = 'codeViewBlobLayoutRoute') {
  const doc = document.implementation.createHTMLDocument();
  const app = doc.createElement('react-app');
  app.setAttribute('app-name', 'code-view');
  const script = doc.createElement('script');
  script.setAttribute('data-target', 'react-app.embeddedData');
  script.textContent = JSON.stringify({ payload: { codeViewLayoutRoute: { repo: { ownerLogin: 'example', name: 'repo', isEmpty: false } }, [route]: { path, refInfo: { name: ref, refType: 'branch', currentOid: commit } } } });
  app.append(script); doc.body.append(app); return doc;
}
describe('GitHub page context', () => {
  it('resolvesSlashRefWithoutSplitting', () => {
    const result = readPage(fixture('src/a.ts'), new URL('https://github.com/example/repo/blob/feature/a/src/a.ts'));
    expect(result).toEqual({ kind: 'code', context: { owner: 'example', repo: 'repo', refName: 'feature/a', commitSha: commit, refKind: 'branch', path: 'src/a.ts', view: 'blob' } });
  });
  it('rejects stale SPA payload instead of showing another branch', () => {
    expect(readPage(fixture('src/a.ts'), new URL('https://github.com/example/repo/blob/other/src/a.ts')).kind).toBe('unresolved');
  });
  it('encodesFileSegmentsOnce', () => {
    const context: PageContext = { owner: 'example', repo: 'repo', refName: 'feature/a', commitSha: commit, refKind: 'branch', path: '', view: 'root' };
    expect(fileUrl(context, '中文/a #%.ts')).toBe('https://github.com/example/repo/blob/feature%2Fa/%E4%B8%AD%E6%96%87/a%20%23%25.ts');
    expect(readPage(fixture('中文/a #%.ts'), new URL(fileUrl(context, '中文/a #%.ts'))).kind).toBe('code');
  });
  it.each(['issues', 'pull/1/files', 'actions', 'commits/main'])('rejectsNonCodeRoutes: %s', route => {
    expect(readPage(fixture(''), new URL('https://github.com/example/repo/' + route))).toEqual({ kind: 'outside' });
  });
  it.each(['/settings/profile', '/settings/personal-access-tokens', '/orgs/community', '/marketplace/actions'])('excludes reserved non-repository route %s', path => {
    expect(readPage(fixture(''), new URL('https://github.com' + path))).toEqual({ kind: 'outside' });
  });
  it('recognizes real empty-page marker without requiring a commit', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.head.innerHTML = '<meta name="octolytics-dimension-repository_nwo" content="example/repo">';
    doc.body.innerHTML = '<h3>This repository is empty.</h3>';
    expect(readPage(doc, new URL('https://github.com/example/repo'))).toEqual({ kind: 'empty', owner: 'example', repo: 'repo' });
  });
});
