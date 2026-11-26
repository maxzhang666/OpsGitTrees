import { expect, it, vi } from 'vitest';
import { createGitHubClient, parseTreeResponse } from '../src/github';
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
it.each([false, true])('preserves a valid empty tree with truncated=%s', async truncated => {
  const body = { sha: sha(2), truncated, tree: [] };
  expect(parseTreeResponse(body, sha(2))).toEqual({ sha: sha(2), truncated, tree: [] });
  setHttpHandler(async () => ({ body }));
  await expect(createGitHubClient(null).getTree(context, sha(2), true, new AbortController().signal)).resolves.toEqual({ sha: sha(2), truncated, tree: [] });
});
it('derives entry names from paths for every supported object type', () => {
  expect(parseTreeResponse({ sha: sha(2), truncated: false, tree: [
    { path: 'src', sha: sha(3), mode: '040000', type: 'tree' },
    { path: 'src/file.ts', name: 'stale', sha: sha(4), mode: '100644', type: 'blob' },
    { path: 'vendor/repo', sha: sha(5), mode: '160000', type: 'commit' },
  ] }, sha(2))).toEqual({ sha: sha(2), truncated: false, tree: [
    { path: 'src', name: 'src', sha: sha(3), mode: '040000', type: 'tree' },
    { path: 'src/file.ts', name: 'file.ts', sha: sha(4), mode: '100644', type: 'blob' },
    { path: 'vendor/repo', name: 'repo', sha: sha(5), mode: '160000', type: 'commit' },
  ] });
});
it.each([
  { label: 'null', body: null },
  { label: 'undefined', body: undefined },
  { label: 'primitive', body: 1 },
  { label: 'array', body: [] },
  { label: 'missing metadata', body: {} },
  { label: 'different SHA', body: { sha: sha(99), truncated: false, tree: [] } },
  { label: 'nonboolean truncation', body: { sha: sha(2), truncated: 'false', tree: [] } },
  { label: 'nonarray entries', body: { sha: sha(2), truncated: false, tree: {} } },
])('rejects invalid tree metadata without leaking TypeError: $label', async ({ body }) => {
  expect(parseTreeResponse(body, sha(2))).toBeNull();
  setHttpHandler(async () => ({ body }));
  await expect(createGitHubClient(null).getTree(context, sha(2), false, new AbortController().signal)).rejects.toMatchObject({ name: 'ApiError', kind: 'invalid' });
});
it.each([
  { label: 'null', value: null },
  { label: 'primitive', value: 1 },
  { label: 'array', value: [] },
  { label: 'missing fields', value: {} },
  { label: 'nonstring path', value: { ...entry('file.ts'), path: 1 } },
  ...['', '/file.ts', 'src//file.ts', 'src/', '.', '..', 'src/./file.ts', 'src/../file.ts'].map(path => ({ label: 'path ' + JSON.stringify(path), value: entry(path) })),
  ...[null, 1, 'a'.repeat(39), 'a'.repeat(41), 'g'.repeat(40)].map(value => ({ label: 'SHA ' + JSON.stringify(value), value: { ...entry('file.ts'), sha: value } })),
  { label: 'nonstring mode', value: { ...entry('file.ts'), mode: null } },
  ...[null, 'symlink', ['blob']].map(type => ({ label: 'type ' + JSON.stringify(type), value: { ...entry('file.ts'), type } })),
])('rejects malformed tree entries without leaking TypeError: $label', async ({ value }) => {
  const body = { sha: sha(2), truncated: false, tree: [entry('valid.ts'), value] };
  expect(parseTreeResponse(body, sha(2))).toBeNull();
  setHttpHandler(async () => ({ body }));
  await expect(createGitHubClient(null).getTree(context, sha(2), false, new AbortController().signal)).rejects.toMatchObject({ name: 'ApiError', kind: 'invalid' });
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
