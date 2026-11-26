import { isAuthScopeCurrent } from './credentials';
import { ApiError } from './github';
import { msg, type Text } from './i18n';
import { TreeIndex } from './tree-index';
import type { AuthScope, GitHubClient, IndexView, RepoContext, TreeResponse } from './types';

interface Task { sha: string; prefix: string; recursive: boolean }
export function startPreload(context: RepoContext, scope: AuthScope, client: GitHubClient, onChange: (view: IndexView) => void, signal: AbortSignal): { resume(): void; prioritize(paths: readonly string[]): void } {
  const index = new TreeIndex();
  const queue: Task[] = [{ sha: context.rootTreeSha, prefix: '', recursive: true }];
  const responses = new Map<string, Promise<TreeResponse>>();
  let visible = new Set<string>();
  let active = 0, batchRequests = 0, timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false, terminalIncomplete = false;
  let state: IndexView['state'] = 'loading';
  let reason: Text | undefined;
  let canResume = false;
  let resumeAt: number | undefined;
  const emit = () => { if (!signal.aborted) onChange({ ...index.view(state, queue.length + active, reason), canResume, resumeAt }); };
  const priority = (task: Task) => !task.prefix || context.path === task.prefix || context.path.startsWith(task.prefix + '/') ? 0 : visible.has(task.prefix) ? 1 : 2;
  function pause(message: Text, nextState: 'paused' | 'failed', retry: boolean, at?: number) {
    stopped = true;
    if (resumeAt && resumeAt > Date.now() && !at && retry) { emit(); return; }
    state = nextState; reason = message; canResume = retry;
    resumeAt = Math.max(resumeAt || 0, at || 0) || undefined;
    emit();
  }
  function schedule(): void {
    if (signal.aborted || stopped) return;
    const quota = client.quota;
    if (quota.resumeAt && Date.now() >= quota.resumeAt) { quota.remaining = null; quota.resumeAt = null; }
    if (queue.length && quota.blockedUntil && quota.blockedUntil > Date.now()) { pause(msg('GitHub rate limit remains active.'), 'paused', true, quota.blockedUntil); return; }
    if (queue.length && quota.remaining !== null && quota.remaining <= 5) {
      pause(msg('GitHub request quota is low. Loaded paths remain usable; continue after the quota resets.'), 'paused', true, quota.resumeAt || undefined); return;
    }
    if (!queue.length && !active) {
      state = terminalIncomplete ? 'partial' : 'complete';
      if (terminalIncomplete) reason = msg('GitHub truncated a non-recursive directory listing. Results remain incomplete; this API cannot enumerate all entries.');
      responses.clear(); emit(); return;
    }
    if (batchRequests >= 40) {
      if (!active && !timer) timer = setTimeout(() => { timer = undefined; batchRequests = 0; schedule(); }, 0);
      return;
    }
    queue.sort((a, b) => priority(a) - priority(b));
    while (active < 2 && queue.length && batchRequests < 40 && !stopped) {
      const task = queue.shift()!;
      active++;
      void run(task);
    }
  }
  async function run(task: Task): Promise<void> {
    const key = task.sha + ':' + task.recursive;
    try {
      let response = responses.get(key);
      if (!response) { batchRequests++; response = client.getTree(context, task.sha, task.recursive, signal); responses.set(key, response); }
      const data = await response;
      if (signal.aborted) return;
      if (context.visibility !== 'public' && !isAuthScopeCurrent(scope)) {
        index.entries.clear(); index.children.clear(); queue.length = 0; responses.clear();
        pause(msg('Authorization changed; private index cleared.'), 'failed', false); return;
      }
      index.add(data.tree, task.prefix);
      if (task.recursive && data.truncated) queue.push({ ...task, recursive: false });
      else if (!task.recursive) {
        if (data.truncated) terminalIncomplete = true;
        for (const entry of data.tree) if (entry.type === 'tree') queue.push({ sha: entry.sha, prefix: task.prefix ? task.prefix + '/' + entry.path : entry.path, recursive: true });
      }
      if (!stopped) state = 'partial';
    } catch (error) {
      if (signal.aborted) return;
      responses.delete(key);
      queue.unshift(task);
      const failure = error instanceof ApiError ? error : new ApiError('network', msg('Directory request failed.'));
      pause(failure.detail, failure.kind === 'rate' ? 'paused' : 'failed', failure.kind === 'rate' || failure.kind === 'network', failure.resumeAt || undefined);
    } finally {
      active--;
      if (!signal.aborted) { emit(); schedule(); }
    }
  }
  signal.addEventListener('abort', () => { clearTimeout(timer); queue.length = 0; responses.clear(); }, { once: true });
  queueMicrotask(() => { emit(); schedule(); });
  return {
    resume() {
      if (signal.aborted || !stopped || !canResume || (resumeAt && Date.now() < resumeAt)) return;
      if (client.quota.blockedUntil && client.quota.blockedUntil > Date.now()) return;
      if (client.quota.remaining !== null && client.quota.remaining <= 5 && (!client.quota.resumeAt || Date.now() < client.quota.resumeAt)) return;
      stopped = false; state = 'partial'; reason = undefined; canResume = false; resumeAt = undefined; batchRequests = 0; schedule();
    },
    prioritize(paths) { visible = new Set(paths); },
  };
}
