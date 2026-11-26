import type { RepoContext, TreeEntry } from '../src/types';
export const sha = (n: number) => n.toString(16).padStart(40, '0');
export const context: RepoContext = { owner: 'example', repo: 'repo', repoId: 1, visibility: 'public', refName: 'main', refKind: 'branch', commitSha: sha(1), rootTreeSha: sha(2), path: '', view: 'root' };
export const entry = (path: string, type: TreeEntry['type'] = 'blob', id = 3): TreeEntry => ({ path, name: path.slice(path.lastIndexOf('/') + 1), sha: sha(id), mode: type === 'tree' ? '040000' : '100644', type });
export function codePage(path = '', ref = 'main', commit = sha(1)): void {
  history.replaceState(null, '', '/example/repo' + (path ? '/blob/' + ref + '/' + path : ref === 'main' ? '' : '/tree/' + ref));
  const app = document.createElement('react-app'); app.setAttribute('app-name', 'code-view');
  const script = document.createElement('script'); script.setAttribute('data-target', 'react-app.embeddedData');
  script.type = 'application/json';
  const route = path ? 'codeViewBlobLayoutRoute' : ref === 'main' ? 'codeViewRepoRoute' : 'codeViewTreeRoute';
  script.textContent = JSON.stringify({ payload: { codeViewLayoutRoute: { repo: { name: 'repo', ownerLogin: 'example', isEmpty: false } }, [route]: { path: path || '/', refInfo: { name: ref, refType: 'branch', currentOid: commit } } } });
  app.append(script); document.body.querySelector('react-app')?.remove(); document.body.append(app);
}
