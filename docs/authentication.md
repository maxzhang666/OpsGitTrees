# 仓库授权调研

状态：首版细粒度 PAT 流程已有实现，不引入授权后端；凭据提交、清除和缓存竞态已有逻辑回归验证。真实管理器隔离及获准私有仓库验证尚未运行，私有仓库能力仍待端到端验收。实现与验证记录见 [技术选型](technology.md#本次实现与验证记录)。

## 调研边界

本次查看了 Octotree 官方指南与登录页面，并核对 GitHub 官方授权文档。没有提交登录、授权第三方应用、访问私有仓库或审计 Octotree 当前扩展实现。

因此，下文将官方声明、平台约束和建议方案分开；不将官方声明当成已经独立验证的运行行为。

## 两种登录职责

Octotree 的账号登录和 GitHub 仓库授权是不同职责，即使同一个“Login with GitHub”入口可能将两者关联：

| 职责 | 用途 |
|---|---|
| Octotree 账号 | 登录其产品账号，关联免费账号能力与 Pro 订阅等产品权益 |
| GitHub 授权 | 获得调用 GitHub API 所需的凭据，读取用户及凭据有权限访问的仓库 |

只登录 Octotree 邮箱账号，不等于获得 GitHub 私有仓库权限。GitHub 网页已登录，也不能直接推导出 GitHub REST API 已获授权。

## Octotree 的方式

以下来自 [官方 GitHub authentication 说明](https://www.octotree.io/features#authentication)。

### GitHub OAuth

- 用户在设置或登录页选择“Log in with GitHub”。
- 通过 GitHub OAuth 授权，取得访问令牌，再用令牌调用 GitHub API 读取仓库。
- 官方明确说明：GitHub OAuth Apps 没有源码只读 scope，因此授权会请求仓库读写权限，虽然 Octotree 声称自身只读取数据。
- 必须区分“程序只做读取”和“凭据只有读取权限”；前者不等于泄露凭据后也无法写入。

### 手动 Token

用户可以在设置中粘贴 personal access token（PAT）。若同时配置 GitHub OAuth 和手动 Token，官方说明优先使用手动 Token。

| 类型 | Octotree 官方配置说明 |
|---|---|
| Fine-grained PAT | 选择全部或指定仓库；`Contents`、`Metadata`、`Pull requests` 均设为 Read-only |
| Classic PAT | 私有仓库使用 `repo`，仅公开仓库使用 `public_repo`；不能将这种权限视作细粒度只读 |

官方还说明 GitHub Enterprise Server 使用手动 PAT；这只是竞品调研事实，不新增本项目首版的平台支持范围。

Octotree 在 Token 说明中声明：令牌保存在浏览器扩展存储中，仅用于调用 GitHub API，不发送到其服务器。本次未验证这一实现，也不能由此推断 OAuth 换取令牌的每个环节均不经过服务端。

### 组织仓库限制

- 用户自身必须有仓库权限，凭据不能授予用户原本没有的访问能力。
- 组织可能限制 OAuth App 或细粒度 PAT 的使用，需要管理员批准。
- SAML SSO 可能需要额外建立会话或重新授权。
- “GitHub 上能打开仓库，但脚本 API 访问失败”不能一律解释为登录失效，更不能显示为空仓库。

## 首版授权

已确认边界：首版不引入本项目的授权后端，暂不采用依赖后端的 OAuth，也不建立本项目的账号系统。

基于该边界，当前采用以下产品方案：

| 场景 | 授权行为 |
|---|---|
| 公开仓库 | 默认匿名使用，不要求先配置 Token；仍受 GitHub 匿名请求额度限制 |
| 私有仓库 | 用户自行配置可访问相应仓库的细粒度只读 PAT，脚本携带该凭据直连 GitHub API |
| 公开仓库需要认证额度 | 用户也可自愿配置 Token，不以注册或付费解锁 |

- Token 权限由实际调用的接口决定，不照搬 Octotree 为 PR 功能要求的 `Pull requests` 权限。
- 不通过项目服务器换取或中转 Token，也不建立私有代码或目录数据的第三方中转。
- 凭据存储需要按油猴脚本的隔离能力设计，不能照搬“只有这个扩展能读取”的宣传，也不能放进 GitHub 页面的可读存储。
- 代价是私有仓库用户需要自行创建、配置和更新 Token；组织策略仍可能限制其使用，配置引导需要说明这些真实限制。
- 无需把 OAuth 协议本身永久排除；Device Flow 等候选在完整无后端流程得到验证前不作为首版承诺，见 [Roadmap](roadmap.md)。

## 方案比较

细粒度 PAT 是当前首版方向；其他方案保留作后续比较，不再默认设计“GitHub 连接 + Token”的双入口。

| 方案 | 收益 | 代价与限制 |
|---|---|---|
| 传统 OAuth App | 用户不必手动创建 Token，接近 Octotree 的连接体验 | 私有源码访问缺少只读 scope；组织可能限制第三方应用 |
| GitHub App | 可配置细粒度只读权限并限制仓库范围，仍支持用户授权 | 私有仓库需要对应的 App 安装授权；用户有仓库访问权不代表有安装权，组织管理员可能必须参与 |
| Fine-grained PAT | 可选仓库及只读权限，不需要项目服务端代为换取凭据 | 用户需自行创建、管理和更新 Token；仍受组织策略约束 |

GitHub App 用户令牌只能访问用户与 App 共同获准访问的资源；不能承诺用户在网页中能看到的所有仓库都自动可用。

### 授权流程与后端

- GitHub 官方当前描述的 Web OAuth 换码流程要求 `client_secret`，即使启用 PKCE 也不能据此假设不再需要 secret。公开油猴脚本不能安全保存应用 secret，不能把它写进脚本。
- OAuth Apps 和 GitHub Apps 均提供 Device Flow；官方初次获取令牌的参数不要求 `client_secret`。因此，“GitHub 连接必然需要项目后端”并不准确。
- Device Flow 官方面向无浏览器或无头应用；其是否适合油猴脚本、跨域请求兼容性、用户操作成本及令牌续期全生命周期仍需验证，不能提前承诺它是无后端的一键登录方案。
- 不能因为想去掉服务端就关闭安全措施，或把长效 Token 当作无成本替代。

## 授权操作设计

Token 配置使用当前页面内的模态弹窗，不打开浏览器窗口／标签，也不使用原生 `alert`／`prompt`。逻辑回归与实机证据见 [验证记录](technology.md#本次实现与验证记录)。

- 侧栏设置页只显示简短凭据状态与账户，并提供“管理 Token”。检查已存 Token、当前仓库连接检查和清除均在管理弹窗中操作及反馈；Token 在弹窗中回显，不列出凭据可访问的全部私有仓库。
- 创建指引链接到 GitHub 细粒度 PAT 页面，提示选择正确的 Resource owner、必要仓库、到期时间及下表只读权限；不自动授权或创建令牌。
- 侧栏和管理器菜单均打开同一个页内 Token 弹窗，包含 Token 输入、输入框右侧眼睛显隐按钮、验证并保存、取消检查、检查已存 Token、清除和关闭；打开时回填已存 Token，默认密码遮罩，眼睛按钮切换明文／遮罩，不使用显隐复选框。支持右上角关闭、Esc 和点击遮罩；失败区分输入、身份请求和存储阶段，不用目录加载成功代替认证验证。
- 弹窗采用原生 `<dialog>` 和 Shadow DOM，后者仅隔离样式。输入框与 GitHub 页面共享 DOM，页面脚本可以读取新输入及回填的已存 Token；密码遮罩不提供保密隔离。这是页内回显的明确边界，不宣称是扩展源保险箱。
- 生产元数据仍请求 `@inject-into content`／`@sandbox DOM`，凭据存储与请求留在脚本上下文。Tampermonkey／Violentmonkey 分别检查 `GM_info.sandboxMode === 'dom'`／`injectInto === 'content'`；ScriptCat 1.5.2 依赖明确的 content 元数据，但元数据不等于运行时证明。未知或不合适的上下文拒绝输入；通过检查也不能使共享 DOM 中的输入保密。
- 首版维护一个当前 Token；配置时调用 `GET /user` 核对身份，再等待 GM 凭据写入并读回确认。仓库读取能力单独检查；身份有效但仓库无权访问时如实提示范围限制，不把令牌认定为全局无效。
- 显示实际授权账户，不把 GitHub 网页登录账户当作 API 身份；两者不一致时说明区别，不要求用户退出或切换网页登录。
- 没有 Token 时匿名；已验证并保存的 Token 默认用于所有 GitHub API 请求，包括公开仓库，不再额外要求开启公开认证额度选项。认证失败不自动降级到匿名以掩盖问题。
- 身份检查失败不覆盖旧凭据。关闭或取消检查使候选保存失效；取消发生于写入期间时，持锁恢复旧凭据并更新代号。只有写入完成且读回一致才报告成功；存储失败不能无证据宣称旧值必定未变。提交或关闭时清空输入，完成校验后重新回显当前已存值；重开、替换或清除凭据时恢复遮罩，晚到读取不能回填已失效 Token，初次异步回显不能覆盖用户已输入的替换值。Token 不进入侧栏状态、日志、URL、页面存储或脚本自身导出；管理器备份与同步不在此保证内。
- 清除入口集中在 Token 管理弹窗；侧栏和管理器菜单仅提供打开弹窗的入口。清除本地 Token 不等于在 GitHub 撤销令牌，弹窗保留 GitHub 管理／撤销链接。
- 替换／清除凭据时更换授权代号、取消旧请求、清空内存中的私有数据，并删除关联持久化目录及阅读状态；在其他标签页同步失效旧授权，具体竞态处理见 [技术设计](architecture.md)。
- 凭据最终重读与提交、清除由同源 Web Locks 串行化；清除发生在候选身份检查期间时，旧配置不能覆盖清除结果。清理在每次删除前持同一锁复核授权代号，避免旧清理误删新授权的缓存。未提供 Web Locks 的浏览器不属于当前可声明的验证范围。
- 每次重新进入私有仓库或重新启动脚本时，先验证该授权对当前仓库仍有访问权，再展示持久化缓存；同一有效上下文内切文件不重复验证全部接口。
- `401` 提示凭据无效、已过期或被撤销，但不伪装能够区分这些原因；停止使用相关私有缓存，提供替换／清除入口。
- `403`／`429` 结合限流、SSO 等响应头解释；`404` 提示仓库不存在或当前凭据无权访问。没有证据时不强行归因，也不将其显示为空仓库。

### 最小 API 权限

按 [GitHub 权限表](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) 对照以下只读调用；部署前仍需真实验证。无需 `Pull requests`、写入、邮箱或管理权限。

| 接口 | 用途 | 细粒度 PAT 权限 |
|---|---|---|
| `GET /user` | 确认凭据所属账户，仅取公开身份字段 | 不申请额外账户权限 |
| `GET /repos/{owner}/{repo}` | 验证仓库访问与可见性 | `Metadata: read` |
| `GET /repos/{owner}/{repo}/git/commits/{commit_sha}` | 从页面实际提交取得根 tree SHA，不获取文件 diff | `Contents: read` |
| `GET /repos/{owner}/{repo}/git/trees/{tree_sha}` | 读取目录索引 | `Contents: read` |

连接检查只证明身份及相关接口可用，不能证明用户没有额外授予写入等权限；只读权限必须在 GitHub 创建 Token 时按引导选择。

### 平台限制

- [GitHub 官方说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)指出，一个细粒度 PAT 只面向一个 Resource owner；多个组织的私有仓库不能假设由同一个 Token 覆盖。首版可替换当前 Token，不暗中扩大权限。
- 外部协作者、组织批准和 SSO 等限制仍然存在；细粒度 PAT 无法访问的场景应如实说明，不自动改用 Classic PAT 或向用户索取写权限。
- 脚本不主动上传或同步凭据，但不能代替用户控制脚本管理器自身的备份、同步和设备安全策略。

### 验证要求

- 真实验证页内弹窗的回显、眼睛显隐、关闭、GM 存储和请求能力；不承诺新输入或回填的已存 Token 对 GitHub 页面保密。Shadow DOM 或页面 GM 全局未暴露不能证明管理器中的凭据保密。
- 验证更换／清除、跨标签页晚到响应、过期／撤销、组织拒绝及私有缓存失效；GM 模拟仅能验证业务逻辑，不能据此宣布管理器兼容。
- 请求仅构造到 `api.github.com` 的固定只读接口；校验域名并验证重定向行为，不把 API 返回的任意 URL 直接作为携带 Token 的请求地址。

## 官方来源

- [Octotree 授权说明](https://www.octotree.io/features#authentication)
- [Octotree 登录页面](https://www.octotree.io/login)
- [GitHub：授权 OAuth Apps 与 scope 限制](https://docs.github.com/en/apps/oauth-apps/using-oauth-apps/authorizing-oauth-apps)
- [GitHub：OAuth Web Flow 与 Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub：GitHub Apps 与 OAuth Apps 的差异](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps)
- [GitHub：App 代表用户访问资源的边界](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-with-a-github-app-on-behalf-of-a-user)
- [GitHub：生成 App 用户令牌与 Device Flow](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [GitHub：细粒度 PAT 权限表](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- [GitHub：PAT 创建、范围与限制](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [GitHub：Git commit 元数据接口](https://docs.github.com/en/rest/git/commits#get-a-commit-object)
- [Tampermonkey：脚本菜单](https://www.tampermonkey.net/documentation.php?locale=en&q=GM_registerMenuCommand)
- [ScriptCat 1.5.2：内容世界元数据判定](https://github.com/scriptscat/scriptcat/blob/v1.5.2/src/app/service/content/utils.ts) 与 [运行环境注册](https://github.com/scriptscat/scriptcat/blob/v1.5.2/src/app/service/service_worker/runtime.ts#L1048-L1084)
- [Tampermonkey：sandbox 与运行信息](https://www.tampermonkey.net/documentation.php?locale=en&q=sandbox)、[Violentmonkey：inject-into](https://violentmonkey.github.io/api/metadata-block/#inject-into)
- [about:blank 继承源](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy#inherited_origins)
