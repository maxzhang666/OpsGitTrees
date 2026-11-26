import { expect, it, vi } from 'vitest';
import { clearToken, configureToken, getGitHubClient, readAuthScope } from '../src/credentials';
import { deferred, GM, requests, setHttpHandler } from './gm';
const credentialRequests = () => requests.filter(request => request.url.endsWith('/user')).length;

it('replacementDoesNotCommitInvalidIdentity', async () => {
  setHttpHandler(async () => ({ body: { id: 12, login: 'api-user' } }));
  const initial = await configureToken('first-token');
  setHttpHandler(async () => ({ status: 401, body: {} }));
  await expect(configureToken('invalid-token')).rejects.toMatchObject({ stage: 'identity' });
  expect(await readAuthScope()).toEqual(initial);
  await expect(configureToken(' ')).rejects.toMatchObject({ stage: 'input' });
  expect(await readAuthScope()).toEqual(initial);
});
it('clear invalidates old scope and rejects a late credential replacement', async () => {
  const reply = deferred<{ body: unknown }>(); setHttpHandler(() => reply.promise);
  const before = await readAuthScope(); const configuring = configureToken('candidate-token');
  await vi.waitFor(() => expect(credentialRequests()).toBe(1));
  await clearToken(); reply.resolve({ body: { id: 12, login: 'api-user' } });
  await expect(configuring).rejects.toMatchObject({ name: 'AbortError' });
  expect((await readAuthScope()).authenticated).toBe(false);
  await expect(getGitHubClient(before)).rejects.toMatchObject({ name: 'AbortError' });
});
it('a completed clear cannot be overwritten by a delayed final credential read', async () => {
  setHttpHandler(async () => ({ body: { id: 1, login: 'candidate' } }));
  const original = GM.getValue;
  const entered = deferred<void>(), release = deferred<void>();
  let credentialReads = 0;
  vi.spyOn(GM, 'getValue').mockImplementation(async (key, fallback) => {
    const value = await original(key, fallback);
    if (key === 'ogt:credentials:v1' && ++credentialReads === 2) { entered.resolve(); await release.promise; }
    return value;
  });
  const configuring = configureToken('candidate-token');
  await entered.promise;
  const clearing = clearToken();
  await Promise.resolve();
  release.resolve();
  await Promise.allSettled([configuring, clearing]);
  expect((await readAuthScope()).authenticated).toBe(false);
});

it('a cancelled check cannot replace a credential after its final read was delayed', async () => {
  setHttpHandler(async () => ({ body: { id: 1, login: 'api-user' } }));
  const original = GM.getValue, entered = deferred<void>(), release = deferred<void>();
  let reads = 0;
  vi.spyOn(GM, 'getValue').mockImplementation(async (key, fallback) => {
    const value = await original(key, fallback);
    if (key === 'ogt:credentials:v1' && ++reads === 2) { entered.resolve(); await release.promise; }
    return value;
  });
  const controller = new AbortController(), configuring = configureToken('candidate-token', controller.signal);
  await entered.promise; controller.abort(); release.resolve();
  await expect(configuring).rejects.toMatchObject({ name: 'AbortError' });
  expect((await readAuthScope()).authenticated).toBe(false);
});

it('cancellation during a delayed storage write restores the previous credential', async () => {
  setHttpHandler(async () => ({ body: { id: 1, login: 'api-user' } }));
  const initial = await configureToken('first-token');
  const original = GM.setValue, entered = deferred<void>(), release = deferred<void>();
  vi.spyOn(GM, 'setValue').mockImplementationOnce(async (key, value) => { entered.resolve(); await release.promise; await original(key, value); });
  const controller = new AbortController(), configuring = configureToken('candidate-token', controller.signal);
  await entered.promise; controller.abort(); release.resolve();
  await expect(configuring).rejects.toMatchObject({ name: 'AbortError' });
  expect(await readAuthScope()).toMatchObject({ login: initial.login, authenticated: true });
  const client = await getGitHubClient(await readAuthScope()); await client.getIdentity(new AbortController().signal);
  expect(requests.at(-1)?.headers?.Authorization).toBe('Bearer first-token');
});

it('a write which is not persisted cannot report a saved credential', async () => {
  setHttpHandler(async () => ({ body: { id: 1, login: 'api-user' } }));
  vi.spyOn(GM, 'setValue').mockResolvedValueOnce(undefined);
  await expect(configureToken('candidate-token')).rejects.toMatchObject({ stage: 'storage' });
  expect((await readAuthScope()).authenticated).toBe(false);
});
