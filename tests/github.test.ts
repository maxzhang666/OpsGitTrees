import { expect, it, vi } from 'vitest';
import { createGitHubClient } from '../src/github';
import { context, entry, sha } from './fixtures';
import { requests, setHttpHandler } from './gm';

it.each([[401, '', 'auth'], [403, '', 'forbidden'], [403, 'X-GitHub-SSO: required', 'forbidden'], [403, 'X-RateLimit-Remaining: 0\r\nX-RateLimit-Reset: 9999999999', 'rate'], [429, 'Retry-After: 60', 'rate'], [404, '', 'not-found'], [409, '', 'conflict']])('distinguishesAccessErrorsFromEmptyRepository: %i', async (status, headers, kind) => {
  setHttpHandler(async () => ({ body: { message: 'server text not trusted' }, status: Number(status), headers: String(headers) }));
  await expect(createGitHubClient(null).getRepository('example', 'repo', new AbortController().signal)).rejects.toMatchObject({ kind });
});
it('emptyRepositoryNeedsNoCommit', async () => {
  setHttpHandler(async () => ({ body: { id: 1, visibility: 'public' } }));
  expect(await createGitHubClient(null).getRepository('example', 'repo', new AbortController().signal)).toEqual({ owner: 'example', repo: 'repo', repoId: 1, visibility: 'public' });
  expect(requests.map(r => r.url)).toEqual(['https://api.github.com/repos/example/repo']);
});
it('omits recursive entirely for direct enumeration and never sends a public cookie', async () => {
  setHttpHandler(async () => ({ body: { sha: sha(2), truncated: false, tree: [entry('a.ts')] } }));
  const result = await createGitHubClient(null).getTree(context, sha(2), false, new AbortController().signal);
  expect(result.tree[0]?.path).toBe('a.ts');
  expect(requests[0]?.url).toBe('https://api.github.com/repos/example/repo/git/trees/' + sha(2));
  expect(requests[0]?.headers?.Authorization).toBeUndefined();
  expect(requests[0]?.anonymous).toBe(true);
});
it('rejects redirected origins and never publishes their response', async () => {
  setHttpHandler(async () => ({ body: { id: 1, login: 'test' }, finalUrl: 'https://untrusted.invalid/user' }));
  await expect(createGitHubClient('test-token').getIdentity(new AbortController().signal)).rejects.toMatchObject({ kind: 'invalid' });
});
it('does not resolve a different commit returned by the API', async () => {
  setHttpHandler(async () => ({ body: { sha: sha(99), tree: { sha: sha(2) } } }));
  await expect(createGitHubClient(null).resolveTree(context, context, new AbortController().signal)).rejects.toMatchObject({ kind: 'invalid' });
});
it.each([
  { status: 429, retry: 'Retry-After: 60\r\n', message: 'Too many requests' },
  { status: 403, retry: '', message: 'You have exceeded a secondary rate limit.' },
])('a secondary limit (HTTP $status) does not wait for an unrelated primary quota reset', async ({ status, retry, message }) => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1800000000000);
  try {
    setHttpHandler(async () => ({ status, headers: retry + 'X-RateLimit-Remaining: 100\r\nX-RateLimit-Reset: 1800003600', body: { message } }));
    await expect(createGitHubClient(null).getRepository('example', 'repo', new AbortController().signal)).rejects.toMatchObject({ kind: 'rate', resumeAt: 1800000060000 });
  } finally { clock.mockRestore(); }
});
