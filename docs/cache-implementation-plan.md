# 目录块缓存实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline execution, or superpowers:subagent-driven-development if explicitly chosen. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 已落盘的目录进度在刷新后可复用，只补取缺失部分，不牺牲版本、权限或完整性判断。

**Architecture:** 在现有 storage 模块保存提交映射、原始目录响应和需拆分标记；preload 从块恢复索引及任务，缓存未命中才进入网络调度。main 保留在线仓库核验，公开仓库复用提交映射，非公开仓库仍在线核验 Contents 读取权限；不再持久化第二份完整索引。

**Tech Stack:** TypeScript strict、现有 GM API／Web Locks、Vitest、pnpm、Vite／vite-plugin-monkey；不增加依赖。

**Spec:** [目录缓存设计](./cache-design.md)、[完整性证明](./architecture.md#完整性证明)、[授权操作设计](./authentication.md#授权操作设计)。

状态：实施中。任务 1 的组合检查已通过；其余未勾选项仍为待执行计划，不是通过记录。沿用当前 docs 平铺结构，与首版开发计划分开维护。

## 全局约束

- 新目录数据与辅助元数据只使用 `ogt:cache:v2:`；阅读状态继续使用原 `view` 键，设置和凭据键不变。
- 总逻辑预算初值为 16 MiB，按 UTF-8 JSON 字节数计算，包括阅读状态，不包括设置、凭据；不是平台限制。取消目录记录的 4 MiB 门槛，不做分片。
- tree 网络并发最多 2、每批最多 40 次、主额度保留 5 次；缓存命中不消耗网络预算。实际限流的 Retry-After／reset 屏障保持有效。
- 仍默认主动预加载目录，不加载文件正文；目录树与查找共用索引。缓存、截断标记和队列耗尽均不能单独证明完整。
- 私有读取、写入前后及破坏性清理复核授权代号；Metadata 成功不能代替 Contents 权限。旧授权、旧版本结果不得覆盖新视图。
- 保留同上下文内存复用、搜索及阅读状态、300 ms 阅读状态合并写入、语言和设置同步；不增加设置页面或容量调节功能。
- 不持久化任务队列，不增加定时轮询、自动重试循环、跨标签页网络选主、离线阅读或跨平台支持。
- 每任务完成编辑后集中运行一次对应窄检查；新永久测试仅覆盖下列风险，已有行为测试随契约迁移，不重复造覆盖。
- 每任务通过后使用 eval 的 commit 命名空间提交本任务改动；不混入用户改动。最终生产构建集中在任务 5，不提前宣称功能交付。

## 文件分工

| 文件 | 本轮职责 |
|---|---|
| `src/types.ts` | 缓存读取结果与未解析根树的提交上下文类型 |
| `src/github.ts` | 提取可复用响应解析；保留 GET 接口及 API 错误边界 |
| `src/storage.ts` | v2 单键读写、授权保护、预算、需拆分标记和旧格式清理 |
| `src/preload.ts` | 本地恢复、缺失任务调度、按响应落盘及存储失败隔离 |
| `src/main.ts` | 提交映射、在线权限门禁、错误展示和旧快照链路退役 |
| `src/zh-CN.ts` | 替换旧 4 MiB 提示，沿用现有双语机制 |
| `tests/setup.ts` | 按锁名实现互斥，允许不同名锁嵌套 |
| `tests/storage.test.ts`、`preload.test.ts`、`navigation.test.ts` | 分别验证存储竞态、恢复完整性与用户导航契约 |

继续复用 `tests/gm.ts` 的存储、请求记录和 deferred；不引入第二套 GM 模拟器，也不重构无关 UI。

## 风险检查点

1. 慢 GM／存储锁争用、写入拒绝或确认前退出：先展示已取得条目，使用空闲工作槽；接受有界落盘背压但不承诺未确认部分可恢复，取消后不再推进旧任务；任务 1、3、4 验证，真实耗时在任务 5 单列。
2. 网络额度不足且缺失项排在缓存命中项之前：仍恢复后续缓存节点，只暂停缺失网络任务；任务 3 验证。
3. 相同 SHA 多路径、非递归截断、不同提交共享子树：不丢路径、不冒充完整、不串上下文；任务 3、4 验证。
4. 更换 Token 时旧写入、旧删除和旧 UI 回调晚到：不能复活旧私有数据或删除新授权记录；任务 1、2、4 验证。
5. 新旧标签页同时运行及预算回收：不清空旧 view，不让旧回收删除 v2，不将恢复骨架当成完整结果；任务 2、5 验证。

## 任务 1：单键读写

验证记录：任务 1 组合检查 `pnpm exec vitest run tests/storage.test.ts tests/github.test.ts tests/navigation.test.ts`，3 个文件、92 项通过；尚未构建或更新真实脚本。

**Files:** 修改 `src/types.ts`、`src/github.ts`、`src/storage.ts`、`tests/setup.ts`、`tests/storage.test.ts`、`tests/navigation.test.ts`、`src/zh-CN.ts`。

**Interfaces:** 新增以下类型／函数，现有 GitHubClient 方法签名不变：

```ts
// src/types.ts
export type CommitContext = Omit<RepoContext, 'rootTreeSha'>;
export type TreeCacheValue = { kind: 'response'; response: TreeResponse } | { kind: 'split' };
// src/github.ts
export function parseTreeResponse(value: unknown, expectedSha: string): TreeResponse | null;
// src/storage.ts
export function readCommitTree(context: CommitContext, scope: AuthScope): Promise<string | null>;
export function writeCommitTree(context: RepoContext, scope: AuthScope): Promise<void>;
export function readTreeBlock(context: RepoContext, scope: AuthScope, sha: string, recursive: boolean): Promise<TreeCacheValue | null>;
export function writeTreeBlock(context: RepoContext, scope: AuthScope, sha: string, recursive: boolean, response: TreeResponse): Promise<void>;
```

- [x] 增补 `tests/storage.test.ts` 中的 `treeBlockIdentityAndValidation`：不同 repoId／scope／SHA／recursive 不命中；损坏 schema、错误 SHA、非法相对路径、错误可见性按未命中处理；合法空响应仍可恢复。
  关键断言：`expect(await readCommitTree({ ...context, commitSha: sha(9) }, scope)).toBeNull()`；仅缓存递归响应后，`expect(await readTreeBlock(context, scope, context.rootTreeSha, false)).toBeNull()`。
- [x] 将现有 `privateCacheRequiresCurrentScope`、`visibilityChangeStopsPublicReuse`、`lateWriteCannotReviveClearedScope` 从旧快照迁移到提交映射及目录块，同步更新 GM 前缀拦截和残留断言。分别验证清除后 v2 提交映射／响应／split 及旧私有 view 不可读且失效记录已删除；旧轮清理不能删除替换值。GM 拒绝不能成功返回。
  split 清理使用直接写入的 schema 2 夹具，不依赖任务 2 的降级逻辑生成标记。
- [x] 调整受存储互斥影响的 deferred 用例：延迟发布先启动清理但不 await，释放写入后再等待两者；旧轮扫描用例先启动新 writeView，释放旧扫描后再等两者，保留新授权 view 仍在的断言。不得等待同一存储锁的排队任务完成后才释放锁持有者。
- [x] 实现以上接口：schema 2 的单键 JSON 记录包含 kind、repoId、scope、private、usedAt，以及对应 commitSha／treeSha／recursive／response；标记只允许 recursive=true 且无响应正文。完整记录身份必须与键一致。
- [x] `getTree` 和缓存读取共用 `parseTreeResponse`，保留现有 SHA／路径／条目类型校验；API 解析失败仍抛 ApiError，存储损坏只作未命中，不混为 API 成功或失败。
- [x] 新缓存变更统一进入 `opsgittrees:storage` 锁；需要授权锁的删除按 storage → authorization 顺序，禁止反向嵌套，锁内不做网络请求。私有发布保留 GM 写入前后授权复核；删除前核对值未被替换。
- [x] 在本任务扩展现有 `purgePrivateData(): Promise<void>`，删除失效授权的 v2 提交映射、目录响应、split 及旧私有记录，保留当前授权和 public 数据；删除复用上述锁序、授权复核及值未替换检查。此入口必须独立可用，不依赖任务 2 的预算扫描；授权失效清理不等于提前启用合法旧 tree 的升级删除。
- [x] 将 `tests/setup.ts` 的单一 lockTail 改为按锁名排队；不得把锁改成无互斥执行。保留 `writeView` 离开页面时同步提交状态的现有能力，不借机改设置或凭据流程。
- [x] 同一任务内删除 snapshotLimit，将仍在使用的旧快照／view 序列化和新目录记录的单记录准入统一按现有 16 MiB 总预算判断；保留旧快照读写供任务 4 切换前使用。同步更新 StorageLimitError 的总预算／内存可用提示及中文，不保留“按 4 MiB 拒写却报总预算”的中间状态。
- [x] 同步迁移现有 `oversizedSnapshotRemainsUsableInMemory`：构造超过总预算的响应，断言索引仍完整可查、持久化被拒绝且有提示，不再绑定旧 4 MiB 文案。预算内超过旧门槛的刷新恢复仍在任务 5 做一次性验证。
- [x] 运行 `pnpm exec vitest run tests/storage.test.ts tests/github.test.ts tests/navigation.test.ts`；预期全部通过、无挂起的锁任务，不遗留本任务已改变契约的导航失败。提交 `feat: persist validated directory response blocks`。

## 任务 2：回收与升级

**Files:** 修改 `src/storage.ts`、`tests/storage.test.ts`；消费任务 1 的 v2 记录与读写接口，不新增公开存储接口。

- [x] 添加 `evictionPreservesRecoverySkeleton`：总量超过 16 MiB 时先缩减截断正文，再淘汰普通块，最后才回收非递归枚举／split 标记；同级按最近使用提示排序，仍超预算时不永久固定骨架。
  关键断言：`expect(await readTreeBlock(context, scope, context.rootTreeSha, true)).toEqual({ kind: 'split' })`，且非递归枚举和已完成子块仍可读；回收不能改变原运行时索引的路径集合。
- [x] 添加 `splitRequiresCachedCoverage`：完整递归块或完整非递归枚举加全部已缓存完整后代才能证明覆盖；缺失／损坏子块和 split 本身不能证明覆盖。覆盖成立可将对应截断正文替为 split；容量压力下也可回收该正文，但必须保留不完整语义。
- [x] 添加 `latePartialWritesKeepStrongerBlocks`：同一键晚到的截断正文不覆盖完整响应或已有 split，完整响应可以替代 split。预算删除和降级复用任务 1 的授权及替换值检查；旧授权清理竞态已经在任务 1 验收，不延后到此处。
- [x] 添加 `legacyEvictionLeavesV2Untouched`：模拟旧版本按 `ogt:data:v1:` 回收，新 v2 数据仍可读。任务 4 切换前不启用旧 tree 的升级删除，避免提前破坏仍依赖旧快照的导航链路。
- [x] 改造预算扫描：合计 v2 数据、必要元数据及 view；切换前仍将合法旧 tree 计为普通预算项，任务 4 退出旧读写后才启用升级清理。每轮扫描只解析一次记录，覆盖证明按 SHA 记忆并检查访问环，不每个节点重建全索引。
- [x] 对已被缓存完整覆盖的截断响应及预算回收候选，使用相同键原子降为 split。覆盖证明只用已校验缓存块，不用“当前内存索引已完整”冒充已落盘后代仍存在。
- [x] 命中只更新有界的标签页内最近使用提示，回收时回退记录 usedAt；提示随记录清理，丢失只影响排序，不为命中重写大响应正文或增加一套持久化索引。
- [x] 将分级回收接入写后复核和启动维护，不承诺零瞬时超额；单记录超总预算拒写与 `purgePrivateData()` 的 v2／旧私有记录清理由任务 1 提供，本任务直接复用，不作为任务 1 的后置补丁。
- [x] 运行 `pnpm exec vitest run tests/storage.test.ts tests/credentials.test.ts`；预期全部通过。提交 `feat: reclaim cache blocks with safe version isolation`。

## 任务 3：缓存恢复

**Files:** 修改 `src/preload.ts`、`tests/preload.test.ts`；消费任务 1 的 readTreeBlock／writeTreeBlock，不新增调用方适配层。

**Interfaces:** 保持现有 `startPreload(context: RepoContext, scope: AuthScope, client: GitHubClient, onChange: (view: IndexView) => void, signal: AbortSignal): { resume(): void; prioritize(paths: readonly string[]): void }`。沿用 IndexView.reason 展示持久化问题，优先级低于网络、权限及完整性原因，不新增回调或状态字段。

**落盘取舍：** 本轮保留最多两项工作槽，每槽包含缓存读取、网络请求及响应落盘等待，不将其描述为两个始终饱和的纯网络槽。选择有界背压和简单收束：慢 GM 或锁争用可能延后后续请求，但不能延后已取得路径的展示，也不能让仍空闲的槽等待另一槽落盘。不提前引入后台发布队列，不能以跳过持久化掩盖成本。

- [x] 扩展现有截断、SHA 多路径、自动续批和 Retry-After 用例，不重复添加同义测试；保持现有调用接口。
- [x] 添加 `refreshRestoresOnlyCommittedBlocks`：根枚举与子树 a=sha(4) 已确认落盘、b=sha(5) 尚未完成时中止第一轮；只清空请求记录，不清空 GM，再用新实例恢复。a 路径立即可用，后续 Tree 请求只涉及缺失 b，不依赖旧实例内存；测试结束前释放所有 deferred 并收束旧任务，不能让异步写入污染下一个用例。
  关键断言：`expect(latest.entries.has('a/file.ts')).toBe(true)`；`expect(requests.filter(r => r.url.includes('/git/trees/')).map(r => new URL(r.url).pathname.split('/').pop())).toEqual([sha(5)])`。
- [x] 添加 `splitAndEnumerationSkipRecursiveRefetch`：只剩 split 时直取非递归响应；只剩非递归枚举时直接恢复子任务；缓存的非递归截断仍为 partial、pending=0，不自动重复请求。
- [x] 添加 `quotaDoesNotBlockCachedWork`：额度为 5 或仍处于 blockedUntil 时，缺失项即使先到也不妨碍后续缓存节点恢复；全命中可完成，混合命中只暂停缺失任务；缓存不占用 40 次网络批次或突破 2 个网络并发。
- [x] 添加 `cacheFailureDoesNotFailPreload`：GM 读取或写入失败不丢已取得路径，不转成 ApiError／停止网络补齐；reason 提示未持久化而内存仍可用，不覆盖更重要的 API／不完整原因；授权过期或 signal 取消仍停止旧任务。
- [x] 添加 `slowStorageKeepsPathsAndUsesIdleSlot`：分别用 deferred 阻塞首个 v2 GM 写入、持有 `opsgittrees:storage` 锁；等待未解除时，已取得的 ready.ts 已出现在索引，空闲第二槽已发起新发现的非递归请求。释放后缺失目录继续加载并完成；不使用真实延时维持用例。
- [x] 添加 `abortDuringStorageWaitStopsFollowupWork`：在上述等待期间取消，再释放 GM／锁，确认不再发起后续目录请求、不加入取消后晚到路径；测试结束前收束已启动操作，不遗留写入或锁持有者。
- [x] 调度分开处理本地恢复与已确认缺失的网络任务；先查完整递归块，再处理 split／非递归块，最后才决定网络请求。保留 SHA+recursive 的单次请求合并及各挂载前缀，不保存队列。
- [x] 每项网络响应先合并、发出可用索引并调度空闲工作槽，再 await 本响应块写入；最多两槽等待发布，不建立额外后台队列。每槽最终释放前收束写入，失败只记低优先级持久化 reason；signal 取消后不启动后续工作。GM 未确认或记录已淘汰不承诺恢复，不把落盘成功当作目录完整性证据。
- [x] 维持统一完整性证明：非递归截断为终止性不完整，split 不证明存在或不存在任何文件；网络被暂停时仍处理能够本地恢复的工作，不绕过实际限流。
- [x] 运行 `pnpm exec vitest run tests/preload.test.ts`；预期全部通过，旧额度／并发／取消契约不变；任务 1 已同步迁移门槛与导航断言，不以推迟相关检查保留已知失败。提交 `feat: resume preloading from persisted tree blocks`。

## 任务 4：导航接入

**Files:** 修改 `src/main.ts`、`src/storage.ts`、`tests/navigation.test.ts`、`tests/storage.test.ts`；消费任务 1 的提交映射与任务 3 的现有 IndexView 更新接口。

- [ ] 扩展现有同版本缓存导航用例：停止应用、清除请求记录后新建实例；公开仓库仍请求 Metadata，但命中提交映射及目录块后不请求 git/commits 或 git/trees。
- [ ] 添加 `privateCacheStillChecksContents`：缓存齐全时仍调用 getRepository 和 resolveTree；Metadata 成功但提交接口拒绝、凭据撤销或仓库从 public 变 private 时，不展示旧缓存目录。
  关键断言：提交接口拒绝后，`expect(paths()).not.toContain('sensitive.ts')`；公开缓存命中轮次的 git/commits 与 git/trees 请求都为零，Metadata 请求仍存在。
- [ ] 添加 `commitSwitchReusesOnlyMatchingSubtrees`：新提交重新取得根树，可复用 SHA 相同的子块；不同根树不当作同一完整索引；旧加载／缓存警告更新不得改变新页面。
- [ ] 在 Metadata 成功且页面提交已确认后组装 CommitContext；公开仓库先查提交映射，未命中才 resolveTree；非公开仓库始终 resolveTree 做 Contents 核验，之后才读任何持久化目录。
- [ ] 新解析结果通过 writeCommitTree 发布，缓存读写失败只降级为必要网络解析／内存使用；不使缓存错误掩盖真实权限错误。每次 await 后保留 generation、signal、active 及授权检查。
- [ ] 去掉 main 的 readTree 缓存分支和完整后 writeTree；保留两份完整内存索引复用及现有阅读状态恢复。存储错误通过当前索引 reason 展示，不把完整内存索引改判不完整，不覆盖更重要的 API 错误。
- [ ] 删除旧 readTree／writeTree／treeKey 及无调用的旧快照序列化路径，不留兼容导出；门槛、提示及授权测试已在任务 1 同步迁移，此处确认不再有旧接口调用。保留 view 的键、格式、同步提交能力及只用于升级识别的 v1 tree 解析。
- [ ] 与旧链路退役同批启用合法旧 tree 的升级删除，新增 `upgradeCleanupKeepsViewsAndPreferences`：只删除可解析且结构合法的旧 tree 键，删除前复核授权和当前值；旧 view、设置、凭据及无关键不因升级被清空。此清理不得在任务 1–3 提前启用。
- [ ] 运行 `pnpm exec vitest run tests/navigation.test.ts tests/storage.test.ts tests/preload.test.ts tests/github.test.ts`，随后 `pnpm typecheck`；预期全部通过。提交 `feat: use commit mappings and retire index snapshots`。

## 任务 5：真实验收

**Files:** 最终生成 `dist/opsgittrees.user.js`；按已观察结果更新 `docs/cache-design.md`、`directory-preloading.md`、`architecture.md`、`technology.md`、`development-plan.md` 及本计划状态。

- [ ] 使用一次性脚本复用现有 GM 测试适配器：构造 UTF-8 JSON 超过 4 MiB 且小于 16 MiB 的合法 TreeResponse，确认写入成功、新实例恢复指定路径且不重复 Tree 请求；与真实管理器结果分开记录，结束删除脚本。
- [ ] 运行 `pnpm build`；预期生成自包含生产包。前四任务已分别验证，不默认重复运行全套测试；若集成修正触及行为，只补跑对应窄检查。
- [ ] 按 `scriptcat-sctl-userscripts` 技能读取执行时的官方文档与 CLI 帮助，确认已配对在线实例和原脚本 UUID；若当前仍为旧版，先保留任务自有旧版标签页 A 不刷新，再安装构建产物。保留人工安装批准，不重装 CLI、不降低审批策略、不走备份导入。
- [ ] 安装若报告超时／失败，先查元数据，再在任务自有 GitHub 页面通过新版功能确认是否实际生效；不盲目重装、不把失败回执算成功、不读密钥或无关脚本。
- [ ] 在真实公开仓库验证完整缓存后刷新、站内切文件及分支、搜索和滚动状态恢复；记录浏览器／管理器版本、安装回执、提交／根树上下文和可见状态截图，不记录 Token 或私有路径。
- [ ] 对真实目录加载中刷新验证进度复用；另在真实双标签页观察 v2 块共享。保留的旧版 A 触发滚动保存／回收，新版 B 刷新验证 v2 仍可用及 view 未被升级清理；不来回降级全局脚本。若没有适用旧版页，按外部验收缺口记录。
- [ ] 实际请求计数必须覆盖管理器发出的 api.github.com 请求；页面请求数为零不能证明 GM 没发请求。若现有工具无法观测，明确标记计数未验证，不能仅凭加载快宣称命中。
- [ ] 单列存储性能证据：受控场景记录响应到达、首次可用、下一请求及写入释放的事件顺序；真实 ScriptCat 分别记录可观测的 GM 写入确认、锁等待、预算扫描与完整加载耗时。无法观测的成本标为未测，不能用模拟延迟冒充真实耗时，也不能宣称落盘零开销或持续两路网络吞吐。
- [ ] 获准的私有仓库再验证缓存齐全仍在线核验权限，以及换／清除 Token 后旧视图立即停止；没有获准环境则记录外部验收缺口，不擅改用户凭据或宣称已通过。
- [ ] 集成后做一次独立 code review，聚焦上述五项风险；修复已确认问题后只跑受影响的窄检查，不重启无关审计。
- [ ] 真实超大仓库若未触发截断、未处于预算压力或没有适用旧版本环境，不把受控测试算真实通过；限流时记录实际恢复时间，不轮询、绕过限流或注入假索引。
- [ ] 同步当前技术设计的旧快照／4 MiB 说明，并将缓存草案和预加载文档状态改为实际已验证范围；保留历史证据，不追改成新版本的通过记录。README 仅在需要修正当前能力说明时变更，不改其他产品文案。
- [ ] 校验变更文档的本地链接，记录各任务检查和未验证环境；提交产物、验证记录及本计划勾选状态，提交 `feat: deliver resumable directory caching`。未达成的必需场景不得勾选为完成。

## 执行顺序

任务 1 → 2 → 3 → 4 → 5；存储格式、回收和调度接口连续依赖，不拆成并行改同一文件的任务。执行前先审阅计划；建议原会话直接实施，集成后再做独立 review，不在本轮提前改运行代码。

## 相关文档

- [目录缓存设计](./cache-design.md#验收场景)
- [首版开发计划](./development-plan.md)
- [目录预加载](./directory-preloading.md#缓存约束)
