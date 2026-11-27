import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { createCredentialManager } from '../src/credential-window';
import { clearToken, configureToken, readAuthScope } from '../src/credentials';
import { deferred, GM, GM_info, requests, setHttpHandler } from './gm';
import { setLanguage } from '../src/i18n';

let manager: ReturnType<typeof createCredentialManager> | undefined;
const checkRepository = async () => { throw new Error('Unexpected repository check'); };
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});
afterEach(() => { manager?.close(); manager = undefined; setLanguage('auto'); });
const root = () => document.querySelector('#opsgittrees-credentials')!.shadowRoot!;
function submit(token: string) {
  root().querySelector<HTMLInputElement>('#token')!.value = token;
  root().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
}

it('the saved Token is prefilled and the eye button reveals it, while reopening restores the mask', async () => {
  setHttpHandler(async () => ({ body: { id: 1, login: 'api-user' } }));
  manager = createCredentialManager(() => {}, checkRepository); manager.open(); submit('candidate-token');
  await vi.waitFor(async () => expect((await readAuthScope()).authenticated).toBe(true));
  await vi.waitFor(() => expect(root().querySelector('.result')?.getAttribute('data-kind')).toBe('success'));
  await vi.waitFor(() => expect(root().querySelector<HTMLInputElement>('#token')!.value).toBe('candidate-token'));
  const input = root().querySelector<HTMLInputElement>('#token')!;
  expect(input.type).toBe('password');
  root().querySelector<HTMLButtonElement>('button[aria-label="Show Token"]')!.click();
  expect(input.type).toBe('text'); expect(input.value).toBe('candidate-token');
  root().querySelector<HTMLButtonElement>('button[aria-label="Hide Token"]')!.click();
  expect(input.type).toBe('password');
  root().querySelector<HTMLButtonElement>('.close')!.click(); manager.open();
  await vi.waitFor(() => expect(root().querySelector<HTMLInputElement>('#token')!.value).toBe('candidate-token'));
  expect(root().querySelector<HTMLInputElement>('#token')!.type).toBe('password');
  root().querySelector<HTMLButtonElement>('button.danger')!.click();
  await vi.waitFor(async () => expect((await readAuthScope()).authenticated).toBe(false));
  await vi.waitFor(() => expect(root().querySelector<HTMLInputElement>('#token')!.value).toBe(''));
});
it('expands into actionable fine-grained Token creation steps', () => {
  setLanguage('en');
  manager = createCredentialManager(() => {}, checkRepository); manager.open();
  const instructions = root().querySelector<HTMLDetailsElement>('.token-steps');
  expect(instructions).not.toBeNull();
  expect(instructions!.open).toBe(false);
  instructions!.querySelector('summary')!.click();
  expect(instructions!.open).toBe(true);
  expect([...instructions!.querySelectorAll('li')].map(step => step.textContent)).toEqual([
    'Open the “Create a fine-grained Token” link above. Enter a name and expiration, then select the Resource owner that owns the repository.',
    'Under Repository access, choose Only select repositories and select the repository you need.',
    'Under Repository permissions, set Contents and Metadata to Read-only. Leave all other permissions set to No access.',
    'Click Generate token and copy it. Treat the token as confidential; never share it.',
    'Return here, paste the token above, and select Verify & save. Then use Check current repository to test repository access.',
  ]);
  setLanguage('zh-CN');
  expect(instructions!.querySelector('summary')!.textContent).toBe('如何创建细粒度 Token');
  expect([...instructions!.querySelectorAll('li')].map(step => step.textContent)).toEqual([
    '点击上方“创建细粒度 Token”链接，填写 Token 名称、有效期，并在 Resource owner 中选择目标仓库所属的个人账户或组织。',
    '在 Repository access 中选择 Only select repositories，再选中需要读取的仓库。',
    '在 Repository permissions 中将 Contents 和 Metadata 设为 Read-only；其他权限保持 No access。',
    '点击 Generate token 生成并复制令牌。请妥善保管，不要分享给他人。',
    '回到此弹窗，将令牌粘贴到上方并点击“验证并保存”；再点击“检查当前仓库”确认读取权限。',
  ]);
});

