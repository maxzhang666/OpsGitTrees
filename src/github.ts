import { GM } from '$';
import { msg, renderText, type Text } from './i18n';
import type { GitHubClient, PageContext, RepositoryMetadata, TreeEntry, TreeResponse } from './types';

export class ApiError extends Error {
  constructor(public readonly kind: 'auth' | 'forbidden' | 'rate' | 'not-found' | 'conflict' | 'network' | 'invalid', public readonly detail: Text, public readonly resumeAt: number | null = null) { super(renderText(detail)); this.name = 'ApiError'; }
}
const shaPattern = /^[a-f0-9]{40}$/i;
const abortError = () => new DOMException('Request cancelled', 'AbortError');

export function parseTreeResponse(value: unknown, expectedSha: string): TreeResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (typeof data.sha !== 'string' || !shaPattern.test(data.sha) || data.sha !== expectedSha || typeof data.truncated !== 'boolean' || !Array.isArray(data.tree)) return null;
  const tree: TreeEntry[] = [];
  for (const value of data.tree) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (typeof item.path !== 'string' || !item.path || item.path.startsWith('/') || item.path.split('/').some(p => !p || p === '.' || p === '..') || typeof item.sha !== 'string' || !shaPattern.test(item.sha) || typeof item.mode !== 'string' || (item.type !== 'tree' && item.type !== 'blob' && item.type !== 'commit')) return null;
    tree.push({ path: item.path, name: item.path.slice(item.path.lastIndexOf('/') + 1), sha: item.sha, mode: item.mode, type: item.type });
  }
  return { sha: data.sha, truncated: data.truncated, tree };
}

export function createGitHubClient(token: string | null): GitHubClient {
  const quota: GitHubClient['quota'] = { remaining: null, resumeAt: null, blockedUntil: null };
  async function request(path: string, signal: AbortSignal): Promise<Record<string, unknown>> {
    if (signal.aborted) throw abortError();
    if (quota.blockedUntil && quota.blockedUntil > Date.now()) throw new ApiError('rate', msg('GitHub rate limit remains active. Resume after {time}.', { time: new Date(quota.blockedUntil) }), quota.blockedUntil);
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const pending = GM.xmlHttpRequest({ method: 'GET', url: 'https://api.github.com' + path, headers, responseType: 'json', anonymous: true, redirect: 'error', timeout: 30000 });
    const abort = () => pending.abort();
    signal.addEventListener('abort', abort, { once: true });
    try {
      const response = await pending;
      if (signal.aborted) throw abortError();
      if (new URL(response.finalUrl).origin !== 'https://api.github.com') throw new ApiError('invalid', msg('GitHub API redirected outside the allowed origin.'));
      const values = new Map(response.responseHeaders.split(/\r?\n/).filter(l => l.includes(':')).map(l => { const i = l.indexOf(':'); return [l.slice(0, i).toLowerCase().trim(), l.slice(i + 1).trim()]; }));
      const remaining = values.get('x-ratelimit-remaining');
      if (remaining !== undefined && /^\d+$/.test(remaining)) quota.remaining = Number(remaining);
      const reset = Number(values.get('x-ratelimit-reset')) * 1000;
      const retry = values.get('retry-after');
      let retryAt = retry ? (/^\d+$/.test(retry) ? Date.now() + Number(retry) * 1000 : Date.parse(retry)) : 0;
      if (!Number.isFinite(retryAt)) retryAt = 0;
      quota.resumeAt = Number.isFinite(reset) && reset > 0 ? reset : null;
      const secondaryLimit = typeof response.response?.message === 'string' && /secondary rate limit/i.test(response.response.message);
      if (response.status === 429 || (response.status === 403 && (quota.remaining === 0 || !!retry || secondaryLimit))) {
        const now = Date.now(), suggested = Math.max(retryAt, quota.remaining === 0 ? quota.resumeAt || 0 : 0);
        quota.blockedUntil = Math.max(quota.blockedUntil || 0, suggested > now ? suggested : now + 60000);
        if (quota.remaining === 0 && (!quota.resumeAt || quota.resumeAt <= now)) quota.resumeAt = quota.blockedUntil;
        throw new ApiError('rate', msg('GitHub rate limit reached. Resume after {time}.', { time: new Date(quota.blockedUntil) }), quota.blockedUntil);
      }
      if (response.status === 401) throw new ApiError('auth', msg('GitHub rejected the Token (HTTP 401): invalid, expired or revoked. Replace or clear it in the Token configuration dialog.'));
      if (response.status === 403) throw new ApiError('forbidden', msg(values.has('x-github-sso') ? 'Organization SSO authorization is required.' : 'GitHub denied access. Check repository scope, organization approval and read-only permissions.'));
      if (response.status === 404) throw new ApiError('not-found', msg('Repository or object not found, or the current credential has no access.'));
      if (response.status === 409) throw new ApiError('conflict', msg('GitHub reported a repository conflict; this response alone does not prove it is empty.'));
      if (response.status < 200 || response.status >= 300) throw new ApiError('network', msg('GitHub API request failed (HTTP {status}).', { status: String(response.status) }));
      if (!response.response || typeof response.response !== 'object' || Array.isArray(response.response)) throw new ApiError('invalid', msg('Unrecognized GitHub API response.'));
      return response.response as Record<string, unknown>;
    } catch (error) {
      if (signal.aborted) throw abortError();
      if (error instanceof ApiError) throw error;
      throw new ApiError('network', msg('GitHub API request failed. Check the network and userscript manager permissions.'));
    } finally { signal.removeEventListener('abort', abort); }
  }
  const repoPath = (owner: string, repo: string) => '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo);
  const checkedSha = (sha: string) => { if (!shaPattern.test(sha)) throw new ApiError('invalid', msg('GitHub returned an invalid object identifier.')); return sha; };
  return {
    quota,
    async getIdentity(signal) {
      const data = await request('/user', signal);
      if (typeof data.id !== 'number' || typeof data.login !== 'string') throw new ApiError('invalid', msg('GitHub returned an invalid account identity.'));
      return { id: data.id, login: data.login };
    },
    async getRepository(owner, repo, signal) {
      const data = await request(repoPath(owner, repo), signal);
      const visibility = data.visibility;
      if (typeof data.id !== 'number' || (visibility !== 'public' && visibility !== 'private' && visibility !== 'internal')) throw new ApiError('invalid', msg('GitHub returned invalid repository metadata.'));
      return { owner, repo, repoId: data.id, visibility };
    },
    async resolveTree(page: PageContext, repository: RepositoryMetadata, signal) {
      if (page.owner.toLowerCase() !== repository.owner.toLowerCase() || page.repo.toLowerCase() !== repository.repo.toLowerCase()) throw new ApiError('invalid', msg('Repository context changed.'));
      const data = await request(repoPath(page.owner, page.repo) + '/git/commits/' + checkedSha(page.commitSha), signal);
      const tree = data.tree;
      if (data.sha !== page.commitSha || !tree || typeof tree !== 'object' || !('sha' in tree) || typeof tree.sha !== 'string') throw new ApiError('invalid', msg('GitHub returned a different commit or no root tree.'));
      return { ...page, ...repository, rootTreeSha: checkedSha(tree.sha) };
    },
    async getTree(context, sha, recursive, signal) {
      const data = await request(repoPath(context.owner, context.repo) + '/git/trees/' + checkedSha(sha) + (recursive ? '?recursive=1' : ''), signal);
      const response = parseTreeResponse(data, sha);
      if (!response) throw new ApiError('invalid', msg('GitHub returned invalid tree metadata.'));
      return response;
    },
  };
}
