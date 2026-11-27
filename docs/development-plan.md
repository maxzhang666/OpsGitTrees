# 首版开发计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现可安装、自包含的 GitHub 文件导航油猴脚本，交付已确认的首版完整范围。

**Architecture:** 页面适配集中读取上下文；按实际版本主动预加载目录，以同一索引驱动过滤树和文件导航。原生侧栏占位，凭据存储与请求留在脚本上下文；页内弹窗的新输入及回填 Token 与 GitHub 共享 DOM，缓存按版本和授权隔离。

**Tech Stack:** TypeScript strict、Vite、vite-plugin-monkey、原生 DOM/CSS、Shadow DOM、GM API、Vitest、pnpm 用户级共享 store。

**Spec:** [技术设计](architecture.md)、[交互设计](interaction.md)、[仓库授权](authentication.md)、[产品需求](requirements.md)。

状态：首版阶段 1–5 的历史实现按修订保留；目录块缓存任务 1–4 的窄检查、全量测试与类型检查通过，当前生产构建 128.30 kB（gzip 34.74 kB）。版本 0.1.2 已更新到真实 ScriptCat（Chrome 156／ScriptCat 1.5.2），并实测空树分支 0 路径完整、main 58 路径完整。缓存持久化命中、真实 GM 存储成本、跨版本标签、获准私有仓库和跨浏览器／管理器矩阵仍未完成；见[验证记录](technology.md#本次实现与验证记录)和[缓存实现计划](cache-implementation-plan.md)。

## 全局约束

- 不重新讨论或缩减首版范围；功能不设人为付费门槛，不引入后端、UI 框架、远程运行依赖或其他平台支持。
- 左侧占位，原生树不动；不因窗口变窄自动收起或切成覆盖。首次展开，之后记住用户选择。
- 点击文件使用真实 GitHub 链接；目录整行切换展开；保留修饰键、中键、右键及前进／后退。
- 预加载目录而非代码内容；额度允许时按批次自动补齐，不以批次结束要求用户继续。搜索覆盖整个已取得的索引，未完整必须提示。目录命中不自动展开子树，搜索前快照与搜索中状态分别持久化，清空查询恢复原浏览状态。
- `Contents: read`／`Metadata: read` 为所列仓库接口的权限基线；不为私有访问失败索取写权限。连接成功不证明用户未授予额外权限。
- 初始值按 [技术设计](architecture.md#工程初值) 实施：展开宽 280 px、收起入口条 24 px、展开拖动 200–480 px；行高 24 px、上下各预留 8 行；搜索合并 80 ms；tree 并发 2、调度批大小 40、额度允许时自动续批、主额度保留 5 次；缓存总逻辑预算 16 MiB，无单记录 4 MiB 门槛；状态合并写入 300 ms。
- 默认快捷键 `Alt+Shift+O`／`Alt+Shift+F` 由 `Settings.shortcutsEnabled` 控制，默认 true；关闭后持久化，重新初始化仍不响应。收起后释放主体宽度，保留可点击的占位入口条，管理器菜单始终可以重开。
- pnpm 不覆盖用户共享 store 路径；只生成 pnpm 锁文件。脚本产物为 `dist/opsgittrees.user.js`，不把开发服务器依赖带进生产包。
- 每阶段完成变更后集中运行对应的窄检查一次；不在编辑中反复跑检查，不为配置、文案、导入或模拟兼容添加测试。
- 一次性验证脚本执行后删除；永久测试仅覆盖下列消费者可见风险。提交时使用 eval 的 commit 命名空间，不混入用户改动。

## 风险检查点

1. 带 `/` 的 ref 与含空格、中文、`#`、`%` 的路径：识别实际 GitHub 上下文，生成正确链接；由阶段 1 的 `page.test.ts` 覆盖。
2. 递归截断、非递归仍截断及相同 tree SHA 挂载多个路径：不能丢路径或提前宣布完整；由阶段 3 的 `preload.test.ts` 覆盖。
3. 清除凭据时旧标签页响应／持久化写入晚到：私有视图不可恢复；由阶段 2、3 的授权／存储测试覆盖，并在阶段 6 真实管理器验证。
4. 目录命中引发后代路径同时匹配、大小写不同的文件并存：不自动展开子树、不合并不同文件；由阶段 4 的 `search.test.ts` 覆盖。
5. GitHub 无刷新导航、历史回退、离开代码页：不重复挂载、不残留占位、不串阅读状态；由阶段 5 的状态测试及实际页面场景覆盖。

## 文件分工

源文件职责和公共类型只在 [技术设计](architecture.md#模块边界) 维护。下列工程、模块和风险测试均已创建。

- 工程：`package.json`、`pnpm-lock.yaml`、`tsconfig.json`、`vite.config.ts`、`src/vite-env.d.ts`、`.gitignore`。
- 运行模块：`src/main.ts`、`types.ts`、`i18n.ts`、`zh-CN.ts`、`page.ts`、`github.ts`、`credentials.ts`、`credential-window.ts`、`credential-window.css`、`preload.ts`、`tree-index.ts`、`search.ts`、`storage.ts`、`sidebar.ts`、`style.css`；这些相对文件名均在 `src/` 下。
- 风险测试：`tests/page.test.ts`、`credentials.test.ts`、`credential-window.test.ts`、`github.test.ts`、`preload.test.ts`、`storage.test.ts`、`search.test.ts`、`navigation.test.ts`；这些相对文件名均在 `tests/` 下。
- 仅在测试需要时保存脱敏页面片段到 `tests/fixtures/`；不提交 Token、私有仓库路径或整份页面账户数据。

## 阶段 1：页面与脚本骨架

**Files:** 创建工程配置、`src/main.ts`、`types.ts`、`page.ts`、`sidebar.ts`、`style.css` 与 `tests/page.test.ts`。

**Interfaces:** `readPage(document: Document, url: URL): PageState`；`observePage(onChange: () => void): () => void`；`fileUrl(context: PageContext, path: string): string`。侧栏通过 `mountSidebar(settings: Settings): SidebarHandle` 挂载，handle 提供 `setContext(state: PageState): void`、`setCollapsed(collapsed: boolean): void`、`reconnect(): void`、`destroy(): void`；GitHub 替换页面节点后重新挂接，不丢状态。

- [x] 核对 Node／pnpm 与 Vite／插件兼容关系并锁版本；定义 `dev`、`build`、`typecheck`、`test`，没有项目独立 store。
- [x] 读取真实首页、目录、文件及空仓库形状，将 ref、commit、path、empty 与主题／布局适配集中在 page。
- [x] 覆盖带 `/` 的 ref、特殊路径编码、非代码与保留路由、旧 SPA payload 拒绝；不猜版本。
- [x] 实现上下文、导航观察、占位与宿主重新挂接；真实页面完成 root→blob 导航并保留过滤状态。
- [x] 生产元数据限定 GitHub、顶层运行及实际 GM grants，`@connect` 仅 api.github.com；无 unsafeWindow 或页面 Token 中转。
- [ ] 完成后运行 `pnpm exec vitest run tests/page.test.ts`、`pnpm typecheck`、`pnpm build`；应全部成功。安装产物，实际观察支持页面的左侧占位、收起后仅保留入口条、进入非代码页后完全恢复原布局及窄窗口不自动收起。

## 阶段 2：只读 API 与凭据

**Files:** 创建 `src/github.ts`、`credentials.ts`、`storage.ts`，修改 `types.ts`、`main.ts`；新增 `tests/github.test.ts`、`credentials.test.ts`。

**Interfaces:** `createGitHubClient(token: string | null): GitHubClient` 将 Token 留在私有闭包；client 暴露脱敏的 `quota: {remaining: number | null; resumeAt: number | null; blockedUntil: number | null}`，实际限流禁行时间独立于普通 reset。

- `getIdentity(signal: AbortSignal): Promise<{id: number; login: string}>`：检查凭据身份。
- `getRepository(owner: string, repo: string, signal: AbortSignal): Promise<RepositoryMetadata>`：仅取得仓库标识、访问权和可见性，不要求 commit，适用于 code 和 empty 状态。
- `resolveTree(page: PageContext, repository: RepositoryMetadata, signal: AbortSignal): Promise<RepoContext>`：确认仓库标识一致后，用实际提交取得根 tree SHA；empty 状态不调用。
- `getTree(context: RepoContext, sha: string, recursive: boolean, signal: AbortSignal): Promise<{sha: string; truncated: boolean; tree: TreeEntry[]}>`：读取目录元数据。

credentials 提供 `readAuthScope(): Promise<AuthScope>`、`getGitHubClient(scope: AuthScope): Promise<GitHubClient>`、`observeAuthScope(listener: (scope: AuthScope) => void): () => void`。匿名 scope 的 client 不携带 Token；PAT client 在模块内部核对当前代号后构造，不把 Token 返回给 main 或 UI。代号过期时拒绝构造，主控制器重新读取当前授权。

- [x] 覆盖访问错误与空状态，不伪装空树；空仓库元数据无需 commit，也不声称已验证 Contents。
- [x] 实现固定 GET、参数编码、API 版本、取消、响应头及独立限流截止时间；只读 Git commit 元数据，非递归省略 recursive 参数。
- [x] 主控制器在配置后默认使用 PAT client（含公开仓库），未配置时匿名；PAT 失败不匿名循环；empty 只检查元数据。
- [x] 凭据替换、取消、清除与晚到读取回归通过；最终提交与清除持同源 Web Lock，旧配置不能覆盖清除；取消写入恢复旧值并换代号。
- [x] 实现侧栏及 GM 菜单打开独立密码窗口、身份校验、凭据写入／读回及代号通知；删除原生输入流程。
- [ ] 真实管理器的窗口、内容世界、私有引用及菜单须按下方 Token 修订记录验收；模拟 GM／窗口边界不能作为隔离证明，未运行的浏览器／管理器组合不算通过。

## 阶段 3：完整索引与缓存

**Files:** 创建 `src/preload.ts`、`tree-index.ts`，完善 `storage.ts`，接入 `main.ts`；新增 `tests/preload.test.ts`、`storage.test.ts`。

- **Interfaces:** `startPreload(context, scope, client, onChange, signal): {resume(): void; prioritize(paths: readonly string[]): void}`；缓存层提供 `readCommitTree`／`writeCommitTree` 及 `readTreeBlock`／`writeTreeBlock`，保存通过校验的提交映射与独立目录响应块，不持久化第二份完整索引。

- [x] 覆盖递归／非递归截断、同 SHA 双路径、超过 40 请求自动续批、低额度暂停和双并发失败不清除 Retry-After。
- [x] 实现主动补齐、优先级、SHA 合并、两路并发及事件循环续批；上下文取消旧任务。
- [x] 覆盖私有 scope、公开转私有、超大索引内存可用、旧授权晚写及旧清理不误删新授权状态。
- [x] 覆盖授权隔离、v2 单键响应写入与 16 MiB 总预算；目录块分级回收、截断覆盖证明、受限最近使用和旧新键空间隔离详见 [缓存实现计划](cache-implementation-plan.md) 的任务 1–2。
- [x] 恢复阶段从已落盘递归块／split／非递归枚举重建索引，只调度缺失目录；响应先发布路径再等待有界工作槽落盘。旧 Tree snapshot API 已在任务 4 退役。

## 阶段 4：过滤树与导航

**Files:** 创建 `src/search.ts`，完善 `tree-index.ts`、`sidebar.ts`、`style.css`；新增 `tests/search.test.ts`。

**Interfaces:** `filterTree(index: IndexView, query: string): {included: ReadonlySet<string>; autoExpanded: ReadonlySet<string>}`；`visiblePaths(index: IndexView, included: ReadonlySet<string> | null, expanded: ReadonlySet<string>): readonly string[]`。扩展 `SidebarHandle`：`setIndex(view: IndexView): void`、`setCurrentPath(path: string): void`、`focusSearch(): void`、`locateCurrent(): void`、`onResumePreload(listener: () => void): () => void`；继续入口交给 main 调用当前预加载任务的 `resume()`，批次正常结束不显示该入口。

- [x] 目录命中不展开后代，手动展开仍可浏览完整保留子树。
- [x] 搜索忽略大小写但路径不合并，文件命中仅保留必要祖先，覆盖未展开目录。
- [x] 实现目录优先、真实文件链接、当前项高亮、过滤树和可信状态；名称使用 textContent。
- [x] 固定行高窗口化，滚动只更新窗口；10 万条场景树行 DOM 峰值 42。
- [x] search 测试及类型检查通过；真实 GitHub 页面观察目录不跳转、文件展示、Cmd／中键新标签、过滤树与主题。使用生产包和明确披露的 GM 测试适配器，不冒充管理器安装。

## 阶段 5：阅读状态与设置

**Files:** 完善 `src/main.ts`、`page.ts`、`sidebar.ts`、`storage.ts`、`credentials.ts`；新增 `tests/navigation.test.ts`，补充 `storage.test.ts` 的状态隔离场景。

**Interfaces:** 存储提供 `readSettings(): Promise<Settings>`、`writeSettings(changes: Partial<Settings>): Promise<void>`、`observeSettings(listener: (settings: Settings) => void): () => void`、`readView(context: RepoContext, scope: AuthScope): Promise<ViewState | null>`、`writeView(context: RepoContext, scope: AuthScope, state: ViewState): Promise<void>`。设置按实际变更字段串行合并，跨标签同步，离开页面不回写未改动的旧副本。`Settings` 必须包括 `shortcutsEnabled`；`ViewState` 整体保存 `browsing: TreeViewState` 与 `search: SearchState | null`，字段及有效展开规则以技术设计为准，不能只保存当前屏幕的一份状态。

- 扩展 `SidebarHandle`：`setSettings(settings: Settings): void` 接收全局设置而不反向触发保存；`getView(): ViewState`、`restoreView(state: ViewState): void`、`onViewChange(listener: (state: ViewState) => void): () => void`、`onSettingsChange(listener: (settings: Settings) => void): () => void`，由 main 保存状态，不把 Token 放入 handle。
- 授权面板接口为 `setAuth(scope: AuthScope): void`、`onManageToken(listener: () => void)`、`setConnectionStatus(message: Text): void`；弹窗控制器为 `createCredentialManager(notice, checkRepository): {open(): void, close(): void}`。设置页只打开弹窗；清除及仓库检查集中在弹窗，检查由 main 执行并返回参数化结果。关闭／取消中止检查，不让晚到结果更新新的弹窗。

- [x] 双快照序列化后销毁／重建恢复、同版本切文件、分支隔离与旧上下文拒绝回归通过。
- [x] 普通／搜索独立快照、300 ms 合并写入及离开补写；隐藏／脱离 DOM 不覆盖滚动，部分索引不误删路径。
- [x] 收起／宽度、定位、快捷键设置与菜单重开已实现；深层自动定位不覆盖收起偏好，关闭快捷键后重新初始化仍禁用。
- [x] 设置面板仅显示授权状态与“管理 Token”入口；Token 输入、清除、身份和仓库检查及简短权限提示均在管理弹窗中。
- [ ] 完成后运行 `pnpm exec vitest run tests/navigation.test.ts tests/storage.test.ts` 与 `pnpm typecheck`；应全部通过。实际完成搜索→手动展开并滚动→点文件→整页刷新→清空、切分支→返回、代码页→Issues→代码页、手动收起→刷新、关闭快捷键→刷新→按键无响应但菜单可重开、窄窗口与原生树同时展开；每步观察页面实际结果。

## 阶段 6：交付验证

**Files:** 修改 `vite.config.ts` 的最终打包元数据及现有 `docs/technology.md`、`directory-preloading.md`、`authentication.md`，记录真实版本、资源测量和未验证组合；不把设计状态改成未经证实的完成。

- [ ] 用一次性 10 万条合成索引验证搜索、展开、窗口化与滚动，记录耗时、峰值 DOM、内存和 GM 序列化成本；再测真实大小仓库的冷启动／缓存命中。合成数据不得冒充 GitHub 截断验证。
- [ ] 使用明确获准的测试私有仓库和凭据验证最小权限、访问拒绝、过期／撤销、切换／清除、跨标签晚到写入及缓存清理；不自行创建令牌或授予第三方权限。
- [ ] 在目标 Chrome／Edge／Firefox 与 Tampermonkey／Violentmonkey 组合中安装生产包，验证 GM 隔离、请求、跨域重定向、菜单、站内导航和布局。逐项记录实际运行版本；未能运行的组合和原因如实披露，不能用模拟代替。
- [ ] 测量不满足交互或资源约束时，修正实现或调整工程初值并同步技术设计，不增加框架、数据库或压缩库来掩盖未定位的问题。
- [x] 最终 `pnpm test`（52 项）、`pnpm typecheck`、`pnpm build` 成功；生产包已通过 sctl 在真实 ScriptCat 中安装并启用。已运行的实际场景见 [验证记录](technology.md#真实-scriptcat-安装与验收)，不代替阶段 1、5、6 尚未勾选的组合验收。
- [x] 删除一次性压力脚本和 QA 适配器临时文件；没有创建／保存真实测试凭据或私有原始数据。更新完成状态、测量和未验证组合；README 只更新当前状态，不重写文档结构。

## 完成条件

[产品需求](requirements.md#体验验收) 与 [交互验收](interaction.md#验收场景) 均有对应实际证据，关键风险测试通过，生产包可独立安装。失败、未运行或缺少获准私有测试条件的项目必须明确披露；完成其余可达工作不等于宣称这些项目已完成。

## Token 管理界面修订

以脚本自己的配置表单替代 `alert`／`prompt`，不要求手工编辑管理器存储。此前误做成浏览器独立窗口；按用户反馈改为当前页面内的模态弹窗，不另建窗口／标签。保留原验证及存储逻辑。

### 方案与安全边界

- 使用原生 `<dialog>` 和 Shadow DOM，在当前页面显示遮罩及表单；Shadow DOM 仅隔离样式，GitHub 页面脚本可以读取新输入及回填的已存 Token，不宣称输入隔离。
- 删除 `window.open`、opener／窗口名称检查和窗口生命周期；使用原生焦点约束，右上角关闭、Esc、遮罩点击统一取消未完成验证、清空输入并移除弹窗。
- 保留 DOM／content 模式检查，凭据存储和 API 请求在脚本上下文中，回显值按授权代号读取后填入弹窗；这些检查不能使共享 DOM 中的 Token 保密。明暗样式复用页面主题观察。
- 弹窗打开时回填已有 Token，默认密码遮罩，用输入框右侧眼睛按钮切换明文／遮罩；关闭清空、重开重新读取并恢复遮罩。保存先验证 `GET /user`，再持锁检查代号并等待 GM 写入／读回。失败保留旧凭据；关闭、取消、清除使晚到保存失效，异步回显不覆盖正在输入的替换值。
- 已验证并保存的 Token 默认用于全部 GitHub API 请求，包括公开仓库；删除 `useTokenForPublic` 双重开关及所有调用。没有 Token 时匿名，不以认证失败后的匿名重试掩盖错误。

### 实施与验证

- [x] `src/credentials.ts` 接收显式候选和取消信号，报告身份检查／存储阶段错误；现有替换、清除、晚到结果测试迁移到新接口。
- [x] `src/credential-window.ts` 和样式使用页内密码弹窗；侧栏及管理器入口复用同一弹窗，不打开浏览器窗口。按用户新要求回填已存 Token，并用输入框内右侧眼睛按钮显隐。
- [x] 保留内容世界检查及授权存储逻辑，迁移不回填的旧测试契约，覆盖默认遮罩、眼睛显隐、重开回填、拒绝替换、清除后的晚到读取和输入中的替换值不被覆盖。
- [x] 历史首次页内弹窗的四个文件共 36 项检查通过。本轮回显和眼睛按钮的三个定向文件共 27 项、类型检查及生产构建通过；最终包已更新到真实 ScriptCat，已有用户 Token 在打开时回填且遮罩，实际验证输入框内右侧眼睛显隐和关闭重开。未记录 Token 原文或改动真实凭据。
- [ ] 真实有效 Token 的完整验证／保存／读回与清除、私有仓库及其他管理器仍待明确获准环境；已有保存状态或回显不能代替本轮完整写入／清除证据。沿用用户此前确认的外部验收缺口。

旧流程只有输入 → 身份检查 → 凭据提交，失败被笼统化；用户报告未找到凭据记录属实。没有该次请求／提交证据，不追认历史失败的具体外部原因。

