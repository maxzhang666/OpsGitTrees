# 技术设计

状态：首版模块已有实现及自包含生产包；逻辑检查和浏览器表面验证记录见 [技术选型](technology.md#本次实现与验证记录)。已在真实 ScriptCat 安装并验证部分行为；私有仓库及原定跨浏览器验收尚未完成，不将该单一环境扩大为所有组合兼容或凭据隔离已验证。

产品约束见 [产品需求](requirements.md)，操作约定见 [交互设计](interaction.md)，工具链见 [技术选型](technology.md)，授权细节见 [仓库授权](authentication.md)，实施顺序见 [开发计划](development-plan.md)。沿用现有平铺文档，不另建文档体系。

## 目标与取舍

- 做面向大众的 GitHub 文件导航脚本：预加载目录索引、本地展开和路径查找，代码仍由 GitHub 展示。
- 首版只在仓库首页、目录页和文件页显示；不增加 PR 审查、全文代码搜索、编辑器、后端或其他平台支持。
- 不接受错误版本的树、把请求失败当空目录、截断索引冒充完整结果、凭据出现在页面或无界后台请求。

| 路线 | 结论与代价 |
|---|---|
| 增强原生文件树 | 已放弃；功能依附 GitHub 内部树结构 |
| 独立侧栏、原生 DOM、Shadow DOM | 已选择；自行管理导航、状态和页面占位，原生树不动 |
| 引入 UI／状态框架、独立阅读器 | 不采用；当前范围不值得增加运行依赖和重复展示职责 |
| 点击加载／无界遍历 | 不采用；使用递归索引优先、截断后受控补齐，见 [目录预加载](directory-preloading.md) |

## 模块边界

```text
GitHub 页面 → page → main → github / credentials
                          → preload → tree-index → search → sidebar
                          → storage
```

以下文件已创建；不建立通用插件、事件总线或多平台适配框架。

| 文件 | 单一职责 |
|---|---|
| `src/main.ts` | 组装模块、导航代号、当前数据上下文、清理与旧结果隔离 |
| `src/types.ts` | 下列共享数据契约，不包含可传给 UI 的 Token |
| `src/page.ts` | 集中读取 GitHub 上下文、观察站内导航／主题、生成文件 URL、可撤销占位 |
| `src/github.ts` | 固定只读 REST 接口、响应解析、取消和错误／限流分类 |
| `src/credentials.ts` | 身份检查、凭据写入／读回、按授权代号读取回显值、取消和授权代号变更 |
| `src/credential-window.ts` | 页内 Token 模态弹窗、回显／眼睛显隐、关闭取消、上下文限制和结果；回填的 Token 与页面共享 DOM |
| `src/credential-window.css` | 弹窗、遮罩、表单和结果样式，跟随 GitHub 明暗主题 |
| `src/preload.ts` | 主动加载、截断补齐、优先级、请求合并、完整性判定 |
| `src/tree-index.ts` | 路径索引、父子关系、增量合并、确定性排序 |
| `src/search.ts` | 子串匹配、继承的目录命中、搜索展开边界与可见路径 |
| `src/storage.ts` | 设置、阅读状态、完整索引缓存、容量淘汰和授权隔离 |
| `src/sidebar.ts` | 原生控件、树窗口化渲染、交互、状态提示和设置面板 |
| `src/style.css` | Shadow DOM 内样式及明暗变量；页面占位样式由 page 管理 |
| `src/i18n.ts` | 解析语言偏好、格式化参数化消息、通知现有控件更新；不引入国际化框架 |
| `src/zh-CN.ts` | 简体中文词条，以英文原文为类型化键，英文无需重复词典 |

### 共享数据

`Path` 为相对仓库根目录的原始大小写字符串；根路径为空字符串。路径不可先转小写作为键，也不可按 URL 规则再次解码。

| 类型 | 字段与不变量 |
|---|---|
| `PageContext` | `owner, repo, refName, commitSha, path: string`；`refKind: 'branch' \| 'tag' \| 'commit'`；`view: 'root' \| 'tree' \| 'blob'` |
| `PageState` | `kind: 'code'` 携带 `context: PageContext`；`kind: 'empty'` 携带 `owner, repo`；或 `kind: 'outside'`／`'unresolved'`，后者含 `message` |
| `RepositoryMetadata` | `owner, repo: string, repoId: number, visibility: 'public' \| 'private' \| 'internal'`；不要求提交或根 tree，空仓库也能取得 |
| `RepoContext` | `PageContext` 与 `RepositoryMetadata` 加 `rootTreeSha: string`；只用于已有实际提交的仓库 |
| `AuthScope` | `id: string, login: string \| null, authenticated: boolean`；代号不是 Token 或其可逆表示 |
| `TreeEntry` | `path, name, sha, mode: string`；`type: 'tree' \| 'blob' \| 'commit'` |
| `IndexView` | `entries: ReadonlyMap<Path, TreeEntry>`、`children: ReadonlyMap<Path, readonly Path[]>`、`state: LoadState`、`pending: number`、`reason?: string`、`canResume?: boolean`、`resumeAt?: number`；UI 不自行猜测是否可以继续 |
| `LoadState` | `'loading' \| 'partial' \| 'complete' \| 'paused' \| 'failed' \| 'empty'`；非完整状态仍可携带已取得数据 |
| `TreeViewState` | `expanded: string[], scrollTop: number, anchorPath: string \| null, anchorOffset: number`；完整保存一份展开与滚动快照 |
| `SearchState` | `query: string, view: TreeViewState, collapsed: string[]`；query 非空，view.expanded 保存搜索期间的手动展开，collapsed 保存手动收起，自动展开按查询重新计算 |
| `ViewState` | `browsing: TreeViewState, search: SearchState \| null`；搜索期间 browsing 冻结为进入搜索前的快照，当前搜索视图单独保存 |
| `Settings` | `collapsed: boolean, width: number, shortcutsEnabled: boolean`；未保存时分别取 `false, 280, true`；旧的公开 Token 选项不再读取 |

索引拥有者维护一份可增量更新的 Map；界面只读引用和变更通知，不在每个响应或滚动事件复制整仓库索引。

## 上下文与生命周期

1. 脚本匹配 `https://github.com/*`，仅顶层运行，使从非代码页站内导航到代码页也能启用；非代码页不挂侧栏、不发目录请求。
2. page 读取 GitHub 已解析的 ref、路径和实际 commit SHA；不能把 `/tree/feature/a/...` 的第一段当作完整分支，也不靠遍历所有分支猜测。
3. 实现时先在真实页面确认嵌入数据形状，将选择器与解析集中在 page；无法确认时报告适配失败并停止展示旧树，不回退为猜测当前版本。
4. 先由 `getRepository(owner, repo, signal)` 读取仓库元数据，确认 `repoId`、访问权和可见性；该接口也适用于没有提交的空仓库。只有 code 状态才调用 `resolveTree(page, repository, signal)`，通过 Git commit 元数据接口由实际 commit SHA 取得根 tree SHA，不请求带文件 diff 的提交详情。
5. 数据上下文键为 `repoId + rootTreeSha + 请求授权代号`；同版本切文件复用当前预加载任务，仅更新路径、高亮和阅读状态。
6. 分支／版本或授权改变时取消旧任务；每个异步结果应用前核对数据上下文。另设导航代号，防止较早的上下文解析覆盖较新的导航。
7. 监听 GitHub 导航事件、`popstate` 和合并到动画帧的页面变动；不轮询、不改写页面 History API，不对每次 DOM 变动全页扫描。
   GitHub 导航可能替换页面节点并移除脚本宿主；`SidebarHandle.reconnect()` 重新挂接原侧栏和占位，不丢当前索引或双快照。导航观察保留在 documentElement，重复 URL 通知也检查宿主连接状态。
8. 离开启用范围，解除占位、观察器和侧栏事件并取消目录任务；保留用于再次进入的轻量导航观察，不销毁后失去再进入能力。
9. 空仓库单独处理：只有页面明确为 empty 且仓库元数据读取成功，才显示空状态，不构造虚假的 `commitSha`、`rootTreeSha` 或 `RepoContext`；单独一个 `404` 或 `409` 不足以证明为空。空仓库的连接检查只确认元数据访问，不宣称已验证 `Contents` 权限。

## 目录加载与缓存

### 完整性证明

1. 验证上下文后立即启动，包括侧栏已被用户收起的情况；缓存必须对应根 tree SHA 才能成为当前完整索引。
2. 优先请求根树 `recursive=1`；`truncated: false` 时确认该根完整。截断响应仅提供临时可用节点，不能从其缺失项推断目录不存在。
3. 根响应截断后，非递归列举根目录以确定直接子项；非递归请求必须省略 `recursive` 参数，不能用 `recursive=false`。
4. 主动为全部子目录排队，先当前文件祖先，再用户可见目录，再后台目录。子树优先递归取得；仍截断时再非递归列举并继续分解。
5. 按 tree SHA 合并相同网络请求，但按各自路径前缀挂载数据；同一 SHA 出现在两个目录时，两个路径都必须存在。
6. 只有根递归响应明确完整，或所有非递归枚举及其后代任务均完成，才能标记全树完整。单个目录非递归响应仍截断时，保持不完整并说明平台限制，不无限重试。
7. 非目录叶子不递归：符号链接按文件链接交由 GitHub 展示；子模块显示为特殊叶子并链接至其 GitHub 父目录页查看，不推测目标仓库或跨仓库预加载。
8. 索引合并按路径幂等；目录优先，其次按保留原始大小写的名称作稳定排序。缺失的祖先可作为临时目录，但不能据此宣布其内容完整。

### 请求控制

- 请求模块只提供 [授权表](authentication.md#最小-api-权限) 中的 GET 接口；固定 `api.github.com`、`Accept: application/vnd.github+json`、`X-GitHub-Api-Version: 2026-03-10`。不把 URL 返回字段直接当作任意请求目标。
- 每批最多 40 个 tree 请求、最多 2 个并发；可见目录和当前路径只提高优先级，不绕过并发控制。
- 批次完成且平台额度允许时，让出事件循环后自动启动下一批，直到补齐；40 是调度批大小，不是需要用户点击继续的总请求上限。自动续批任务可随上下文变化取消，批次边界不切换为 paused。
- `X-RateLimit-Remaining <= 5` 时预防性暂停；遇到实际限流按 `Retry-After`／reset 时间禁用提前继续。网络失败和授权失败不自动循环重试。
- 客户端 `quota.blockedUntil` 独立保存实际限流的禁行时间；普通主限额 reset 仍使用 `resumeAt`。并发晚到的成功或网络失败不能取消禁行时间，请求、调度与继续入口均检查它。
- 只有额度不足、平台限流或请求失败才停止补齐，并显示具体原因；保留已加载数据及待处理目录数。额度／限流暂停或可重试的网络失败提供继续入口，调用 `resume()` 仍须通过额度和授权检查，不因点击而绕过平台限制。

### 缓存与隐私

- 完整目录快照键为 `schemaVersion + repoId + rootTreeSha + cacheScope`；公开数据使用 public scope，非公开数据使用当前授权代号。未判定可见性前按非公开数据处理。
- 公开快照也须在重新进入仓库时先核对当前可见性；仓库变私有后，不能沿用旧公开缓存展示规则。
- 私有缓存展示前按 [授权流程](authentication.md#授权操作设计) 验证访问。版本不匹配不作为当前树；部分结果只保留内存，不持久化成完整快照。
- GM 缓存以 UTF-8 JSON 字节数计逻辑预算，不代表真实磁盘或内存占用；按最近使用淘汰，超大索引仍可在内存使用，只跳过持久化并说明原因。
- 完成整份索引后才写一次快照；展开、滚动不重写整份索引。阅读状态单独保存，停止操作后合并写入。
- 更换／清除 Token 立即更换代号、清空私有视图并取消任务；通过 GM 值变更通知其他标签页。写入前后核对代号，过期写入立即删除，启动时清理旧代号遗留。
- 凭据最终校验／提交和清除使用同源 Web Locks 的 `opsgittrees:authorization` 互斥；清理每次破坏性删除同样持锁，复核当前授权和记录是否已被替换。旧轮清理发现代号变化即停止。锁不是秘密存储，也不代替 GM 隔离；依赖目标浏览器提供 Web Locks。
- GM 无跨标签页事务：逻辑预算写后复核、启动再回收；不宣称零瞬时超额、物理安全擦除或浏览器进程崩溃后没有残留。旧代号缓存绝不再读取。

## 界面与状态

- page 为 GitHub 页面施加可撤销的横向占位，不克隆／重新包裹 GitHub 应用节点、不变换整个页面，不操作原生树的显隐与展开状态。
- 展开时左侧占位；收起时释放主体宽度，仅保留 24 px 的占位入口条供点击重开。管理器菜单和快捷键同样可用；离开代码页时入口条也移除，不因窄窗口自动切状态。
- 文件使用真实 GitHub 链接，ref 与各路径段分别正确编码；普通点击交由 GitHub，保留中键、修饰键、右键和浏览器历史行为，不加载文件内容。
- 固定行高，展开与过滤后形成可见路径序列，仅创建视口及少量预留行的 DOM；滚动不重算匹配或重建全索引。
- 文件名用 `textContent`，不拼接到 `innerHTML`；目录展开控件提供可访问名称、展开状态和焦点，不将目录伪装为文件链接。
- 搜索先规范化查询的首尾空白及大小写，再做单一子串匹配；保留原路径大小写。目录命中带出的后代不算新的自动展开目标，不递归打开命中目录。
- `ViewState` 必须整体持久化 browsing 与 search，两者不得共用一份展开／滚动字段。进入搜索时冻结 browsing，搜索的有效展开集合为 `(browsing.expanded ∪ 自动展开 ∪ search.view.expanded) − search.collapsed`；用户手动展开／收起更新搜索专用集合，清空查询仅移除 search 并恢复 browsing。
- 点击搜索结果后保留查询、手动展开／收起和搜索滚动位置；整页导航或刷新后从存储重建这两份状态，不依赖旧实例内存。索引补齐或查询变化时重算自动展开，不重置搜索手动状态；版本推进时仅剔除已确认不存在的路径，不能因索引尚未完整而丢弃快照。
- 阅读状态按 `cacheScope + repoId + refKind + refName` 隔离；同一分支更新到新 SHA 后只剔除已经不存在的展开路径，不串用其他分支状态。
- 首次进入深层文件展开祖先并定位；同上下文切文件保留滚动，只更新高亮和必要祖先。显式“定位当前文件”退出搜索后展开并滚动到当前项。
- 初次自动建立文件祖先和位置不改变用户的收起选择；仅显式 Locate 操作展开侧栏。收起或打开设置前捕获滚动，隐藏／脱离文档期间不读取零布局值覆盖快照，重开时恢复。
- 默认 `Alt+Shift+O` 切换侧栏、`Alt+Shift+F` 展开并聚焦搜索；仅在启用页面、`shortcutsEnabled: true` 且非输入／编辑控件中响应，不劫持 GitHub 的裸字母快捷键。设置面板通过同一 `Settings` 开关即时启停并持久化，重新初始化后沿用保存值；关闭快捷键不禁用管理器菜单或侧栏入口条。
- 一般设置在同一脚本管理器实例内全局共享，不按仓库分开；使用 GM 变更监听同步所有已打开页面的控件、布局和快捷键。Token 保存／清除通过授权代号切换客户端，取消旧加载，不复用匿名限流状态充当认证状态。
- 设置只提交实际变更字段，在 GitHub 同源 Web Lock 内读取最新值、合并并等待 GM 写入完成；不以旧页面整份副本覆盖其他页面的选择。快捷键开关立即提交，宽度／收起操作合并 300 ms；离开页面只补写尚未提交的变更，未改动页面不写设置。
- 主题取自 GitHub 页面明暗状态，侧栏设置页只展示一般设置与脱敏授权状态。凭据管理遵循 [独立窗口与隔离边界](authentication.md#授权操作设计)，不是扩展源保险箱。

## 工程初值

这些是实现者选择，可根据实际测量调整并同步文档；调整不能改变已确认的交互和完整性约束。

| 项目 | 初值 |
|---|---|
| 展开／收起宽度及拖动范围 | 280 px／24 px 入口条；展开拖动 200–480 px；不根据窗口宽度自动收起 |
| 行高／视口预留 | 24 px／上下各 8 行 |
| 搜索合并等待 | 80 ms；只应用最新查询结果 |
| tree 请求并发／调度批大小 | 2／40；额度允许时自动续批，主限额保留 5 次 |
| 持久化缓存逻辑总预算／单快照 | 16 MiB／4 MiB；包括阅读状态但不包括凭据与一般设置 |
| 已完整索引的内存复用 | 当前与最近一个快照；当前大索引不能因缓存额度被当成不完整 |
| 阅读状态合并写入 | 停止滚动或展开操作 300 ms 后，离开上下文时补写 |

## 验证与交付

- 逻辑用 Vitest 只覆盖消费者可见的风险边界：版本歧义、截断完整性、SHA 多路径、授权竞态、目录命中展开及阅读状态恢复。
- 特性通过真实页面和一次性脚本证明，不为配置、导入、文案或无异常本身添加测试。
- 必须实际安装自包含脚本，验证公开／经授权私有仓库、GitHub 无刷新导航、窄窗口、原生树共存、主题、链接和恢复原布局。
- Chrome、Edge、Firefox × Tampermonkey、Violentmonkey 为验证目标；记录准确版本和证据，没有运行的组合不能列为已支持。
- 分别记录冷启动、同版本缓存命中、深层定位、10 万条索引搜索、展开与滚动的耗时／节点数／请求数及内存。合成索引用于逻辑和渲染压力，不冒充真实 GitHub 截断或管理器验证。
- 任何平台限制或不可验证组合如实记录；首版必需行为不能以空实现、假数据、模拟 GM 或静默漏结果替代。

## 官方依据

- [Git Trees](https://docs.github.com/en/rest/git/trees)：截断与递归参数语义。
- [Git commit 元数据](https://docs.github.com/en/rest/git/commits#get-a-commit-object)：提交对应 tree SHA，不需读取代码 diff。
- [细粒度 PAT 权限](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)：接口只读权限；PAT 范围及限制见 [仓库授权](authentication.md)。