it('a rejected replacement stays in the dialog as an identity error and preserves the stored credential', async () => {
  setHttpHandler(async () => ({ body: { id: 1, login: 'api-user' } })); const initial = await configureToken('existing-token');
  manager = createCredentialManager(() => {}, checkRepository); manager.open();
  setHttpHandler(async () => ({ status: 401, body: {} })); submit('invalid-token');
  await vi.waitFor(() => expect(root().querySelector('.result')?.getAttribute('data-kind')).toBe('error'));
  expect(await readAuthScope()).toEqual(initial);
  await vi.waitFor(() => expect(root().querySelector<HTMLInputElement>('#token')!.value).toBe('existing-token'));
  expect(root().querySelector('.result')?.textContent).toContain('401');
});

it('dismissing the dialog cancels a pending identity check instead of saving its late response', async () => {
  const reply = deferred<{ body: unknown }>(); setHttpHandler(() => reply.promise);
  manager = createCredentialManager(() => {}, checkRepository); manager.open(); submit('candidate-token');
  await vi.waitFor(() => expect(requests.some(request => request.url.endsWith('/user'))).toBe(true));
  const input = root().querySelector<HTMLInputElement>('#token')!;
  root().querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true }));
  expect(document.querySelector('#opsgittrees-credentials')).toBeNull();
  expect(input.value).toBe('');
  reply.resolve({ body: { id: 1, login: 'api-user' } });
  await new Promise(done => setTimeout(done, 0));
  expect((await readAuthScope()).authenticated).toBe(false);
});

it('unrecognized execution contexts do not open a Token input dialog', async () => {
  GM_info.scriptHandler = 'Unrecognized manager';
  manager = createCredentialManager(() => {}, checkRepository); manager.open();
  expect(document.querySelector('#opsgittrees-credentials')).toBeNull();
  expect((await readAuthScope()).authenticated).toBe(false);
});

it('a delayed saved Token read cannot overwrite a replacement being typed', async () => {
  setHttpHandler(async () => ({ body: { id: 1, login: 'api-user' } })); await configureToken('existing-token');
  const original = GM.getValue, entered = deferred<void>(), release = deferred<void>();
  vi.spyOn(GM, 'getValue').mockImplementationOnce(async (key, fallback) => { const value = await original(key, fallback); entered.resolve(); await release.promise; return value; });
  manager = createCredentialManager(() => {}, checkRepository); manager.open(); await entered.promise;
  const input = root().querySelector<HTMLInputElement>('#token')!;
  input.value = 'replacement-token'; input.dispatchEvent(new Event('input', { bubbles: true }));
  release.resolve();
  await vi.waitFor(() => expect(root().querySelector('.summary')?.textContent).toContain('@api-user'));
  expect(input.value).toBe('replacement-token');
});

it('a delayed saved Token read cannot restore a cleared credential', async () => {
  setHttpHandler(async () => ({ body: { id: 1, login: 'api-user' } })); await configureToken('existing-token');
  const original = GM.getValue, entered = deferred<void>(), release = deferred<void>(); let reads = 0;
  vi.spyOn(GM, 'getValue').mockImplementation(async (key, fallback) => {
    const value = await original(key, fallback);
    if (key === 'ogt:credentials:v1' && ++reads === 2) { entered.resolve(); await release.promise; }
    return value;
  });
  manager = createCredentialManager(() => {}, checkRepository); manager.open(); await entered.promise;
  await clearToken(); release.resolve();
  await vi.waitFor(() => expect(root().querySelector('.summary')?.textContent).toContain('Not configured'));
  await new Promise(done => setTimeout(done, 0));
  expect(root().querySelector<HTMLInputElement>('#token')!.value).toBe('');
});

it('live translation preserves a Token draft and translates a previous identity failure', async () => {
  setLanguage('en'); setHttpHandler(async () => ({ status: 401, body: {} }));
  manager = createCredentialManager(() => {}, checkRepository); manager.open(); submit('invalid-token');
  await vi.waitFor(() => expect(root().querySelector('.result')?.getAttribute('data-kind')).toBe('error'));
  const input = root().querySelector<HTMLInputElement>('#token')!;
  input.value = 'replacement-draft'; input.dispatchEvent(new Event('input'));
  const requestCount = requests.length;
  setLanguage('zh-CN');
  expect(root().querySelector('.result')?.textContent).toContain('身份验证阶段');
  expect(root().querySelector('.result')?.textContent).toContain('HTTP 401');
  expect(root().querySelector('button[aria-label="显示 Token"]')).not.toBeNull();
  expect(input.value).toBe('replacement-draft'); expect(input.type).toBe('password');
  setLanguage('en');
  expect(root().querySelector('.result')?.textContent).toContain('identity stage');
  expect(input.value).toBe('replacement-draft'); expect(requests).toHaveLength(requestCount);
});
