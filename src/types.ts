import type { LanguagePreference, Text } from './i18n';

export type Path = string;
export interface PageContext {
  owner: string;
  repo: string;
  refName: string;
  commitSha: string;
  path: string;
  refKind: 'branch' | 'tag' | 'commit';
  view: 'root' | 'tree' | 'blob';
}
export type PageState = { kind: 'code'; context: PageContext } | { kind: 'empty'; owner: string; repo: string } | { kind: 'outside' } | { kind: 'unresolved'; message: Text };
export interface RepositoryMetadata { owner: string; repo: string; repoId: number; visibility: 'public' | 'private' | 'internal' }
export interface RepoContext extends PageContext, RepositoryMetadata { rootTreeSha: string }
export interface AuthScope { id: string; login: string | null; authenticated: boolean }
export interface TreeEntry { path: string; name: string; sha: string; mode: string; type: 'tree' | 'blob' | 'commit' }
export type LoadState = 'loading' | 'partial' | 'complete' | 'paused' | 'failed' | 'empty';
export interface IndexView {
  entries: ReadonlyMap<Path, TreeEntry>;
  children: ReadonlyMap<Path, readonly Path[]>;
  state: LoadState;
  pending: number;
  reason?: Text;
  canResume?: boolean;
  resumeAt?: number;
}
export interface TreeViewState { expanded: string[]; scrollTop: number; anchorPath: string | null; anchorOffset: number }
export interface SearchState { query: string; view: TreeViewState; collapsed: string[] }
export interface ViewState { browsing: TreeViewState; search: SearchState | null }
export interface Settings { collapsed: boolean; width: number; shortcutsEnabled: boolean; language: LanguagePreference }
export interface TreeResponse { sha: string; truncated: boolean; tree: TreeEntry[] }
export interface GitHubClient {
  readonly quota: { remaining: number | null; resumeAt: number | null; blockedUntil: number | null };
  getIdentity(signal: AbortSignal): Promise<{ id: number; login: string }>;
  getRepository(owner: string, repo: string, signal: AbortSignal): Promise<RepositoryMetadata>;
  resolveTree(page: PageContext, repository: RepositoryMetadata, signal: AbortSignal): Promise<RepoContext>;
  getTree(context: RepoContext, sha: string, recursive: boolean, signal: AbortSignal): Promise<TreeResponse>;
}
export interface SidebarHandle {
  reconnect(): void;
  setContext(state: PageState): void;
  setSettings(settings: Settings): void;
  setCollapsed(collapsed: boolean): void;
  setIndex(view: IndexView): void;
  setCurrentPath(path: string): void;
  focusSearch(): void;
  locateCurrent(): void;
  getView(): ViewState;
  restoreView(state: ViewState): void;
  onViewChange(listener: (state: ViewState) => void): () => void;
  onSettingsChange(listener: (settings: Settings) => void): () => void;
  onResumePreload(listener: () => void): () => void;
  onManageToken(listener: () => void): () => void;
  onVisiblePaths(listener: (paths: readonly string[]) => void): () => void;
  setAuth(scope: AuthScope): void;
  setConnectionStatus(message: Text): void;
  destroy(): void;
}
