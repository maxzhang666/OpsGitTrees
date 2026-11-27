// ==UserScript==
// @name               OpsGitTrees
// @namespace          OpsGitTrees
// @version            0.1.2
// @author             maxzhang666
// @description        Lightweight GitHub repository tree and path navigation
// @description:zh-CN  轻量的 GitHub 仓库文件树与路径导航
// @icon               https://raw.githubusercontent.com/maxzhang666/OpsGitTrees/main/assets/icon.png
// @homepageURL        https://github.com/maxzhang666/OpsGitTrees
// @match              https://github.com/*
// @sandbox            DOM
// @connect            api.github.com
// @grant              GM.addValueChangeListener
// @grant              GM.deleteValue
// @grant              GM.getValue
// @grant              GM.listValues
// @grant              GM.notification
// @grant              GM.registerMenuCommand
// @grant              GM.removeValueChangeListener
// @grant              GM.setValue
// @grant              GM.unregisterMenuCommand
// @grant              GM.xmlHttpRequest
// @grant              GM_getValue
// @grant              GM_info
// @grant              GM_setValue
// @inject-into        content
// @run-at             document-idle
// @noframes
// ==/UserScript==

(function() {
	"use strict";
	var _GM = (() => typeof GM != "undefined" ? GM : void 0)();
	var _GM_getValue = (() => typeof GM_getValue != "undefined" ? GM_getValue : void 0)();
	var _GM_info = (() => typeof GM_info != "undefined" ? GM_info : void 0)();
	var _GM_setValue = (() => typeof GM_setValue != "undefined" ? GM_setValue : void 0)();
	var zhCN = {
		"Keyboard shortcuts": "键盘快捷键",
		"Alt+Shift+O: expand or collapse the sidebar. Alt+Shift+F: find a file or path.": "Alt+Shift+O：展开／收起侧栏；Alt+Shift+F：查找文件或路径。",
		"Token management": "Token 管理",
		"Token saved": "Token 已保存",
		"Token input is unavailable in this execution context. Reinstall the current script with content / DOM isolation enabled, then reload GitHub. No Token was requested.": "当前执行环境无法输入 Token。请以 content／DOM 隔离模式重新安装脚本并刷新 GitHub；尚未读取 Token。",
		"{stage} stage: {error}": "{stage}阶段：{error}",
		"input": "输入",
		"identity": "身份验证",
		"storage": "存储",
		"API check: {error}": "API 检查：{error}",
		"Cancelled or authorization changed. Candidate not saved.": "已取消或授权已变更，未保存候选 Token。",
		"Userscript storage could not be accessed. Check the manager before retrying.": "无法访问脚本存储，请检查脚本管理器后重试。",
		"Local Token cleared. Private cache is invalidated. Revoke the Token separately on GitHub if needed.": "已清除本地 Token，私有缓存已失效。如需撤销 Token，请另行前往 GitHub 操作。",
		"Close Token configuration": "关闭 Token 配置",
		"Show Token": "显示 Token",
		"Hide Token": "隐藏 Token",
		"Verify & save": "验证并保存",
		"Cancel check": "取消检查",
		"Check saved Token": "检查已保存的 Token",
		"Create a fine-grained Token ↗": "创建细粒度 Token ↗",
		"Manage / revoke on GitHub ↗": "在 GitHub 管理／撤销 ↗",
		"Minimum access": "最小权限",
		"Contents: Read-only · Metadata: Read-only": "Contents、Metadata：只读",
		"This page can read the Token. Clearing locally does not revoke it on GitHub.": "此页面可读取 Token。本地清除不会在 GitHub 撤销它。",
		"Not configured": "未配置",
		"Token · public and private repositories": "Token · 公开和私有仓库",
		"Anonymous": "匿名",
		"Cancelling the check…": "正在取消检查…",
		"Checking identity with GitHub. Candidate is not saved yet…": "正在向 GitHub 验证身份，候选 Token 尚未保存…",
		"Saved and read back from userscript storage. API account: @{login}. Repository permissions are checked separately.": "已写入脚本存储并读回确认。API 账户：@{login}。仓库权限需单独检查。",
		"Token saved. API requests now use @{login}.": "Token 已保存，API 请求现在使用 @{login}。",
		"Checking saved Token identity…": "正在检查已存 Token 的身份…",
		"Identity verified: @{login}.": "身份已验证：@{login}。",
		"Enter a Token to verify and save.": "请输入要验证并保存的 Token。",
		"{error} Existing credential kept.": "{error} 原有凭据已保留。",
		"Identity request could not be completed.": "无法完成身份请求。",
		"Stored credential could not be confirmed. Check the userscript manager.": "无法确认已存凭据，请检查脚本管理器。",
		"Could not confirm the credential write. Check the userscript manager storage before retrying.": "无法确认凭据写入，请检查脚本管理器的存储后重试。",
		"GitHub rate limit remains active. Resume after {time}.": "GitHub 限流仍在生效，请在 {time} 后继续。",
		"GitHub API redirected outside the allowed origin.": "GitHub API 重定向到了未获准的源。",
		"GitHub rate limit reached. Resume after {time}.": "已触发 GitHub 限流，请在 {time} 后继续。",
		"GitHub rejected the Token (HTTP 401): invalid, expired or revoked. Replace or clear it in the Token configuration dialog.": "GitHub 拒绝了此 Token（HTTP 401）：可能无效、已过期或已被撤销。请在 Token 配置弹窗中替换或清除。",
		"Organization SSO authorization is required.": "需要组织的 SSO 授权。",
		"GitHub denied access. Check repository scope, organization approval and read-only permissions.": "GitHub 拒绝访问，请检查仓库范围、组织审批和只读权限。",
		"Repository or object not found, or the current credential has no access.": "仓库或对象不存在，或当前凭据无权访问。",
		"GitHub reported a repository conflict; this response alone does not prove it is empty.": "GitHub 报告仓库冲突，仅凭此响应不能认定仓库为空。",
		"GitHub API request failed (HTTP {status}).": "GitHub API 请求失败（HTTP {status}）。",
		"Unrecognized GitHub API response.": "无法识别 GitHub API 响应。",
		"GitHub API request failed. Check the network and userscript manager permissions.": "GitHub API 请求失败，请检查网络和脚本管理器权限。",
		"GitHub returned an invalid object identifier.": "GitHub 返回了无效的对象标识符。",
		"GitHub returned an invalid account identity.": "GitHub 返回了无效的账户身份。",
		"GitHub returned invalid repository metadata.": "GitHub 返回了无效的仓库元数据。",
		"Repository context changed.": "仓库上下文已变更。",
		"GitHub returned a different commit or no root tree.": "GitHub 返回了不同的提交或缺少根目录树。",
		"GitHub returned invalid tree metadata.": "GitHub 返回了无效的目录树元数据。",
		"GitHub rate limit remains active.": "GitHub 限流仍在生效。",
		"GitHub request quota is low. Loaded paths remain usable; continue after the quota resets.": "GitHub 请求额度不足，已加载的路径仍可使用；请在额度重置后继续。",
		"GitHub truncated a non-recursive directory listing. Results remain incomplete; this API cannot enumerate all entries.": "GitHub 截断了非递归目录列表，结果仍不完整；此 API 无法枚举全部条目。",
		"Authorization changed; private index cleared.": "授权已变更，已清除私有索引。",
		"Directory request failed.": "目录请求失败。",
		"Invalid repository URL": "仓库 URL 无效",
		"Waiting for GitHub repository context…": "正在等待 GitHub 仓库上下文…",
		"Script menu could not be updated.": "无法更新脚本菜单。",
		"Language": "语言",
		"Interface language": "界面语言",
		"Follow browser": "跟随浏览器",
		"OpsGitTrees repository navigation": "OpsGitTrees 仓库文件导航",
		"Collapse file navigation": "收起文件导航",
		"Repository": "仓库",
		"Find a file or path…": "查找文件或路径…",
		"Find a file or path": "查找文件或路径",
		"Clear search": "清空搜索",
		"Locate current file": "定位当前文件",
		"Open navigation settings": "打开导航设置",
		"Close navigation settings": "关闭导航设置",
		"Continue loading": "继续加载",
		"Continue directory loading": "继续加载目录",
		"Directory loading status": "目录加载状态",
		"Directory loading paused": "目录加载已暂停",
		"Directory loading failed": "目录加载失败",
		"Directory index incomplete": "目录索引不完整",
		"Try again after {time}.": "可在 {time} 后重试。",
		"No Token configured: requests use the anonymous API quota. GitHub sign-in does not authorize the script. Wait or configure a read-only Token.": "未配置 Token，当前使用匿名 API 额度。登录 GitHub 网页不会为脚本 API 授权。可等待额度恢复，或配置只读 Token。",
		"Configure a read-only Token": "配置只读 Token",
		"Repository files": "仓库文件",
		"Enable Alt+Shift+O / Alt+Shift+F": "启用 Alt+Shift+O / Alt+Shift+F 快捷键",
		"GitHub API authentication": "GitHub API 认证",
		"Manage Token…": "管理 Token…",
		"Open Token configuration dialog": "打开 Token 配置弹窗",
		"Clear local Token": "清除本地 Token",
		"Check current repository": "检查当前仓库",
		"FILES ›": "文件 ›",
		"Open file navigation": "打开文件导航",
		"Resize file navigation": "调整文件导航宽度",
		"{name} (submodule; open parent directory on GitHub)": "{name}（子模块；在 GitHub 打开父目录）",
		"No matching paths.": "没有匹配的路径。",
		"No loaded paths match. The index is incomplete.": "已加载的路径中没有匹配项，索引尚不完整。",
		"No files in this version.": "此版本没有文件。",
		"This repository is empty.": "此仓库为空。",
		"Loading repository index…": "正在加载仓库索引…",
		"{count} paths · {state}": "{count} 个路径 · {state}",
		"Complete": "完整",
		"Index incomplete — {state}": "索引不完整 — {state}",
		"{count} pending": "{count} 项待加载",
		"loading": "加载中",
		"partial": "部分完成",
		"complete": "完整",
		"paused": "已暂停",
		"failed": "失败",
		"empty": "空仓库",
		"Token saved · @{login}": "Token 已保存 · @{login}",
		"No Token configured.": "未配置 Token。",
		"The operation failed. Check the network and userscript manager storage permissions.": "操作失败，请检查网络和脚本管理器的存储权限。",
		"Settings could not be saved.": "无法保存设置。",
		"Reading position could not be saved. Check manager storage.": "无法保存阅读位置，请检查脚本管理器的存储。",
		"Could not read the current GitHub page context.": "无法读取当前 GitHub 页面上下文。",
		"GitHub page context is not recognized. No branch or commit was guessed.": "无法识别 GitHub 页面上下文，未猜测分支或提交。",
		"Configure a fine-grained read-only PAT in Settings → API authentication to read this repository.": "请在“设置 → API 认证”中配置细粒度只读 PAT，以读取此仓库。",
		"Persistent cache unavailable; index remains usable in memory.": "持久化缓存不可用，仍可使用内存中的索引。",
		"Current GitHub context is unresolved. Reload the page and try again.": "尚未识别当前 GitHub 上下文，请刷新页面后重试。",
		"Checking identity and repository access…": "正在检查身份和仓库访问权限…",
		"Repository metadata access verified. Empty repository: Contents permission was not exercised.": "已验证仓库元数据访问权限。仓库为空，未检验 Contents 权限。",
		"Repository read access verified.": "已验证仓库读取权限。",
		"Authorization changed; private data stopped. Storage cleanup failed.": "授权已变更，已停止使用私有数据；存储清理失败。",
		"Cache cleanup failed. Check manager storage.": "缓存清理失败，请检查脚本管理器的存储。",
		"Could not start. Check userscript manager permissions and storage.": "启动失败，请检查脚本管理器的权限和存储。",
		"OpsGitTrees: Manage Token…": "OpsGitTrees：管理 Token…",
		"OpsGitTrees: Open file navigation": "OpsGitTrees：打开文件导航",
		"Persistent-cache budget exceeded; loaded paths remain available in memory.": "已超出持久化缓存预算，已加载的路径仍可在内存中使用。"
	};
	var preference = "auto";
	var listeners = new Set();
	function resolveLanguage(value) {
		if (value !== "auto") return value;
		for (const language of navigator.languages?.length ? navigator.languages : [navigator.language]) {
			if (/^zh(?:-|$)/i.test(language)) return "zh-CN";
			if (/^en(?:-|$)/i.test(language)) return "en";
		}
		return "en";
	}
	var locale = resolveLanguage(preference);
	function getLanguage() {
		return locale;
	}
	function setLanguage(value) {
		preference = value;
		const next = resolveLanguage(value);
		if (next === locale) return;
		locale = next;
		for (const listener of listeners) listener();
	}
	function observeLanguage(listener) {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}
	function msg(key, values) {
		return values ? {
			key,
			values
		} : { key };
	}
	function t(key, values) {
		const text = locale === "zh-CN" ? zhCN[key] : key;
		if (!values) return text;
		return text.replace(/\{(\w+)\}/g, (_match, name) => {
			const value = values[name];
			if (typeof value === "number") return value.toLocaleString(locale);
			if (value instanceof Date) return value.toLocaleTimeString(locale);
			return typeof value === "string" ? value : renderText(value);
		});
	}
	function createTranslations() {
		const updates = [];
		return {
			bind(node, text, attribute) {
				const update = () => {
					if (attribute && node instanceof Element) node.setAttribute(attribute, renderText(text));
					else node.textContent = renderText(text);
				};
				updates.push(update);
				update();
				return node;
			},
			refresh() {
				for (const update of updates) update();
			}
		};
	}
	function renderText(text) {
		return typeof text === "string" ? text : t(text.key, text.values);
	}
	window.addEventListener("languagechange", () => {
		if (preference === "auto") setLanguage("auto");
	});
	var ApiError = class extends Error {
		kind;
		detail;
		resumeAt;
		constructor(kind, detail, resumeAt = null) {
			super(renderText(detail));
			this.kind = kind;
			this.detail = detail;
			this.resumeAt = resumeAt;
			this.name = "ApiError";
		}
	};
	var shaPattern$1 = /^[a-f0-9]{40}$/i;
	var abortError = () => new DOMException("Request cancelled", "AbortError");
	function parseTreeResponse(value, expectedSha) {
		if (!value || typeof value !== "object" || Array.isArray(value)) return null;
		const data = value;
		if (typeof data.sha !== "string" || !shaPattern$1.test(data.sha) || data.sha !== expectedSha || typeof data.truncated !== "boolean" || !Array.isArray(data.tree)) return null;
		const tree = [];
		for (const value of data.tree) {
			if (!value || typeof value !== "object" || Array.isArray(value)) return null;
			const item = value;
			if (typeof item.path !== "string" || !item.path || item.path.startsWith("/") || item.path.split("/").some((p) => !p || p === "." || p === "..") || typeof item.sha !== "string" || !shaPattern$1.test(item.sha) || typeof item.mode !== "string" || item.type !== "tree" && item.type !== "blob" && item.type !== "commit") return null;
			tree.push({
				path: item.path,
				name: item.path.slice(item.path.lastIndexOf("/") + 1),
				sha: item.sha,
				mode: item.mode,
				type: item.type
			});
		}
		return {
			sha: data.sha,
			truncated: data.truncated,
			tree
		};
	}
	function createGitHubClient(token) {
		const quota = {
			remaining: null,
			resumeAt: null,
			blockedUntil: null
		};
		async function request(path, signal) {
			if (signal.aborted) throw abortError();
			if (quota.blockedUntil && quota.blockedUntil > Date.now()) throw new ApiError("rate", msg("GitHub rate limit remains active. Resume after {time}.", { time: new Date(quota.blockedUntil) }), quota.blockedUntil);
			const headers = {
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2026-03-10"
			};
			if (token) headers.Authorization = "Bearer " + token;
			const pending = _GM.xmlHttpRequest({
				method: "GET",
				url: "https://api.github.com" + path,
				headers,
				responseType: "json",
				anonymous: true,
				redirect: "error",
				timeout: 3e4
			});
			const abort = () => pending.abort();
			signal.addEventListener("abort", abort, { once: true });
			try {
				const response = await pending;
				if (signal.aborted) throw abortError();
				if (new URL(response.finalUrl).origin !== "https://api.github.com") throw new ApiError("invalid", msg("GitHub API redirected outside the allowed origin."));
				const values = new Map(response.responseHeaders.split(/\r?\n/).filter((l) => l.includes(":")).map((l) => {
					const i = l.indexOf(":");
					return [l.slice(0, i).toLowerCase().trim(), l.slice(i + 1).trim()];
				}));
				const remaining = values.get("x-ratelimit-remaining");
				if (remaining !== void 0 && /^\d+$/.test(remaining)) quota.remaining = Number(remaining);
				const reset = Number(values.get("x-ratelimit-reset")) * 1e3;
				const retry = values.get("retry-after");
				let retryAt = retry ? /^\d+$/.test(retry) ? Date.now() + Number(retry) * 1e3 : Date.parse(retry) : 0;
				if (!Number.isFinite(retryAt)) retryAt = 0;
				quota.resumeAt = Number.isFinite(reset) && reset > 0 ? reset : null;
				const secondaryLimit = typeof response.response?.message === "string" && /secondary rate limit/i.test(response.response.message);
				if (response.status === 429 || response.status === 403 && (quota.remaining === 0 || !!retry || secondaryLimit)) {
					const now = Date.now(), suggested = Math.max(retryAt, quota.remaining === 0 ? quota.resumeAt || 0 : 0);
					quota.blockedUntil = Math.max(quota.blockedUntil || 0, suggested > now ? suggested : now + 6e4);
					if (quota.remaining === 0 && (!quota.resumeAt || quota.resumeAt <= now)) quota.resumeAt = quota.blockedUntil;
					throw new ApiError("rate", msg("GitHub rate limit reached. Resume after {time}.", { time: new Date(quota.blockedUntil) }), quota.blockedUntil);
				}
				if (response.status === 401) throw new ApiError("auth", msg("GitHub rejected the Token (HTTP 401): invalid, expired or revoked. Replace or clear it in the Token configuration dialog."));
				if (response.status === 403) throw new ApiError("forbidden", msg(values.has("x-github-sso") ? "Organization SSO authorization is required." : "GitHub denied access. Check repository scope, organization approval and read-only permissions."));
				if (response.status === 404) throw new ApiError("not-found", msg("Repository or object not found, or the current credential has no access."));
				if (response.status === 409) throw new ApiError("conflict", msg("GitHub reported a repository conflict; this response alone does not prove it is empty."));
				if (response.status < 200 || response.status >= 300) throw new ApiError("network", msg("GitHub API request failed (HTTP {status}).", { status: String(response.status) }));
				if (!response.response || typeof response.response !== "object" || Array.isArray(response.response)) throw new ApiError("invalid", msg("Unrecognized GitHub API response."));
				return response.response;
			} catch (error) {
				if (signal.aborted) throw abortError();
				if (error instanceof ApiError) throw error;
				throw new ApiError("network", msg("GitHub API request failed. Check the network and userscript manager permissions."));
			} finally {
				signal.removeEventListener("abort", abort);
			}
		}
		const repoPath = (owner, repo) => "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo);
		const checkedSha = (sha) => {
			if (!shaPattern$1.test(sha)) throw new ApiError("invalid", msg("GitHub returned an invalid object identifier."));
			return sha;
		};
		return {
			quota,
			async getIdentity(signal) {
				const data = await request("/user", signal);
				if (typeof data.id !== "number" || typeof data.login !== "string") throw new ApiError("invalid", msg("GitHub returned an invalid account identity."));
				return {
					id: data.id,
					login: data.login
				};
			},
			async getRepository(owner, repo, signal) {
				const data = await request(repoPath(owner, repo), signal);
				const visibility = data.visibility;
				if (typeof data.id !== "number" || visibility !== "public" && visibility !== "private" && visibility !== "internal") throw new ApiError("invalid", msg("GitHub returned invalid repository metadata."));
				return {
					owner,
					repo,
					repoId: data.id,
					visibility
				};
			},
			async resolveTree(page, repository, signal) {
				if (page.owner.toLowerCase() !== repository.owner.toLowerCase() || page.repo.toLowerCase() !== repository.repo.toLowerCase()) throw new ApiError("invalid", msg("Repository context changed."));
				const data = await request(repoPath(page.owner, page.repo) + "/git/commits/" + checkedSha(page.commitSha), signal);
				const tree = data.tree;
				if (data.sha !== page.commitSha || !tree || typeof tree !== "object" || !("sha" in tree) || typeof tree.sha !== "string") throw new ApiError("invalid", msg("GitHub returned a different commit or no root tree."));
				return {
					...page,
					...repository,
					rootTreeSha: checkedSha(tree.sha)
				};
			},
			async getTree(context, sha, recursive, signal) {
				const response = parseTreeResponse(await request(repoPath(context.owner, context.repo) + "/git/trees/" + checkedSha(sha) + (recursive ? "?recursive=1" : ""), signal), sha);
				if (!response) throw new ApiError("invalid", msg("GitHub returned invalid tree metadata."));
				return response;
			}
		};
	}
	var key = "ogt:credentials:v1";
	var empty = {
		id: "anonymous",
		token: null,
		login: null
	};
	async function current() {
		return await _GM.getValue(key, empty);
	}
	var scopeOf = (value) => ({
		id: value.id,
		login: value.login,
		authenticated: !!value.token
	});
	function isAbortError(error) {
		return error !== null && typeof error === "object" && "name" in error && error.name === "AbortError";
	}
	async function readAuthScope() {
		return scopeOf(await current());
	}
	async function readSavedToken(scope) {
		const value = await current();
		if (scope.id !== value.id || scope.authenticated !== !!value.token) throw new DOMException("Authorization changed", "AbortError");
		return value.token;
	}
	function isAuthScopeCurrent(scope) {
		const value = _GM_getValue(key, empty);
		return scope.id === value.id && scope.authenticated === !!value.token;
	}
	function withAuthLock(operation) {
		return navigator.locks.request("opsgittrees:authorization", operation);
	}
	async function getGitHubClient(scope) {
		const value = await current();
		if (scope.id !== value.id || scope.authenticated !== !!value.token) throw new DOMException("Authorization changed", "AbortError");
		return createGitHubClient(value.token);
	}
	function observeAuthScope(listener) {
		let stopped = false;
		const registration = Promise.resolve(_GM.addValueChangeListener(key, (_name, _old, value) => {
			if (!stopped) listener(scopeOf(value || empty));
		}));
		return () => {
			stopped = true;
			registration.then((id) => _GM.removeValueChangeListener(id));
		};
	}
	var CredentialError = class extends Error {
		stage;
		detail;
		constructor(stage, detail) {
			super(renderText(detail));
			this.stage = stage;
			this.detail = detail;
			this.name = "CredentialError";
		}
	};
	async function configureToken(input, signal = new AbortController().signal) {
		const token = input.trim();
		if (!token) throw new CredentialError("input", msg("Enter a Token to verify and save."));
		const before = await current();
		let identity;
		try {
			identity = await createGitHubClient(token).getIdentity(signal);
		} catch (error) {
			if (signal.aborted || isAbortError(error)) throw new DOMException("Token check cancelled", "AbortError");
			throw new CredentialError("identity", msg("{error} Existing credential kept.", { error: error instanceof ApiError ? error.detail : msg("Identity request could not be completed.") }));
		}
		return withAuthLock(async () => {
			const latest = await current();
			if (signal.aborted || latest.id !== before.id) throw new DOMException("Token check cancelled or authorization changed; candidate not saved", "AbortError");
			const value = {
				id: crypto.randomUUID(),
				token,
				login: identity.login
			};
			try {
				await _GM.setValue(key, value);
				const stored = await current();
				if (signal.aborted) {
					await _GM.setValue(key, {
						...before,
						id: crypto.randomUUID()
					});
					throw new DOMException("Token save cancelled", "AbortError");
				}
				if (stored.id !== value.id) throw new CredentialError("storage", msg("Stored credential could not be confirmed. Check the userscript manager."));
			} catch (error) {
				if (isAbortError(error) || error instanceof CredentialError) throw error;
				throw new CredentialError("storage", msg("Could not confirm the credential write. Check the userscript manager storage before retrying."));
			}
			return scopeOf(value);
		});
	}
	async function clearToken() {
		await withAuthLock(async () => {
			await _GM.setValue(key, {
				id: crypto.randomUUID(),
				token: null,
				login: null
			});
		});
	}
	var embeddedSelector = "react-app[app-name=\"code-view\"] script[data-target=\"react-app.embeddedData\"]";
	var shaPattern = /^[a-f0-9]{40}$/i;
	var normalPath = (path) => decodeURIComponent(path).replace(/\/$/, "");
	var reservedRoots = new Set([
		"settings",
		"orgs",
		"organizations",
		"users",
		"search",
		"marketplace",
		"collections",
		"topics",
		"explore",
		"login",
		"logout",
		"join",
		"signup",
		"features",
		"enterprise",
		"pricing",
		"sponsors",
		"notifications",
		"account",
		"customer-stories",
		"solutions",
		"security",
		"about",
		"site",
		"readme",
		"apps",
		"codespaces",
		"discussions",
		"events",
		"contact",
		"education",
		"resources"
	]);
	function readPage(doc, url, payload) {
		if (url.origin !== "https://github.com") return { kind: "outside" };
		const parts = url.pathname.split("/").filter(Boolean);
		if (parts.length < 2 || parts.length > 2 && parts[2] !== "tree" && parts[2] !== "blob") return { kind: "outside" };
		let owner, repo;
		try {
			owner = decodeURIComponent(parts[0]);
			repo = decodeURIComponent(parts[1]);
		} catch {
			return {
				kind: "unresolved",
				message: msg("Invalid repository URL")
			};
		}
		if (reservedRoots.has(owner.toLowerCase())) return { kind: "outside" };
		const unresolved = {
			kind: "unresolved",
			message: msg("Waiting for GitHub repository context…")
		};
		const script = doc.querySelector(embeddedSelector);
		try {
			payload ??= JSON.parse(script?.textContent || "{}").payload;
			const repository = (payload?.codeViewLayoutRoute)?.repo;
			if (repository?.ownerLogin?.toLowerCase() !== owner.toLowerCase() || repository?.name?.toLowerCase() !== repo.toLowerCase()) {
				const nwo = doc.querySelector("meta[name=\"octolytics-dimension-repository_nwo\"]")?.getAttribute("content");
				const empty = [...doc.querySelectorAll("h3")].some((el) => el.textContent?.trim() === "This repository is empty.");
				return parts.length === 2 && empty && nwo?.toLowerCase() === (owner + "/" + repo).toLowerCase() ? {
					kind: "empty",
					owner,
					repo
				} : unresolved;
			}
			if (repository.isEmpty === true && parts.length === 2) return {
				kind: "empty",
				owner,
				repo
			};
			const view = parts.length === 2 ? "root" : parts[2];
			const route = view === "root" ? payload?.codeViewRepoRoute : view === "tree" ? payload?.codeViewTreeRoute : payload?.codeViewBlobLayoutRoute;
			const ref = route?.refInfo;
			if (typeof route?.path !== "string" || typeof ref?.name !== "string" || !shaPattern.test(ref?.currentOid || "")) return unresolved;
			const path = route.path === "/" ? "" : route.path;
			const refKind = ref.refType === "branch" || ref.refType === "tag" || ref.refType === "commit" ? ref.refType : ref.name === ref.currentOid ? "commit" : null;
			if (!refKind) return unresolved;
			const context = {
				owner,
				repo,
				refName: ref.name,
				commitSha: ref.currentOid,
				refKind,
				path,
				view
			};
			const expected = view === "root" ? "/" + owner + "/" + repo : "/" + owner + "/" + repo + "/" + view + "/" + ref.name + (path ? "/" + path : "");
			if (normalPath(url.pathname) !== expected.replace(/\/$/, "")) return unresolved;
			return {
				kind: "code",
				context
			};
		} catch {
			return unresolved;
		}
	}
	async function resolvePage(doc, url, signal) {
		const page = readPage(doc, url);
		if (page.kind !== "unresolved") return page;
		const parts = url.pathname.split("/").filter(Boolean);
		const target = new URL(url.href);
		if (parts[2] === "blob") target.pathname = "/" + [
			...parts.slice(0, 2),
			"_layout",
			...parts.slice(3)
		].join("/");
		const request = async (endpoint) => {
			const response = await fetch(endpoint.href, {
				signal,
				credentials: "same-origin",
				headers: {
					Accept: "application/json",
					"GitHub-Is-React": "true"
				}
			});
			if (!response.ok || new URL(response.url).origin !== url.origin) throw new ApiError("invalid", msg("Could not read the current GitHub page context."));
			return response;
		};
		const response = await request(target);
		if (!response.headers.get("content-type")?.includes("application/json")) return readPage(new DOMParser().parseFromString(await response.text(), "text/html"), url);
		const payload = (await response.json()).payload;
		if (!payload || typeof payload !== "object" || Array.isArray(payload)) return page;
		if (!payload.codeViewLayoutRoute) payload.codeViewLayoutRoute = (await (await request(new URL("/" + parts.slice(0, 2).join("/") + "/_layout", url))).json()).payload?.codeViewLayoutRoute;
		return readPage(doc, url, payload);
	}
	function fileUrl(context, path) {
		return "https://github.com/" + encodeURIComponent(context.owner) + "/" + encodeURIComponent(context.repo) + "/blob/" + encodeURIComponent(context.refName) + "/" + path.split("/").map(encodeURIComponent).join("/");
	}
	function parentDirectoryUrl(context, path) {
		const parent = path.slice(0, Math.max(0, path.lastIndexOf("/")));
		return "https://github.com/" + encodeURIComponent(context.owner) + "/" + encodeURIComponent(context.repo) + "/tree/" + encodeURIComponent(context.refName) + (parent ? "/" + parent.split("/").map(encodeURIComponent).join("/") : "");
	}
	function observePage(onChange) {
		let frame = 0;
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(() => {
				frame = 0;
				onChange();
			});
		};
		const events = [
			"turbo:render",
			"turbo:load",
			"pjax:end"
		];
		events.forEach((event) => document.addEventListener(event, schedule));
		window.addEventListener("popstate", schedule);
		const observer = new MutationObserver((records) => {
			if (records.some((r) => [...r.removedNodes].some((n) => n instanceof Element) || [...r.addedNodes].some((n) => n instanceof Element && n.id !== "opsgittrees"))) schedule();
		});
		observer.observe(document.documentElement, {
			childList: true,
			subtree: true
		});
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
			events.forEach((e) => document.removeEventListener(e, schedule));
			window.removeEventListener("popstate", schedule);
		};
	}
	function observeTheme(listener) {
		const media = matchMedia("(prefers-color-scheme: dark)");
		const update = () => {
			const mode = document.documentElement.getAttribute("data-color-mode");
			listener(mode === "dark" || mode !== "light" && media.matches);
		};
		const observer = new MutationObserver(update);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: [
				"data-color-mode",
				"data-light-theme",
				"data-dark-theme"
			]
		});
		media.addEventListener("change", update);
		update();
		return () => {
			observer.disconnect();
			media.removeEventListener("change", update);
		};
	}
	function reservePageSpace(width) {
		const body = document.body;
		const value = body.style.getPropertyValue("margin-left");
		const priority = body.style.getPropertyPriority("margin-left");
		const originalMargin = getComputedStyle(body).marginLeft;
		const setWidth = (next) => body.style.setProperty("margin-left", "calc(" + originalMargin + " + " + next + "px)", "important");
		setWidth(width);
		return {
			setWidth,
			destroy: () => {
				if (value) body.style.setProperty("margin-left", value, priority);
				else body.style.removeProperty("margin-left");
			}
		};
	}
	var defaultAttributes = {
		xmlns: "http://www.w3.org/2000/svg",
		width: 24,
		height: 24,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		"stroke-width": 2,
		"stroke-linecap": "round",
		"stroke-linejoin": "round"
	};
	var createSVGElement = ([tag, attrs, children]) => {
		const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
		Object.keys(attrs).forEach((name) => {
			element.setAttribute(name, String(attrs[name]));
		});
		if (children?.length) children.forEach((child) => {
			const childElement = createSVGElement(child);
			element.appendChild(childElement);
		});
		return element;
	};
	var createElement = (iconNode, customAttrs = {}) => {
		return createSVGElement([
			"svg",
			{
				...defaultAttributes,
				...customAttrs
			},
			iconNode
		]);
	};
	var icons = {
		settings: [["path", { d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" }], ["circle", {
			cx: "12",
			cy: "12",
			r: "3"
		}]],
		back: [["path", { d: "m15 18-6-6 6-6" }]],
		down: [["path", { d: "m6 9 6 6 6-6" }]],
		right: [["path", { d: "m9 18 6-6-6-6" }]],
		branch: [
			["path", { d: "M15 6a9 9 0 0 0-9 9V3" }],
			["circle", {
				cx: "18",
				cy: "6",
				r: "3"
			}],
			["circle", {
				cx: "6",
				cy: "18",
				r: "3"
			}]
		],
		folder: [["path", { d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" }]],
		file: [["path", { d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" }], ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5" }]],
		link: [
			["path", { d: "M15 3h6v6" }],
			["path", { d: "M10 14 21 3" }],
			["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }]
		],
		search: [["path", { d: "m21 21-4.34-4.34" }], ["circle", {
			cx: "11",
			cy: "11",
			r: "8"
		}]],
		locate: [
			["line", {
				x1: "2",
				x2: "5",
				y1: "12",
				y2: "12"
			}],
			["line", {
				x1: "19",
				x2: "22",
				y1: "12",
				y2: "12"
			}],
			["line", {
				x1: "12",
				x2: "12",
				y1: "2",
				y2: "5"
			}],
			["line", {
				x1: "12",
				x2: "12",
				y1: "19",
				y2: "22"
			}],
			["circle", {
				cx: "12",
				cy: "12",
				r: "7"
			}],
			["circle", {
				cx: "12",
				cy: "12",
				r: "3"
			}]
		],
		close: [["path", { d: "M18 6 6 18" }], ["path", { d: "m6 6 12 12" }]],
		eye: [["path", { d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" }], ["circle", {
			cx: "12",
			cy: "12",
			r: "3"
		}]],
		eyeOff: [
			["path", { d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" }],
			["path", { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242" }],
			["path", { d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" }],
			["path", { d: "m2 2 20 20" }]
		],
		loading: [["path", { d: "M21 12a9 9 0 1 1-6.219-8.56" }]]
	};
	function svgIcon(name, className = "") {
		return createElement(icons[name], {
			"aria-hidden": "true",
			focusable: "false",
			class: "lucide" + (className ? " " + className : "")
		});
	}
	var credential_window_default = ":host{--lightningcss-light:initial;--lightningcss-dark: ;color-scheme:light;--bg:var(--overlay-bgColor,var(--bgColor-default,var(--color-canvas-default,#fff)));--input:var(--bgColor-default,var(--color-canvas-default,#fff));--fg:var(--fgColor-default,var(--color-fg-default,#1f2328));--muted:var(--fgColor-muted,var(--color-fg-muted,#59636e));--border:var(--borderColor-default,var(--color-border-default,#d1d9e0));--subtle:var(--bgColor-muted,var(--color-canvas-subtle,#f6f8fa));--accent:var(--fgColor-accent,var(--color-accent-fg,#0969da));--primary-bg:var(--button-primary-bgColor-rest,var(--color-btn-primary-bg,#1f883d));--primary-hover:var(--button-primary-bgColor-hover,var(--color-btn-primary-hover-bg,#1c8139));--primary-fg:var(--button-primary-fgColor-rest,var(--color-btn-primary-text,#fff));--primary-border:var(--button-primary-borderColor-rest,var(--color-btn-primary-border,#1f232826));--button-bg:var(--button-default-bgColor-rest,var(--control-bgColor-rest,#f6f8fa));--button-hover:var(--button-default-bgColor-hover,var(--control-bgColor-hover,#eff2f5));--error:var(--fgColor-danger,var(--color-danger-fg,#d1242f));--success:var(--fgColor-success,var(--color-success-fg,#1a7f37));--mono:\"SFMono-Regular\",Consolas,\"Liberation Mono\",monospace;color:var(--fg);font:13px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif}:host([data-theme=dark]){--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark;--bg:var(--overlay-bgColor,var(--bgColor-default,var(--color-canvas-default,#0d1117)));--input:var(--bgColor-default,var(--color-canvas-default,#0d1117));--fg:var(--fgColor-default,var(--color-fg-default,#f0f6fc));--muted:var(--fgColor-muted,var(--color-fg-muted,#9198a1));--border:var(--borderColor-default,var(--color-border-default,#3d444d));--subtle:var(--bgColor-muted,var(--color-canvas-subtle,#151b23));--accent:var(--fgColor-accent,var(--color-accent-fg,#4493f8));--primary-bg:var(--button-primary-bgColor-rest,var(--color-btn-primary-bg,#238636));--primary-hover:var(--button-primary-bgColor-hover,var(--color-btn-primary-hover-bg,#29903b));--primary-border:var(--button-primary-borderColor-rest,var(--color-btn-primary-border,#ffffff1a));--button-bg:var(--button-default-bgColor-rest,var(--control-bgColor-rest,#212830));--button-hover:var(--button-default-bgColor-hover,var(--control-bgColor-hover,#262c36));--error:var(--fgColor-danger,var(--color-danger-fg,#f85149));--success:var(--fgColor-success,var(--color-success-fg,#3fb950))}*{box-sizing:border-box}[hidden]{display:none!important}dialog{border:1px solid var(--border);background:var(--bg);width:min(440px,100vw - 32px);max-width:none;max-height:calc(100dvh - 32px);color:var(--fg);font:inherit;box-shadow:var(--shadow-floating-large,var(--shadow-floating-small,0 12px 36px #0005));overscroll-behavior:contain;border-radius:2px;margin:auto;padding:0;overflow:auto}dialog::backdrop{background:var(--overlay-backdrop-bgColor,#0007)}main{padding:20px}header{justify-content:space-between;align-items:center;gap:12px;display:flex}button.close{width:26px;height:26px;color:var(--muted);background:0 0;border:0;place-items:center;margin:-4px -4px 0 0;padding:0;display:grid}h1{margin:0;font-size:16px;font-weight:600;line-height:1.4}.summary{color:var(--muted);overflow-wrap:anywhere;flex-wrap:wrap;align-items:center;gap:8px;margin:12px 0 20px;font-size:12px;display:flex}.summary[data-authenticated=true] .stored{color:var(--success)}form>label{margin:0 0 7px;font-size:12px;font-weight:600;display:block}input,button{font:inherit;color:inherit}input[type=password],input[type=text]{border:1px solid var(--border);border-radius:var(--borderRadius-medium,6px);background:var(--input);width:100%;font:12px var(--mono);padding:8px 10px}.token-field{margin-bottom:12px;position:relative}.token-field input{padding-right:42px}button.reveal{width:28px;height:28px;color:var(--muted);background:0 0;border:0;place-items:center;padding:0;display:grid;position:absolute;top:50%;right:4px;transform:translateY(-50%)}button.reveal:hover{background:var(--subtle);color:var(--fg)}.close svg,.reveal svg{pointer-events:none;width:16px;height:16px}.privacy{color:var(--muted);margin:16px 0 0;font-size:11px}.actions{flex-wrap:wrap;gap:7px;display:flex}button{border:1px solid var(--border);border-radius:var(--borderRadius-medium,6px);background:var(--button-bg);cursor:pointer;padding:6px 10px;font-size:12px}button:hover{background:var(--button-hover)}button.primary{background:var(--primary-bg);border-color:var(--primary-border);color:var(--primary-fg);font-weight:500}button.primary:hover{background:var(--primary-hover)}button.danger{color:var(--error)}button:disabled{opacity:.5;cursor:not-allowed}button:focus-visible,input:focus-visible,a:focus-visible{outline:1px solid var(--accent);outline-offset:2px}.result{background:var(--subtle);border-left:2px solid var(--border);overflow-wrap:anywhere;margin:16px 0 12px;padding:8px 10px;font-size:12px}.result[hidden]+.actions{margin-top:16px}.result[data-kind=error]{border-left-color:var(--error)}.result[data-kind=success]{border-left-color:var(--success)}.guide{border-top:1px solid var(--border);color:var(--muted);margin-top:18px;padding-top:14px;font-size:11px}h2{color:var(--fg);margin:0 0 6px;font-size:12px;font-weight:500}.guide p{margin:6px 0}a{color:var(--accent);margin:7px 0;text-decoration:none;display:block}a:hover{text-decoration:underline}@media (max-width:420px){main{padding:16px}}";
	function isolationRestriction() {
		const info = _GM_info;
		if (info.scriptHandler === "Tampermonkey" && info.sandboxMode === "dom") return null;
		if (info.scriptHandler === "Violentmonkey" && info.injectInto === "content") return null;
		if (info.scriptHandler === "ScriptCat" && /^\/\/\s*@inject-into\s+content\s*$/m.test(info.scriptMetaStr || "")) return null;
		return msg("Token input is unavailable in this execution context. Reinstall the current script with content / DOM isolation enabled, then reload GitHub. No Token was requested.");
	}
	function failure(error) {
		if (error instanceof CredentialError) return msg("{stage} stage: {error}", {
			stage: msg(error.stage),
			error: error.detail
		});
		if (error instanceof ApiError) return msg("API check: {error}", { error: error.detail });
		if (isAbortError(error)) return msg("Cancelled or authorization changed. Candidate not saved.");
		return msg("Userscript storage could not be accessed. Check the manager before retrying.");
	}
	function createCredentialManager(notice, checkRepository) {
		let dialog = null;
		let dispose = null;
		let cancel = null;
		let result = null;
		async function clear() {
			cancel?.();
			try {
				await clearToken();
				const message = msg("Local Token cleared. Private cache is invalidated. Revoke the Token separately on GitHub if needed.");
				result?.(message, "success");
				notice(message);
			} catch (error) {
				const message = failure(error);
				result?.(message, "error");
				notice(message);
			}
		}
		function close() {
			dispose?.();
		}
		function open() {
			if (dialog?.isConnected) {
				dialog.querySelector("input")?.focus();
				return;
			}
			dispose?.();
			const restriction = isolationRestriction();
			if (restriction) {
				notice(restriction);
				return;
			}
			const doc = document;
			const host = doc.createElement("div");
			host.id = "opsgittrees-credentials";
			const shadow = host.attachShadow({ mode: "open" });
			const translations = createTranslations();
			host.lang = getLanguage();
			function node(tag, text = "", className = "") {
				const element = doc.createElement(tag);
				if (typeof text === "string") element.textContent = text;
				else translations.bind(element, text);
				element.className = className;
				return element;
			}
			function button(text) {
				const element = node("button", text);
				element.type = "button";
				return element;
			}
			const modal = node("dialog");
			modal.setAttribute("aria-labelledby", "token-title");
			dialog = modal;
			const main = node("main");
			const done = button("");
			done.className = "close";
			done.append(svgIcon("close"));
			translations.bind(done, msg("Close Token configuration"), "aria-label");
			const title = node("h1", msg("Token management"));
			title.id = "token-title";
			const header = node("header");
			header.append(title, done);
			const summary = node("div", "", "summary");
			const stored = node("span", "", "stored"), account = node("span");
			summary.append(stored, account);
			const form = node("form");
			const label = node("label", "Token");
			label.htmlFor = "token";
			const input = node("input");
			input.id = "token";
			input.type = "password";
			input.required = true;
			input.autocomplete = "off";
			input.spellcheck = false;
			input.autocapitalize = "none";
			const field = node("div", "", "token-field");
			const reveal = button("");
			reveal.className = "reveal";
			const eye = svgIcon("eye"), eyeOff = svgIcon("eyeOff");
			reveal.append(eye, eyeOff);
			field.append(input, reveal);
			function setRevealed(show) {
				input.type = show ? "text" : "password";
				reveal.setAttribute("aria-pressed", String(show));
				eye.toggleAttribute("hidden", show);
				eyeOff.toggleAttribute("hidden", !show);
				const text = t(show ? "Hide Token" : "Show Token");
				reveal.setAttribute("aria-label", text);
				reveal.title = text;
			}
			setRevealed(false);
			const save = button(msg("Verify & save"));
			save.type = "submit";
			save.className = "primary";
			const stop = button(msg("Cancel check"));
			stop.hidden = true;
			const actions = node("div", "", "actions");
			actions.append(save, stop);
			form.append(label, field, actions);
			let lastResult = "";
			const status = node("p", "", "result");
			status.hidden = true;
			status.setAttribute("role", "status");
			status.setAttribute("aria-live", "polite");
			const check = button(msg("Check saved Token")), repository = button(msg("Check current repository")), remove = button(msg("Clear local Token"));
			remove.className = "danger";
			const secondary = node("div", "", "actions");
			secondary.append(check, repository, remove);
			const guide = node("section", "", "guide");
			const create = node("a", msg("Create a fine-grained Token ↗"));
			create.href = "https://github.com/settings/personal-access-tokens/new";
			create.target = "_blank";
			create.rel = "noopener noreferrer";
			const revoke = node("a", msg("Manage / revoke on GitHub ↗"));
			revoke.href = "https://github.com/settings/personal-access-tokens";
			revoke.target = "_blank";
			revoke.rel = "noopener noreferrer";
			guide.append(node("h2", msg("Minimum access")), node("p", msg("Contents: Read-only · Metadata: Read-only")), create, revoke);
			const privacy = node("p", msg("This page can read the Token. Clearing locally does not revoke it on GitHub."), "privacy");
			main.append(header, summary, form, status, secondary, guide, privacy);
			modal.append(main);
			shadow.append(node("style", credential_window_default), modal);
			doc.body.append(host);
			const stopTheme = observeTheme((dark) => host.setAttribute("data-theme", dark ? "dark" : "light"));
			let scope = null, operation = null, clearing = false, disposed = false, edited = false;
			const live = () => !disposed && dialog === modal && host.isConnected;
			const report = (message, kind = "info") => {
				if (live()) {
					lastResult = message;
					status.textContent = renderText(message);
					status.hidden = false;
					status.dataset.kind = kind;
				}
			};
			result = report;
			function controls() {
				const busy = !!operation || clearing;
				input.disabled = busy;
				save.disabled = busy;
				stop.hidden = !operation;
				check.disabled = busy || !scope?.authenticated;
				repository.disabled = busy;
				remove.disabled = clearing || !scope?.authenticated && !operation;
			}
			function renderSummary() {
				stored.textContent = t(scope?.authenticated ? "Token saved" : "Not configured");
				account.textContent = scope?.authenticated ? "@" + scope.login : "";
				summary.dataset.authenticated = String(!!scope?.authenticated);
				summary.title = t(scope?.authenticated ? "Token · public and private repositories" : "Anonymous");
			}
			const stopLanguage = observeLanguage(() => {
				translations.refresh();
				host.lang = getLanguage();
				renderSummary();
				status.textContent = renderText(lastResult);
				setRevealed(input.type === "text");
			});
			async function refresh() {
				try {
					const next = await readAuthScope();
					const token = next.authenticated ? await readSavedToken(next) : null;
					if (!live() || !isAuthScopeCurrent(next)) return;
					scope = next;
					if (!edited) input.value = token || "";
					renderSummary();
					controls();
				} catch (error) {
					if (!isAbortError(error)) report(failure(error), "error");
				}
			}
			cancel = () => {
				operation?.abort();
				input.value = "";
				edited = false;
				setRevealed(false);
			};
			const stopObserve = observeAuthScope(() => {
				input.value = "";
				edited = false;
				setRevealed(false);
				refresh();
			});
			dispose = () => {
				if (disposed) return;
				disposed = true;
				operation?.abort();
				input.value = "";
				stopObserve();
				stopTheme();
				stopLanguage();
				modal.close();
				host.remove();
				result = null;
				cancel = null;
				dispose = null;
				dialog = null;
			};
			modal.addEventListener("cancel", (event) => {
				event.preventDefault();
				close();
			});
			modal.addEventListener("close", () => {
				if (live()) close();
			});
			modal.addEventListener("click", (event) => {
				if (event.target !== modal) return;
				const box = modal.getBoundingClientRect();
				if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
			});
			input.addEventListener("input", () => {
				edited = true;
			});
			reveal.addEventListener("click", () => setRevealed(input.type === "password"));
			stop.addEventListener("click", () => {
				cancel?.();
				report(msg("Cancelling the check…"));
			});
			done.addEventListener("click", close);
			remove.addEventListener("click", () => {
				clearing = true;
				controls();
				clear().finally(() => {
					clearing = false;
					if (live()) {
						controls();
						refresh();
					}
				});
			});
			form.addEventListener("submit", (event) => {
				event.preventDefault();
				if (operation || clearing) return;
				const candidate = input.value;
				input.value = "";
				edited = false;
				setRevealed(false);
				const controller = new AbortController();
				operation = controller;
				controls();
				report(msg("Checking identity with GitHub. Candidate is not saved yet…"));
				configureToken(candidate, controller.signal).then((next) => {
					if (!live() || controller.signal.aborted) return;
					report(msg("Saved and read back from userscript storage. API account: @{login}. Repository permissions are checked separately.", { login: next.login || "" }), "success");
					notice(msg("Token saved. API requests now use @{login}.", { login: next.login || "" }));
				}).catch((error) => report(failure(error), "error")).finally(() => {
					if (operation === controller) operation = null;
					if (live()) {
						controls();
						refresh();
					}
				});
			});
			check.addEventListener("click", () => {
				if (operation || clearing || !scope?.authenticated) return;
				const checked = scope, controller = new AbortController();
				operation = controller;
				controls();
				report(msg("Checking saved Token identity…"));
				getGitHubClient(checked).then((client) => client.getIdentity(controller.signal)).then((identity) => {
					if (live() && !controller.signal.aborted && isAuthScopeCurrent(checked)) report(msg("Identity verified: @{login}.", { login: identity.login }), "success");
				}).catch((error) => report(failure(error), "error")).finally(() => {
					if (operation === controller) operation = null;
					if (live()) controls();
				});
			});
			repository.addEventListener("click", () => {
				if (operation || clearing) return;
				const controller = new AbortController();
				operation = controller;
				controls();
				report(msg("Checking identity and repository access…"));
				checkRepository(controller.signal).then((message) => {
					if (live() && !controller.signal.aborted) report(message, "success");
				}).catch((error) => report(failure(error), "error")).finally(() => {
					if (operation === controller) operation = null;
					if (live()) controls();
				});
			});
			controls();
			refresh();
			modal.showModal();
			input.focus();
		}
		return {
			open,
			close
		};
	}
	var settingsKey = "ogt:settings:v1";
	var prefix = "ogt:data:v1:";
	var cachePrefix = "ogt:cache:v2:";
	var storageLock = "opsgittrees:storage";
	var objectSha = /^[0-9a-f]{40}$/i;
	var encoder = new TextEncoder();
	var totalLimit = 16777216;
	var trimTextThreshold = 1048576;
	var pendingTrimText = 0;
	var recent = new Map();
	function rememberUse(key) {
		recent.delete(key);
		recent.set(key, Date.now());
		if (recent.size > 1024) {
			const oldest = recent.keys().next().value;
			if (oldest !== void 0) recent.delete(oldest);
		}
	}
	function hasCachedCoverage(group, sha) {
		const known = group.memo.get(sha);
		if (known !== void 0) return known;
		const cached = group.blocks.get(sha);
		if (cached?.recursive && !cached.recursive.truncated) {
			group.memo.set(sha, true);
			return true;
		}
		if (group.visiting.has(sha)) return false;
		if (!cached?.listing || cached.listing.truncated) {
			group.memo.set(sha, false);
			return false;
		}
		group.visiting.add(sha);
		const complete = cached.listing.tree.every((entry) => entry.type !== "tree" || hasCachedCoverage(group, entry.sha));
		group.visiting.delete(sha);
		group.memo.set(sha, complete);
		return complete;
	}
	var StorageLimitError = class extends Error {
		detail = msg("Persistent-cache budget exceeded; loaded paths remain available in memory.");
		constructor() {
			super();
			this.message = renderText(this.detail);
		}
	};
	var cacheScope = (context, scope) => context.visibility === "public" ? "public" : scope.id;
	var viewKey = (context, scope) => prefix + JSON.stringify([
		"view",
		context.repoId,
		context.refKind,
		context.refName,
		cacheScope(context, scope)
	]);
	var commitKey = (context, scope) => cachePrefix + JSON.stringify([
		"commit",
		context.repoId,
		context.commitSha,
		cacheScope(context, scope)
	]);
	var blockKey = (context, scope, sha, recursive) => cachePrefix + JSON.stringify([
		"tree",
		context.repoId,
		sha,
		recursive,
		cacheScope(context, scope)
	]);
	async function allowed(context, scope) {
		if (context.visibility === "public") return true;
		const now = await readAuthScope();
		return scope.authenticated && now.authenticated && now.id === scope.id && isAuthScopeCurrent(scope);
	}
	function validTreeView(value) {
		if (!value || typeof value !== "object" || Array.isArray(value)) return false;
		const view = value;
		return Array.isArray(view.expanded) && view.expanded.every((path) => typeof path === "string") && typeof view.scrollTop === "number" && Number.isFinite(view.scrollTop) && view.scrollTop >= 0 && (view.anchorPath === null || typeof view.anchorPath === "string") && typeof view.anchorOffset === "number" && Number.isFinite(view.anchorOffset) && view.anchorOffset >= 0;
	}
	function validViewState(value) {
		if (!value || typeof value !== "object" || Array.isArray(value)) return false;
		const view = value;
		if (!validTreeView(view.browsing)) return false;
		if (view.search === null) return true;
		if (!view.search || typeof view.search !== "object" || Array.isArray(view.search)) return false;
		return typeof view.search.query === "string" && validTreeView(view.search.view) && Array.isArray(view.search.collapsed) && view.search.collapsed.every((path) => typeof path === "string");
	}
	function parseLegacy(key, value) {
		if (typeof value !== "string") return null;
		try {
			const record = JSON.parse(value);
			const identity = JSON.parse(key.slice(12));
			if (!record || record.schema !== 1 || !Array.isArray(identity) || !Number.isSafeInteger(identity[1]) || identity[1] <= 0 || typeof record.scope !== "string" || !record.scope || record.private !== (record.scope !== "public") || !Number.isFinite(record.usedAt) || record.usedAt < 0 || identity.at(-1) !== record.scope) return null;
			if (identity[0] === "tree" && identity.length === 4 && typeof identity[2] === "string" && objectSha.test(identity[2]) && Array.isArray(record.entries) && !("view" in record) && parseTreeResponse({
				sha: identity[2],
				truncated: false,
				tree: record.entries
			}, identity[2]) && record.entries.every((entry) => typeof entry.name === "string" && typeof entry.mode === "string")) return record;
			if (identity[0] === "view" && identity.length === 5 && [
				"branch",
				"tag",
				"commit"
			].includes(identity[2]) && typeof identity[3] === "string" && identity[3] && validViewState(record.view) && !("entries" in record)) return record;
			return null;
		} catch {
			return null;
		}
	}
	function parseCache(key, value) {
		if (!key.startsWith(cachePrefix) || typeof value !== "string") return null;
		try {
			const record = JSON.parse(value);
			const identity = JSON.parse(key.slice(13));
			if (!record || !Array.isArray(identity) || record.schema !== 2 || typeof record.repoId !== "number" || !Number.isSafeInteger(record.repoId) || record.repoId <= 0 || typeof record.scope !== "string" || !record.scope || typeof record.private !== "boolean" || record.private !== (record.scope !== "public") || typeof record.usedAt !== "number" || !Number.isFinite(record.usedAt) || record.usedAt < 0 || typeof record.treeSha !== "string" || !objectSha.test(record.treeSha) || identity[1] !== record.repoId) return null;
			if (record.kind === "commit") {
				if (identity.length !== 4 || identity[0] !== "commit" || identity[2] !== record.commitSha || identity[3] !== record.scope || typeof record.commitSha !== "string" || !objectSha.test(record.commitSha)) return null;
				return record;
			}
			if (identity.length !== 5 || identity[0] !== "tree" || identity[2] !== record.treeSha || identity[3] !== record.recursive || identity[4] !== record.scope || typeof record.recursive !== "boolean") return null;
			if (record.kind === "split") return record.recursive && !("response" in record) ? record : null;
			if (record.kind !== "response") return null;
			const response = parseTreeResponse(record.response, record.treeSha);
			if (!response) return null;
			record.response = response;
			return record;
		} catch {
			return null;
		}
	}
	async function readCacheRecord(key, context, scope) {
		if (!await allowed(context, scope)) return null;
		const record = parseCache(key, await _GM.getValue(key));
		if (!record || record.scope !== cacheScope(context, scope) || record.private !== (context.visibility !== "public") || !await allowed(context, scope)) {
			recent.delete(key);
			return null;
		}
		rememberUse(key);
		return record;
	}
	async function changeUnchanged(key, raw, scope, replacement) {
		return withAuthLock(async () => {
			if (!isAuthScopeCurrent(scope)) return false;
			const current = await _GM.getValue(key);
			if (!isAuthScopeCurrent(scope) || current !== raw) return false;
			if (replacement === void 0) {
				await _GM.deleteValue(key);
				recent.delete(key);
			} else await _GM.setValue(key, replacement);
			return true;
		});
	}
	async function readRecord(key, context, scope) {
		if (!await allowed(context, scope)) return null;
		const record = parseLegacy(key, await _GM.getValue(key));
		if (!record || record.scope !== cacheScope(context, scope) || record.private !== (context.visibility !== "public") || !await allowed(context, scope)) {
			recent.delete(key);
			return null;
		}
		rememberUse(key);
		return record;
	}
	async function trim() {
		const scope = await readAuthScope();
		const records = [];
		const groups = new Map();
		const present = new Set();
		for (const key of await _GM.listValues()) {
			if (!key.startsWith(prefix) && !key.startsWith(cachePrefix)) continue;
			const raw = await _GM.getValue(key);
			if (!isAuthScopeCurrent(scope)) return false;
			const record = key.startsWith(cachePrefix) ? parseCache(key, raw) : parseLegacy(key, raw);
			if (!record && key.startsWith(prefix)) continue;
			if (!record || record.schema === 1 && record.entries || record.private && (!scope.authenticated || record.scope !== scope.id)) {
				await changeUnchanged(key, raw, scope);
				continue;
			}
			present.add(key);
			records.push({
				key,
				raw,
				bytes: encoder.encode(raw).byteLength,
				usedAt: Math.max(record.usedAt, recent.get(key) ?? record.usedAt),
				record
			});
			if (record.schema !== 2 || record.kind !== "response") continue;
			const identity = JSON.stringify([record.repoId, record.scope]);
			let group = groups.get(identity);
			if (!group) {
				group = {
					blocks: new Map(),
					memo: new Map(),
					visiting: new Set()
				};
				groups.set(identity, group);
			}
			let blocks = group.blocks.get(record.treeSha);
			if (!blocks) {
				blocks = {};
				group.blocks.set(record.treeSha, blocks);
			}
			blocks[record.recursive ? "recursive" : "listing"] = record.response;
		}
		if (!isAuthScopeCurrent(scope)) return false;
		for (const key of recent.keys()) if (!present.has(key)) recent.delete(key);
		let size = records.reduce((bytes, item) => bytes + item.bytes, 0);
		records.sort((a, b) => a.usedAt - b.usedAt);
		for (const item of records) {
			if (!isAuthScopeCurrent(scope)) return false;
			const record = item.record;
			if (record.schema !== 2 || record.kind !== "response" || !record.recursive || !record.response.truncated) continue;
			const group = groups.get(JSON.stringify([record.repoId, record.scope]));
			if (size <= totalLimit && (!group || !hasCachedCoverage(group, record.treeSha))) continue;
			const split = {
				schema: 2,
				kind: "split",
				repoId: record.repoId,
				scope: record.scope,
				private: record.private,
				usedAt: record.usedAt,
				treeSha: record.treeSha,
				recursive: true
			};
			const replacement = serialize(split), bytes = encoder.encode(replacement).byteLength;
			if (await changeUnchanged(item.key, item.raw, scope, replacement)) {
				size += bytes - item.bytes;
				item.raw = replacement;
				item.bytes = bytes;
				item.record = split;
			}
		}
		for (const skeleton of [false, true]) for (const item of records) {
			if (!isAuthScopeCurrent(scope)) return false;
			if (size <= totalLimit) return true;
			const record = item.record;
			if ((record.schema === 2 && (record.kind === "split" || record.kind === "response" && !record.recursive)) !== skeleton) continue;
			if (await changeUnchanged(item.key, item.raw, scope)) size -= item.bytes;
		}
		return isAuthScopeCurrent(scope);
	}
	function serialize(record) {
		const value = JSON.stringify(record);
		if (encoder.encode(value).byteLength > totalLimit) throw new StorageLimitError();
		return value;
	}
	function noteSuccessfulWrite(serialized) {
		pendingTrimText += serialized.length;
		return pendingTrimText >= trimTextThreshold;
	}
	function resetTrimCounters() {
		pendingTrimText = 0;
	}
	async function finishWrite(key, serialized, context, scope, written = true) {
		const authorized = await allowed(context, scope);
		if (authorized && written && noteSuccessfulWrite(serialized) && await trim()) resetTrimCounters();
		if (!authorized || !await allowed(context, scope)) {
			await changeUnchanged(key, serialized, await readAuthScope());
			throw new DOMException("Authorization changed", "AbortError");
		}
	}
	async function writeRecord(key, context, scope, record) {
		await navigator.locks.request(storageLock, async () => {
			if (!await allowed(context, scope)) throw new DOMException("Authorization changed", "AbortError");
			const serialized = serialize(record);
			if (record.schema === 2 && record.kind === "response") {
				const raw = await _GM.getValue(key), previous = parseCache(key, raw);
				if (!await allowed(context, scope)) throw new DOMException("Authorization changed", "AbortError");
				if (record.response.truncated && (previous?.kind === "split" || previous?.kind === "response" && !previous.response.truncated)) {
					rememberUse(key);
					await finishWrite(key, raw, context, scope, false);
					return;
				}
			}
			await _GM.setValue(key, serialized);
			rememberUse(key);
			await finishWrite(key, serialized, context, scope);
		});
	}
	function normalizeSettings(value) {
		return {
			collapsed: typeof value?.collapsed === "boolean" ? value.collapsed : false,
			width: typeof value?.width === "number" && Number.isFinite(value.width) ? Math.max(200, Math.min(480, value.width)) : 280,
			shortcutsEnabled: value?.shortcutsEnabled !== false,
			language: value?.language === "en" || value?.language === "zh-CN" ? value.language : "auto"
		};
	}
	async function readSettings() {
		return normalizeSettings(await _GM.getValue(settingsKey, {}));
	}
	async function writeSettings(changes) {
		await navigator.locks.request("opsgittrees:settings", async () => {
			await _GM.setValue(settingsKey, {
				...await readSettings(),
				...changes
			});
		});
	}
	function observeSettings(listener) {
		let stopped = false;
		const registration = Promise.resolve(_GM.addValueChangeListener(settingsKey, (_name, _old, value) => {
			if (!stopped) listener(normalizeSettings(value));
		}));
		return () => {
			stopped = true;
			registration.then((id) => _GM.removeValueChangeListener(id));
		};
	}
	async function readCommitTree(context, scope) {
		const record = await readCacheRecord(commitKey(context, scope), context, scope);
		return record?.kind === "commit" ? record.treeSha : null;
	}
	async function writeCommitTree(context, scope) {
		if (!Number.isSafeInteger(context.repoId) || context.repoId <= 0 || !objectSha.test(context.commitSha) || !objectSha.test(context.rootTreeSha)) throw new TypeError("Invalid commit cache identity");
		await writeRecord(commitKey(context, scope), context, scope, {
			schema: 2,
			kind: "commit",
			repoId: context.repoId,
			scope: cacheScope(context, scope),
			private: context.visibility !== "public",
			usedAt: Date.now(),
			commitSha: context.commitSha,
			treeSha: context.rootTreeSha
		});
	}
	async function readTreeBlock(context, scope, sha, recursive) {
		const record = await readCacheRecord(blockKey(context, scope, sha, recursive), context, scope);
		return record?.kind === "response" ? {
			kind: "response",
			response: record.response
		} : record?.kind === "split" ? { kind: "split" } : null;
	}
	async function writeTreeBlock(context, scope, sha, recursive, response) {
		const validated = parseTreeResponse(response, sha);
		if (!validated || !Number.isSafeInteger(context.repoId) || context.repoId <= 0 || typeof recursive !== "boolean") throw new TypeError("Invalid tree cache response");
		await writeRecord(blockKey(context, scope, sha, recursive), context, scope, {
			schema: 2,
			kind: "response",
			repoId: context.repoId,
			scope: cacheScope(context, scope),
			private: context.visibility !== "public",
			usedAt: Date.now(),
			treeSha: sha,
			recursive,
			response: validated
		});
	}
	async function readView(context, scope) {
		return (await readRecord(viewKey(context, scope), context, scope))?.view || null;
	}
	async function writeView(context, scope, view) {
		if (context.visibility !== "public" && (!scope.authenticated || !isAuthScopeCurrent(scope))) throw new DOMException("Authorization changed", "AbortError");
		const key = viewKey(context, scope);
		const serialized = serialize({
			schema: 1,
			scope: cacheScope(context, scope),
			private: context.visibility !== "public",
			usedAt: Date.now(),
			view
		});
		_GM_setValue(key, serialized);
		await navigator.locks.request(storageLock, () => finishWrite(key, serialized, context, scope));
	}
	async function purgePrivateData() {
		await navigator.locks.request(storageLock, async () => {
			if (await trim()) resetTrimCounters();
		});
	}
	function parentPath(path) {
		const slash = path.lastIndexOf("/");
		return slash < 0 ? "" : path.slice(0, slash);
	}
	function ancestors(path) {
		const result = [];
		for (let parent = parentPath(path); parent; parent = parentPath(parent)) result.push(parent);
		return result;
	}
	var TreeIndex = class {
		entries = new Map();
		children = new Map([["", []]]);
		dirty = new Set();
		add(entries, prefix = "") {
			for (const entry of entries) {
				const path = prefix ? prefix + "/" + entry.path : entry.path;
				for (const ancestor of ancestors(path).reverse()) if (!this.entries.has(ancestor)) this.insert({
					path: ancestor,
					name: ancestor.slice(ancestor.lastIndexOf("/") + 1),
					sha: "",
					mode: "040000",
					type: "tree"
				});
				this.insert({
					...entry,
					path,
					name: path.slice(path.lastIndexOf("/") + 1)
				});
			}
		}
		insert(entry) {
			const old = this.entries.get(entry.path);
			this.entries.set(entry.path, entry);
			if (entry.type === "tree" && !this.children.has(entry.path)) this.children.set(entry.path, []);
			const parent = parentPath(entry.path);
			if (!this.children.has(parent)) this.children.set(parent, []);
			if (!old) this.children.get(parent).push(entry.path);
			this.dirty.add(parent);
		}
		view(state, pending = 0, reason) {
			for (const parent of this.dirty) this.children.get(parent)?.sort((a, b) => {
				const left = this.entries.get(a), right = this.entries.get(b);
				if (left.type === "tree" !== (right.type === "tree")) return left.type === "tree" ? -1 : 1;
				return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
			});
			this.dirty.clear();
			return {
				entries: this.entries,
				children: this.children,
				state,
				pending,
				reason
			};
		}
	};
	var emptyTreeSha = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
	function startPreload(context, scope, client, onChange, signal) {
		const index = new TreeIndex();
		const queue = context.rootTreeSha === emptyTreeSha ? [] : [{
			sha: context.rootTreeSha,
			prefix: "",
			recursive: true
		}];
		const missing = [];
		const responses = new Map();
		const activeKeys = new Map();
		let visible = new Set();
		let active = 0, batchRequests = 0, timer;
		let stopped = false, halted = false, terminalIncomplete = false;
		let state = "loading";
		let reason, storageReason;
		let canResume = false;
		let resumeAt;
		const hasPendingKey = (key) => queue.some((task) => keyOf(task) === key) || missing.some((task) => keyOf(task) === key);
		const releaseResponse = (key) => {
			if (!responses.get(key)?.settled) return;
			if (!(activeKeys.get(key) || 0) && !hasPendingKey(key)) responses.delete(key);
		};
		const dropSettledResponses = () => {
			for (const key of responses.keys()) releaseResponse(key);
		};
		const incompleteReason = msg("GitHub truncated a non-recursive directory listing. Results remain incomplete; this API cannot enumerate all entries.");
		const emit = () => {
			if (!signal.aborted) onChange({
				...index.view(state, halted ? 0 : queue.length + missing.length + active, reason || (terminalIncomplete ? incompleteReason : storageReason)),
				canResume,
				resumeAt
			});
		};
		const keyOf = (task) => task.sha + ":" + task.recursive;
		const priority = (task) => !task.prefix || context.path === task.prefix || context.path.startsWith(task.prefix + "/") ? 0 : visible.has(task.prefix) ? 1 : 2;
		function halt(message) {
			halted = true;
			clearTimeout(timer);
			queue.length = 0;
			missing.length = 0;
			responses.clear();
			if (context.visibility !== "public") {
				index.entries.clear();
				index.children.clear();
			}
			state = "failed";
			reason = message;
			canResume = false;
			resumeAt = void 0;
			emit();
		}
		function current() {
			if (signal.aborted || halted) return false;
			if (context.visibility !== "public" && !isAuthScopeCurrent(scope)) {
				halt(msg("Authorization changed; private index cleared."));
				return false;
			}
			return true;
		}
		function storageFailure(error) {
			if (isAbortError(error)) halt(msg("Authorization changed; private index cleared."));
			else storageReason = error instanceof StorageLimitError ? error.detail : msg("Persistent cache unavailable; index remains usable in memory.");
		}
		async function readCached(task) {
			try {
				return await readTreeBlock(context, scope, task.sha, task.recursive);
			} catch (error) {
				if (current()) storageFailure(error);
				return null;
			}
		}
		function pause(message, nextState, retry, at) {
			stopped = true;
			dropSettledResponses();
			const barrier = Math.max(resumeAt || 0, at || 0, client.quota.blockedUntil || 0) || void 0;
			if (retry && resumeAt && resumeAt > Date.now() && (!at || at < resumeAt)) {
				resumeAt = barrier;
				emit();
				return;
			}
			state = nextState;
			reason = message;
			canResume = retry;
			resumeAt = barrier;
			emit();
		}
		function schedule() {
			if (!current()) return;
			const quota = client.quota;
			if (quota.resumeAt && Date.now() >= quota.resumeAt) {
				quota.remaining = null;
				quota.resumeAt = null;
			}
			queue.sort((a, b) => priority(a) - priority(b));
			missing.sort((a, b) => priority(a) - priority(b));
			while (active < 2) {
				let task = queue.shift();
				const network = !task;
				if (!task) {
					const shared = missing.findIndex((candidate) => responses.has(keyOf(candidate)));
					if (shared >= 0) task = missing.splice(shared, 1)[0];
					else {
						if (!missing.length || stopped) break;
						if (quota.blockedUntil && quota.blockedUntil > Date.now()) {
							pause(msg("GitHub rate limit remains active."), "paused", true, quota.blockedUntil);
							break;
						}
						if (quota.remaining !== null && quota.remaining <= 5) {
							pause(msg("GitHub request quota is low. Loaded paths remain usable; continue after the quota resets."), "paused", true, quota.resumeAt || void 0);
							break;
						}
						if (batchRequests >= 40) break;
						task = missing.shift();
					}
				}
				if (!task || !current()) break;
				active++;
				run(task, network);
			}
			if (!queue.length && !missing.length && !active) {
				state = terminalIncomplete ? "partial" : "complete";
				canResume = false;
				resumeAt = void 0;
				responses.clear();
				emit();
			} else if (!active && missing.length && !stopped && batchRequests >= 40 && !timer) timer = setTimeout(() => {
				timer = void 0;
				batchRequests = 0;
				schedule();
			}, 0);
		}
		async function run(task, network) {
			const runKey = keyOf(task);
			activeKeys.set(runKey, (activeKeys.get(runKey) || 0) + 1);
			let publish = false;
			try {
				let data;
				if (!network) {
					const cached = await readCached(task);
					if (!current()) return;
					if (cached?.kind === "response") data = cached.response;
					else if (task.recursive) {
						const enumeration = {
							...task,
							recursive: false
						};
						const direct = await readCached(enumeration);
						if (!current()) return;
						if (direct?.kind === "response") {
							task = enumeration;
							data = direct.response;
						} else if (cached?.kind === "split") task = enumeration;
					}
					if (!data) {
						missing.push(task);
						return;
					}
				} else {
					const key = keyOf(task);
					let slot = responses.get(key);
					if (!slot) {
						batchRequests++;
						publish = true;
						const created = {
							promise: client.getTree(context, task.sha, task.recursive, signal),
							settled: false
						};
						responses.set(key, created);
						slot = created;
						created.promise.then(() => {
							created.settled = true;
							if (responses.get(key) === created) releaseResponse(key);
						}, () => {
							created.settled = true;
							if (responses.get(key) === created) responses.delete(key);
						});
					}
					data = await slot.promise;
					if (!current()) return;
				}
				index.add(data.tree, task.prefix);
				if (task.recursive && data.truncated) queue.push({
					...task,
					recursive: false
				});
				else if (!task.recursive) {
					if (data.truncated) terminalIncomplete = true;
					for (const entry of data.tree) if (entry.type === "tree") queue.push({
						sha: entry.sha,
						prefix: task.prefix ? task.prefix + "/" + entry.path : entry.path,
						recursive: true
					});
				}
				if (!stopped) state = "partial";
				emit();
				schedule();
				if (publish && current()) try {
					await writeTreeBlock(context, scope, task.sha, task.recursive, data);
				} catch (error) {
					if (current()) storageFailure(error);
				}
			} catch (error) {
				if (!current()) return;
				if (isAbortError(error)) {
					halt(msg("Authorization changed; private index cleared."));
					return;
				}
				responses.delete(keyOf(task));
				const failure = error instanceof ApiError ? error : new ApiError("network", msg("Directory request failed."));
				const retry = failure.kind === "rate" || failure.kind === "network";
				if (context.visibility !== "public" && !retry) {
					halt(failure.detail);
					return;
				}
				missing.unshift(task);
				pause(failure.detail, failure.kind === "rate" ? "paused" : "failed", retry, failure.resumeAt || void 0);
			} finally {
				active--;
				const remaining = (activeKeys.get(runKey) || 1) - 1;
				if (remaining > 0) activeKeys.set(runKey, remaining);
				else activeKeys.delete(runKey);
				releaseResponse(runKey);
				if (current()) {
					emit();
					schedule();
				}
			}
		}
		signal.addEventListener("abort", () => {
			clearTimeout(timer);
			queue.length = 0;
			missing.length = 0;
			responses.clear();
		}, { once: true });
		queueMicrotask(() => {
			if (current()) {
				emit();
				schedule();
			}
		});
		return {
			resume() {
				if (!current() || !stopped || !canResume || resumeAt && Date.now() < resumeAt) return;
				if (client.quota.blockedUntil && client.quota.blockedUntil > Date.now()) return;
				if (client.quota.remaining !== null && client.quota.remaining <= 5 && (!client.quota.resumeAt || Date.now() < client.quota.resumeAt)) return;
				stopped = false;
				state = "partial";
				reason = void 0;
				canResume = false;
				resumeAt = void 0;
				batchRequests = 0;
				queue.push(...missing.splice(0));
				schedule();
			},
			prioritize(paths) {
				visible = new Set(paths);
			}
		};
	}
	function filterTree(index, query) {
		const needle = query.trim().toLowerCase();
		const included = new Set();
		const autoExpanded = new Set();
		const stack = (index.children.get("") || []).map((path) => ({
			path,
			inherited: false
		}));
		while (stack.length) {
			const { path, inherited } = stack.pop();
			const entry = index.entries.get(path);
			const hit = !needle || path.toLowerCase().includes(needle);
			if (hit || inherited) included.add(path);
			if (hit && !inherited) for (const parent of ancestors(path)) {
				included.add(parent);
				autoExpanded.add(parent);
			}
			if (entry.type === "tree") for (const child of index.children.get(path) || []) stack.push({
				path: child,
				inherited: inherited || hit
			});
		}
		return {
			included,
			autoExpanded
		};
	}
	function visiblePaths(index, included, expanded) {
		const result = [];
		const stack = [...index.children.get("") || []].reverse();
		while (stack.length) {
			const path = stack.pop();
			if (included && !included.has(path)) continue;
			result.push(path);
			if (expanded.has(path)) {
				const children = index.children.get(path) || [];
				for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
			}
		}
		return result;
	}
	var style_default = ":host{--bg:var(--bgColor-default,var(--color-canvas-default,#fff));--input:var(--bgColor-default,var(--color-canvas-default,#fff));--fg:var(--fgColor-default,var(--color-fg-default,#1f2328));--muted:var(--fgColor-muted,var(--color-fg-muted,#59636e));--border:var(--borderColor-default,var(--color-border-default,#d1d9e0));--accent:var(--fgColor-accent,var(--color-accent-fg,#0969da));--hover:var(--control-transparent-bgColor-hover,var(--color-neutral-muted,#818b981a));--selection:var(--control-transparent-bgColor-selected,var(--bgColor-neutral-muted,#818b9826));--folder:var(--treeViewItem-leadingVisual-iconColor-rest,var(--color-accent-fg,#54aeff));--guide:var(--borderColor-muted,var(--color-border-muted,#d1d9e0b3));--checked:var(--control-checked-bgColor-rest,var(--color-accent-emphasis,#0969da));--on-accent:var(--control-checked-fgColor-rest,var(--color-fg-on-emphasis,#fff));--button-bg:var(--button-default-bgColor-rest,var(--control-bgColor-rest,#f6f8fa));--button-hover:var(--button-default-bgColor-hover,var(--control-bgColor-hover,#eff2f5));--mono:\"SFMono-Regular\",Consolas,\"Liberation Mono\",monospace;color:var(--fg);--lightningcss-light:initial;--lightningcss-dark: ;color-scheme:light;font:13px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif}:host([data-theme=dark]){--bg:var(--bgColor-default,var(--color-canvas-default,#0d1117));--input:var(--bgColor-default,var(--color-canvas-default,#0d1117));--fg:var(--fgColor-default,var(--color-fg-default,#f0f6fc));--muted:var(--fgColor-muted,var(--color-fg-muted,#9198a1));--border:var(--borderColor-default,var(--color-border-default,#3d444d));--accent:var(--fgColor-accent,var(--color-accent-fg,#4493f8));--hover:var(--control-transparent-bgColor-hover,var(--color-neutral-muted,#656c7633));--selection:var(--control-transparent-bgColor-selected,var(--bgColor-neutral-muted,#656c7633));--folder:var(--treeViewItem-leadingVisual-iconColor-rest,var(--color-accent-fg,#54aeff));--guide:var(--borderColor-muted,var(--color-border-muted,#3d444db3));--checked:var(--control-checked-bgColor-rest,var(--color-accent-emphasis,#1f6feb));--button-bg:var(--button-default-bgColor-rest,var(--control-bgColor-rest,#212830));--button-hover:var(--button-default-bgColor-hover,var(--control-bgColor-hover,#262c36));--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark}*{box-sizing:border-box}[hidden]{display:none!important}button,input,select{font:inherit;color:inherit}button{cursor:pointer;background:0 0;border:0}button:disabled{cursor:not-allowed;opacity:.5}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,.resize:focus-visible,.viewport:focus-visible{outline:1px solid var(--accent);outline-offset:-1px}svg{pointer-events:none;flex-shrink:0;width:16px;height:16px}button:hover{background:var(--hover)}.shell{background:var(--bg);border-right:1px solid var(--border);width:100%;height:100%;display:flex}.panel{flex-direction:column;flex:1;min-width:0;height:100%;display:flex}.header{flex-shrink:0}.repository-row,.ref-row{border-bottom:1px solid var(--border);align-items:center;gap:4px;min-height:30px;padding:2px 6px;display:flex}.icon-button{width:24px;height:24px;color:var(--muted);border-radius:var(--borderRadius-medium,6px);flex-shrink:0;place-items:center;padding:0;display:grid}.icon-button[aria-pressed=true],.search-toggle[aria-expanded=true]{background:var(--selection);color:var(--fg)}.repository-bar{flex:1;align-items:center;gap:4px;min-width:0;font-size:12px;display:flex}.repository-bar a{color:var(--accent);text-decoration:none}.repository-bar a:hover{text-decoration:underline}.owner,.repository{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.owner{max-width:40%}.repository{flex:1;font-weight:600}.repository-separator{color:var(--muted)}.ref-icon{width:14px;height:14px;color:var(--muted)}.ref-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:11px var(--mono);color:var(--muted);flex:1;overflow:hidden}.search-bar{border:1px solid var(--border);border-radius:var(--borderRadius-medium,6px);background:var(--input);flex-shrink:0;align-items:center;gap:4px;margin:0 6px 6px;padding:0 4px 0 8px;display:flex}.search-bar:focus-within{border-color:var(--accent)}.search-bar input{background:0 0;border:0;outline:none;flex:1;min-width:0;padding:5px 0;font-size:12px}.search-bar input::-webkit-search-cancel-button{display:none}.search-bar input:placeholder-shown+.clear{display:none}.footer{border-top:1px solid var(--border);flex-shrink:0;align-items:center;display:flex}.footer .icon-button{margin:0 6px}.footer-info{flex:1;align-items:center;gap:8px;min-width:0;padding:5px 8px;display:flex}.brand{flex-shrink:0;font-size:11px;font-weight:600;line-height:16px}.status{min-width:0;color:var(--muted);white-space:nowrap;text-overflow:ellipsis;flex:1;font-size:10px;line-height:16px;overflow:hidden}.resume,.message-token{border:1px solid var(--border);border-radius:var(--borderRadius-medium,6px);background:var(--button-bg);padding:5px 8px;font-size:12px}.resume{color:var(--accent)}.tree-area{flex-direction:column;flex:1;min-height:0;display:flex}.tree-message{border-bottom:1px solid var(--border);overflow-wrap:anywhere;flex-direction:column;flex:0 auto;gap:8px;max-height:100%;padding:12px;font-size:12px;line-height:1.5;display:flex;overflow:auto}.tree-area.has-paths .tree-message{max-height:50%}.tree-message-title{font-weight:600}.tree-message p{color:var(--muted);margin:0}.tree-message-actions{flex-wrap:wrap;gap:6px;display:flex}.viewport{overscroll-behavior:contain;scrollbar-width:thin;flex:1;min-height:0;position:relative;overflow:auto}.tree-loading{color:var(--muted);text-align:center;flex-direction:column;justify-content:center;align-items:center;gap:8px;padding:16px;font-size:12px;display:flex;position:absolute;inset:0}.tree-loading svg{width:20px;height:20px;color:var(--accent);animation:1s linear infinite ogt-spin}@keyframes ogt-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.tree-loading svg{animation:none}}.canvas{min-width:100%;position:relative}.tree-row{border-radius:var(--borderRadius-medium,6px);width:100%;height:24px;font:12px var(--mono);color:var(--fg);text-align:left;background:0 0;border:0;align-items:center;gap:4px;padding-right:8px;text-decoration:none;display:flex;position:absolute;left:0}.tree-row:hover{background:var(--hover);text-decoration:none}.tree-row.current{background:var(--selection);color:var(--fg)}.indent-guides{background:repeating-linear-gradient(to right,var(--guide) 0 1px,transparent 1px 12px);pointer-events:none;position:absolute;top:0;bottom:0;left:14px}.expander{flex-shrink:0;place-items:center;width:12px;display:grid}.expander svg{width:12px;height:12px}.file-icon{width:14px;height:14px;color:var(--muted)}.folder-icon{color:var(--folder)}.file-name{white-space:nowrap;text-overflow:ellipsis;position:relative;overflow:hidden}.tree-row[aria-expanded] .file-name{font-weight:500}.no-results{color:var(--muted);flex:1;padding:16px 10px;font-size:12px}.settings{flex:1;min-height:0;padding:0 10px 16px;font-size:12px;overflow:auto}.settings h2{margin:22px 0 10px;font-size:12px;font-weight:600}.option{border-bottom:1px solid var(--border);justify-content:space-between;align-items:center;gap:8px;margin:16px 0;padding-bottom:16px;display:flex}.shortcut-help{color:var(--muted);margin-top:4px;font-size:11px;line-height:1.5;display:block}.option input{appearance:none;border:1px solid var(--muted);background:var(--input);cursor:pointer;border-radius:9px;flex-shrink:0;width:28px;height:16px;margin:0;position:relative}.option input:before{content:\"\";background:var(--muted);border-radius:50%;width:10px;height:10px;position:absolute;top:2px;left:2px}.option input:checked{background:var(--checked);border-color:var(--checked)}.option input:checked:before{background:var(--on-accent);transform:translate(12px)}.language-option{gap:7px;margin:8px 0 16px;display:grid}.language-option select{border:1px solid var(--border);border-radius:var(--borderRadius-medium,6px);background:var(--input);width:100%;min-width:0;padding:5px 7px}.settings button{border:1px solid var(--border);border-radius:var(--borderRadius-medium,6px);background:var(--button-bg);margin:6px 0;padding:6px 8px}.settings button:hover{background:var(--button-hover)}.identity{color:var(--muted);overflow-wrap:anywhere;margin:8px 0}.connection-status{overflow-wrap:anywhere;color:var(--muted)}.connection-status:empty{display:none}.rail{writing-mode:vertical-rl;width:24px;height:100%;color:var(--muted);text-align:start;padding:12px 4px;font-size:11px;display:none}.collapsed .panel,.collapsed .resize{display:none}.collapsed .rail{display:block}.resize{cursor:col-resize;touch-action:none;width:6px;position:absolute;top:0;bottom:0;right:-3px}.resize:hover,.resize:focus-visible{background:var(--accent);opacity:.5}";
	var rowHeight = 24;
	var emptySnapshot = () => ({
		expanded: [],
		scrollTop: 0,
		anchorPath: null,
		anchorOffset: 0
	});
	function element(tag, className = "", text) {
		const node = document.createElement(tag);
		node.className = className;
		if (text !== void 0) node.textContent = text;
		return node;
	}
	function button(text, label, className = "") {
		const node = element("button", className, text);
		node.type = "button";
		node.setAttribute("aria-label", label);
		node.title = label;
		return node;
	}
	function subscribe(listeners, listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}
	function mountSidebar(initialSettings) {
		let settings = { ...initialSettings };
		const translations = createTranslations();
		function text(tag, className, key) {
			return translations.bind(element(tag, className), msg(key));
		}
		function action(text, label, className = "") {
			const node = button("", "", className);
			if (text) translations.bind(node, msg(text));
			translations.bind(node, msg(label), "aria-label");
			translations.bind(node, msg(label), "title");
			return node;
		}
		function iconButton(icon, label, className = "icon-button") {
			const node = action(null, label, className);
			node.append(svgIcon(icon));
			return node;
		}
		const host = element("aside");
		host.id = "opsgittrees";
		translations.bind(host, msg("OpsGitTrees repository navigation"), "aria-label");
		host.lang = getLanguage();
		host.style.cssText = "position:fixed;left:0;top:0;bottom:0;z-index:100;";
		const shadow = host.attachShadow({ mode: "open" });
		const style = element("style");
		style.textContent = style_default;
		const shell = element("div", "shell");
		const panel = element("div", "panel");
		const header = element("header", "header");
		const collapse = iconButton("back", "Collapse file navigation");
		const owner = element("a", "owner");
		owner.hidden = true;
		const separator = element("span", "repository-separator", "/");
		separator.hidden = true;
		const repository = element("a", "repository", t("Repository"));
		const refLabel = element("div", "ref-label");
		const repositoryBar = element("div", "repository-bar");
		repositoryBar.append(owner, separator, repository);
		const searchBar = element("div", "search-bar");
		searchBar.id = "ogt-search";
		searchBar.hidden = true;
		const search = element("input");
		search.type = "search";
		translations.bind(search, msg("Find a file or path…"), "placeholder");
		translations.bind(search, msg("Find a file or path"), "aria-label");
		search.autocomplete = "off";
		search.spellcheck = false;
		const clear = iconButton("close", "Clear search", "clear icon-button");
		const locate = iconButton("locate", "Locate current file");
		searchBar.append(search, clear);
		const openSearch = iconButton("search", "Find a file or path", "icon-button search-toggle");
		openSearch.setAttribute("aria-controls", searchBar.id);
		openSearch.setAttribute("aria-expanded", "false");
		const settingsIcon = svgIcon("settings"), closeSettingsIcon = svgIcon("close");
		const openSettings = button("", "", "icon-button settings-toggle");
		openSettings.append(settingsIcon);
		const repositoryRow = element("div", "repository-row");
		repositoryRow.append(repositoryBar, openSettings);
		const refRow = element("div", "ref-row");
		refRow.append(svgIcon("branch", "ref-icon"), refLabel, openSearch, locate);
		header.append(repositoryRow, refRow);
		const status = element("div", "status");
		status.setAttribute("role", "status");
		status.setAttribute("aria-live", "polite");
		const footerInfo = element("div", "footer-info");
		footerInfo.append(element("div", "brand", "OpsGitTrees"), status);
		const footer = element("footer", "footer");
		footer.append(footerInfo, collapse);
		const resume = action("Continue loading", "Continue directory loading", "resume");
		resume.hidden = true;
		const viewport = element("div", "viewport");
		viewport.setAttribute("role", "tree");
		translations.bind(viewport, msg("Repository files"), "aria-label");
		viewport.tabIndex = 0;
		const canvas = element("div", "canvas");
		const loading = element("div", "tree-loading");
		loading.setAttribute("aria-hidden", "true");
		loading.append(svgIcon("loading"), text("span", "", "Loading repository index…"));
		viewport.append(canvas, loading);
		const noResults = element("div", "no-results");
		const treeArea = element("div", "tree-area");
		const treeMessage = element("section", "tree-message");
		treeMessage.hidden = true;
		treeMessage.setAttribute("role", "region");
		translations.bind(treeMessage, msg("Directory loading status"), "aria-label");
		const messageTitle = element("strong", "tree-message-title"), messageReason = element("p", "tree-message-reason");
		const retryTime = element("p", "tree-retry-time");
		const authHint = text("p", "tree-auth-hint", "No Token configured: requests use the anonymous API quota. GitHub sign-in does not authorize the script. Wait or configure a read-only Token.");
		const messageToken = action("Manage Token…", "Configure a read-only Token", "message-token");
		const messageActions = element("div", "tree-message-actions");
		messageActions.append(resume, messageToken);
		treeMessage.append(messageTitle, messageReason, retryTime, authHint, messageActions);
		treeArea.append(treeMessage, viewport, noResults);
		const settingsPanel = element("section", "settings");
		settingsPanel.hidden = true;
		const languageLabel = element("label", "language-option");
		languageLabel.append(text("span", "", "Language"));
		const language = element("select");
		translations.bind(language, msg("Interface language"), "aria-label");
		for (const [value, label] of [
			["auto", ""],
			["zh-CN", "简体中文"],
			["en", "English"]
		]) {
			const option = element("option", "", label);
			option.value = value;
			if (value === "auto") translations.bind(option, msg("Follow browser"));
			language.append(option);
		}
		language.value = settings.language;
		languageLabel.append(language);
		settingsPanel.append(languageLabel);
		const shortcutsLabel = element("label", "option"), shortcuts = element("input");
		shortcuts.type = "checkbox";
		shortcuts.checked = settings.shortcutsEnabled;
		translations.bind(shortcuts, msg("Keyboard shortcuts"), "aria-label");
		translations.bind(shortcuts, msg("Enable Alt+Shift+O / Alt+Shift+F"), "title");
		shortcuts.setAttribute("role", "switch");
		const shortcutHelp = text("span", "shortcut-help", "Alt+Shift+O: expand or collapse the sidebar. Alt+Shift+F: find a file or path.");
		shortcutHelp.id = "ogt-shortcut-help";
		shortcuts.setAttribute("aria-describedby", shortcutHelp.id);
		const shortcutText = element("span");
		shortcutText.append(text("span", "", "Keyboard shortcuts"), shortcutHelp);
		shortcutsLabel.append(shortcutText, shortcuts);
		settingsPanel.append(shortcutsLabel);
		const authHeading = text("h2", "", "GitHub API authentication");
		const identity = element("p", "identity");
		const manageToken = action("Manage Token…", "Open Token configuration dialog");
		const connectionStatus = element("p", "connection-status");
		connectionStatus.setAttribute("role", "status");
		settingsPanel.append(authHeading, identity, manageToken, connectionStatus);
		panel.append(header, searchBar, treeArea, settingsPanel, footer);
		const rail = action("FILES ›", "Open file navigation", "rail");
		const resize = element("div", "resize");
		resize.tabIndex = 0;
		resize.setAttribute("role", "separator");
		translations.bind(resize, msg("Resize file navigation"), "aria-label");
		resize.setAttribute("aria-orientation", "vertical");
		resize.setAttribute("aria-valuemin", "200");
		resize.setAttribute("aria-valuemax", "480");
		shell.append(panel, rail, resize);
		shadow.append(style, shell);
		document.body.append(host);
		let space = reservePageSpace(settings.collapsed ? 24 : settings.width);
		const stopTheme = observeTheme((dark) => host.setAttribute("data-theme", dark ? "dark" : "light"));
		const viewListeners = new Set();
		const settingsListeners = new Set();
		const resumeListeners = new Set();
		const manageListeners = new Set();
		const visibleListeners = new Set();
		let view = {
			browsing: emptySnapshot(),
			search: null
		};
		let searchOpen = false;
		let index = {
			entries: new Map(),
			children: new Map(),
			state: "loading",
			pending: 0
		};
		let context = null, contextKey = "", currentPath = "";
		let contextMessage = "", connectionMessage = "";
		let auth = {
			id: "anonymous",
			login: null,
			authenticated: false
		};
		function renderAuth() {
			identity.textContent = auth.authenticated ? t("Token saved · @{login}", { login: auth.login || "" }) : t("No Token configured.");
		}
		function renderStatus() {
			const state = index.state === "complete" ? t("Complete") : t("Index incomplete — {state}", { state: msg(index.state) });
			status.textContent = contextMessage && index.state === "loading" ? renderText(contextMessage) : index.state === "empty" ? t("This repository is empty.") : index.state === "loading" ? t("Loading repository index…") : t("{count} paths · {state}", {
				count: index.entries.size,
				state
			}) + (index.pending ? " · " + t("{count} pending", { count: index.pending }) : "") + (index.reason ? "\n" + renderText(index.reason) : "");
			status.title = status.textContent || "";
			const isLoading = index.state === "loading" && index.entries.size === 0;
			loading.hidden = !isLoading;
			canvas.hidden = isLoading;
			viewport.setAttribute("aria-busy", String(isLoading));
			treeArea.classList.toggle("has-paths", index.entries.size > 0);
			treeMessage.hidden = !(index.state === "paused" || index.state === "failed" || index.state === "partial" && index.reason);
			if (!treeMessage.hidden) {
				messageTitle.textContent = t(index.state === "paused" ? "Directory loading paused" : index.state === "failed" ? "Directory loading failed" : "Directory index incomplete");
				messageReason.textContent = index.reason ? renderText(index.reason) : messageTitle.textContent;
				const timedReason = typeof index.reason === "object" && index.reason.values?.time instanceof Date;
				retryTime.hidden = !index.resumeAt || timedReason;
				retryTime.textContent = index.resumeAt ? t("Try again after {time}.", { time: new Date(index.resumeAt).toLocaleString(getLanguage()) }) : "";
				const anonymousLimit = index.state === "paused" && !auth.authenticated;
				authHint.hidden = !anonymousLimit;
				messageToken.hidden = !anonymousLimit;
			}
		}
		let filtered = null;
		let paths = [], expanded = new Set();
		let positionEstablished = false;
		let scrollFrame = 0, lastStart = -1, lastEnd = -1;
		let searchTimer, resumeTimer;
		const snapshot = () => view.search?.view || view.browsing;
		function capture() {
			if (!host.isConnected || settings.collapsed || viewport.hidden || !settingsPanel.hidden) return;
			const current = snapshot();
			if (current.anchorPath && !index.entries.has(current.anchorPath) && index.state !== "complete") return;
			const row = Math.floor(viewport.scrollTop / rowHeight);
			current.scrollTop = viewport.scrollTop;
			current.anchorPath = paths[row] || null;
			current.anchorOffset = viewport.scrollTop % rowHeight;
		}
		function changed() {
			for (const listener of viewListeners) listener(view);
		}
		function renderSettingsToggle() {
			const open = !settingsPanel.hidden, label = t(open ? "Close navigation settings" : "Open navigation settings");
			openSettings.setAttribute("aria-label", label);
			openSettings.title = label;
			openSettings.setAttribute("aria-pressed", String(open));
			openSettings.replaceChildren(open ? closeSettingsIcon : settingsIcon);
		}
		function renderSearch() {
			searchBar.hidden = !settingsPanel.hidden || !searchOpen;
			openSearch.setAttribute("aria-expanded", String(!searchBar.hidden));
		}
		function setSearchOpen(open) {
			if (searchOpen === open) return;
			capture();
			searchOpen = open;
			renderSearch();
			restorePosition();
			renderWindow(true);
		}
		function focusSearch() {
			setCollapsed(false);
			showSettings(false);
			setSearchOpen(true);
			search.focus();
		}
		function updateLayout() {
			host.style.width = (settings.collapsed ? 24 : settings.width) + "px";
			shell.classList.toggle("collapsed", settings.collapsed);
			resize.setAttribute("aria-valuenow", String(settings.width));
			space.setWidth(settings.collapsed ? 24 : settings.width);
			if (!settings.collapsed) {
				restorePosition();
				renderWindow(true);
			}
		}
		function settingsChanged() {
			for (const listener of settingsListeners) listener({ ...settings });
		}
		function setCollapsed(collapsed) {
			if (settings.collapsed === collapsed) return;
			if (collapsed) capture();
			settings.collapsed = collapsed;
			updateLayout();
			settingsChanged();
		}
		function renderWindow(force = false) {
			if (settings.collapsed) return;
			const start = Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - 8);
			const end = Math.min(paths.length, Math.ceil((viewport.scrollTop + (viewport.clientHeight || 480)) / rowHeight) + 8);
			if (!force && start === lastStart && end === lastEnd) return;
			lastStart = start;
			lastEnd = end;
			const focused = shadow.activeElement?.dataset.path;
			const fragment = document.createDocumentFragment();
			for (let i = start; i < end; i++) {
				const path = paths[i], entry = index.entries.get(path);
				const row = entry.type === "tree" ? button("", entry.name) : element("a");
				row.className = "tree-row" + (path === currentPath ? " current" : "");
				row.dataset.path = path;
				const depth = path.split("/").length;
				row.style.top = i * rowHeight + "px";
				row.style.paddingLeft = 8 + (depth - 1) * 12 + "px";
				row.setAttribute("role", "treeitem");
				row.setAttribute("aria-level", String(depth));
				row.setAttribute("aria-selected", String(path === currentPath));
				row.title = path;
				const guides = element("span", "indent-guides");
				guides.setAttribute("aria-hidden", "true");
				guides.style.width = (depth - 1) * 12 + "px";
				row.append(guides);
				const expander = element("span", "expander");
				if (entry.type === "tree") expander.append(svgIcon(expanded.has(path) ? "down" : "right"));
				const icon = svgIcon(entry.type === "tree" ? "folder" : entry.type === "commit" || entry.mode === "120000" ? "link" : "file", "file-icon" + (entry.type === "tree" ? " folder-icon" : ""));
				const name = element("span", "file-name", entry.name);
				row.append(expander, icon, name);
				if (entry.type === "tree") {
					row.setAttribute("aria-expanded", String(expanded.has(path)));
					row.addEventListener("click", () => toggle(path));
				} else {
					row.href = context ? entry.type === "commit" ? parentDirectoryUrl(context, path) : fileUrl(context, path) : "#";
					if (entry.type === "commit") row.setAttribute("aria-label", t("{name} (submodule; open parent directory on GitHub)", { name: entry.name }));
					row.addEventListener("click", () => {
						capture();
						changed();
					});
				}
				fragment.append(row);
			}
			canvas.replaceChildren(fragment);
			if (focused) [...canvas.querySelectorAll("[data-path]")].find((el) => el.dataset.path === focused)?.focus({ preventScroll: true });
			const visible = paths.slice(start, end);
			for (const listener of visibleListeners) listener(visible);
		}
		function restorePosition() {
			const state = snapshot();
			const anchor = state.anchorPath ? paths.indexOf(state.anchorPath) : -1;
			viewport.scrollTop = anchor >= 0 ? anchor * rowHeight + state.anchorOffset : state.scrollTop;
		}
		function rebuild(recompute = false) {
			if (recompute) filtered = view.search ? filterTree(index, view.search.query) : null;
			expanded = new Set(view.browsing.expanded);
			if (view.search) {
				for (const path of filtered?.autoExpanded || []) expanded.add(path);
				for (const path of view.search.view.expanded) expanded.add(path);
				for (const path of view.search.collapsed) expanded.delete(path);
			}
			paths = visiblePaths(index, filtered?.included || null, expanded);
			canvas.style.height = paths.length * rowHeight + "px";
			noResults.textContent = paths.length ? "" : view.search ? index.state === "complete" ? t("No matching paths.") : t("No loaded paths match. The index is incomplete.") : index.state === "complete" ? t("No files in this version.") : "";
			noResults.hidden = !noResults.textContent || !settingsPanel.hidden;
			restorePosition();
			renderWindow(true);
		}
		function toggle(path) {
			capture();
			if (view.search) {
				const manual = new Set(view.search.view.expanded), closed = new Set(view.search.collapsed);
				if (expanded.has(path)) {
					manual.delete(path);
					closed.add(path);
				} else {
					manual.add(path);
					closed.delete(path);
				}
				view.search.view.expanded = [...manual];
				view.search.collapsed = [...closed];
			} else {
				const open = new Set(view.browsing.expanded);
				if (open.has(path)) open.delete(path);
				else open.add(path);
				view.browsing.expanded = [...open];
			}
			rebuild();
			changed();
		}
		function queryChanged() {
			capture();
			const query = search.value.trim();
			if (!query) view.search = null;
			else if (view.search) view.search.query = query;
			else view.search = {
				query,
				view: emptySnapshot(),
				collapsed: []
			};
			if (query) searchOpen = true;
			renderSearch();
			rebuild(true);
			changed();
		}
		function positionCurrent(reveal) {
			if (reveal) {
				setCollapsed(false);
				showSettings(false);
			}
			capture();
			clearTimeout(searchTimer);
			view.search = null;
			search.value = "";
			if (reveal) searchOpen = false;
			renderSearch();
			view.browsing.expanded = [...new Set([...view.browsing.expanded, ...ancestors(currentPath)])];
			rebuild(true);
			const i = paths.indexOf(currentPath);
			if (i >= 0) {
				const top = Math.max(0, i * rowHeight - (viewport.clientHeight || 480) / 3);
				view.browsing.scrollTop = top;
				view.browsing.anchorPath = paths[Math.floor(top / rowHeight)] || null;
				view.browsing.anchorOffset = top % rowHeight;
				restorePosition();
			}
			renderWindow(true);
			positionEstablished = true;
			changed();
		}
		function locateCurrent() {
			positionCurrent(true);
		}
		function setIndex(next) {
			index = next;
			if (next.state === "complete") {
				const keep = (values) => values.filter((p) => index.entries.has(p));
				view.browsing.expanded = keep(view.browsing.expanded);
				if (view.search) {
					view.search.view.expanded = keep(view.search.view.expanded);
					view.search.collapsed = keep(view.search.collapsed);
				}
			}
			renderStatus();
			clearTimeout(resumeTimer);
			resume.hidden = !next.canResume;
			resume.disabled = !!next.resumeAt && next.resumeAt > Date.now();
			if (resume.disabled && next.resumeAt) resumeTimer = setTimeout(() => {
				resume.disabled = false;
			}, Math.min(2147483647, Math.max(0, next.resumeAt - Date.now())));
			rebuild(true);
			if (!positionEstablished && !view.search && currentPath && index.entries.has(currentPath)) positionCurrent(false);
		}
		search.addEventListener("input", () => {
			clearTimeout(searchTimer);
			searchTimer = setTimeout(queryChanged, 80);
		});
		clear.addEventListener("click", () => {
			clearTimeout(searchTimer);
			search.value = "";
			queryChanged();
			search.focus();
		});
		search.addEventListener("keydown", (event) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			event.stopPropagation();
			clearTimeout(searchTimer);
			if (search.value || view.search) {
				search.value = "";
				queryChanged();
			} else {
				setSearchOpen(false);
				openSearch.focus();
			}
		});
		openSearch.addEventListener("click", () => {
			if (settingsPanel.hidden && searchOpen && !search.value.trim()) {
				clearTimeout(searchTimer);
				search.value = "";
				if (view.search) queryChanged();
				setSearchOpen(false);
				openSearch.focus();
			} else focusSearch();
		});
		locate.addEventListener("click", locateCurrent);
		collapse.addEventListener("click", () => setCollapsed(true));
		rail.addEventListener("click", () => setCollapsed(false));
		function showSettings(open) {
			if (open) capture();
			settingsPanel.hidden = !open;
			treeArea.hidden = open;
			viewport.hidden = open;
			noResults.hidden = open || !noResults.textContent;
			renderSettingsToggle();
			renderSearch();
			if (!open) {
				restorePosition();
				renderWindow(true);
			}
		}
		openSettings.addEventListener("click", () => showSettings(settingsPanel.hidden !== false));
		shortcuts.addEventListener("change", () => {
			settings.shortcutsEnabled = shortcuts.checked;
			settingsChanged();
		});
		language.addEventListener("change", () => {
			settings.language = language.value;
			settingsChanged();
		});
		resume.addEventListener("click", () => {
			for (const listener of resumeListeners) listener();
		});
		const openToken = () => {
			for (const listener of manageListeners) listener();
		};
		manageToken.addEventListener("click", openToken);
		messageToken.addEventListener("click", openToken);
		viewport.addEventListener("scroll", () => {
			if (!scrollFrame) scrollFrame = requestAnimationFrame(() => {
				scrollFrame = 0;
				capture();
				renderWindow();
				changed();
			});
		}, { passive: true });
		const resizeObserver = new ResizeObserver(() => renderWindow(true));
		resizeObserver.observe(viewport);
		let dragging = false;
		const setWidth = (width) => {
			settings.width = Math.round(Math.max(200, Math.min(480, width)));
			updateLayout();
			settingsChanged();
		};
		resize.addEventListener("pointerdown", (event) => {
			if (event.button !== 0) return;
			dragging = true;
			resize.setPointerCapture(event.pointerId);
			event.preventDefault();
		});
		resize.addEventListener("pointermove", (event) => {
			if (dragging) setWidth(event.clientX);
		});
		resize.addEventListener("pointerup", () => {
			dragging = false;
		});
		resize.addEventListener("lostpointercapture", () => {
			dragging = false;
		});
		resize.addEventListener("keydown", (event) => {
			if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
				setWidth(settings.width + (event.key === "ArrowLeft" ? -20 : 20));
				event.preventDefault();
			}
		});
		const stopLanguage = observeLanguage(() => {
			translations.refresh();
			host.lang = getLanguage();
			if (!repository.hasAttribute("href")) {
				repository.textContent = t("Repository");
				repositoryBar.title = t("Repository");
			}
			renderSettingsToggle();
			renderStatus();
			renderAuth();
			connectionStatus.textContent = renderText(connectionMessage);
			rebuild();
		});
		renderSettingsToggle();
		renderAuth();
		renderStatus();
		updateLayout();
		return {
			reconnect() {
				if (host.isConnected) return;
				space.destroy();
				document.body.append(host);
				space = reservePageSpace(settings.collapsed ? 24 : settings.width);
				restorePosition();
				renderWindow(true);
			},
			setContext(state) {
				contextMessage = state.kind === "unresolved" ? state.message : "";
				if (state.kind === "code") {
					const key = state.context.owner + "/" + state.context.repo + ":" + state.context.refKind + ":" + state.context.refName;
					if (key !== contextKey) {
						clearTimeout(searchTimer);
						contextKey = key;
						view = {
							browsing: emptySnapshot(),
							search: null
						};
						search.value = "";
						searchOpen = false;
						renderSearch();
						filtered = null;
						positionEstablished = false;
					}
					context = state.context;
					currentPath = context.path;
				} else context = null;
				const repo = state.kind === "code" ? state.context : state.kind === "empty" ? state : null;
				owner.hidden = separator.hidden = !repo;
				owner.textContent = repo?.owner || "";
				repository.textContent = repo?.repo || t("Repository");
				if (repo) {
					const ownerPath = "/" + encodeURIComponent(repo.owner);
					owner.href = ownerPath;
					repository.href = ownerPath + "/" + encodeURIComponent(repo.repo);
				} else {
					owner.removeAttribute("href");
					repository.removeAttribute("href");
				}
				repositoryBar.title = repo ? repo.owner + " / " + repo.repo : t("Repository");
				refLabel.textContent = state.kind === "code" ? state.context.refName : "";
				refLabel.title = refLabel.textContent;
				renderStatus();
			},
			setSettings(next) {
				const layoutChanged = settings.collapsed !== next.collapsed || settings.width !== next.width;
				if (next.collapsed && !settings.collapsed) capture();
				settings = { ...next };
				shortcuts.checked = settings.shortcutsEnabled;
				language.value = settings.language;
				if (layoutChanged) updateLayout();
			},
			setCollapsed,
			setIndex,
			setCurrentPath(path) {
				currentPath = path;
				if (!view.search) {
					view.browsing.expanded = [...new Set([...view.browsing.expanded, ...ancestors(path)])];
					rebuild();
				} else renderWindow(true);
			},
			focusSearch,
			locateCurrent,
			getView() {
				capture();
				return structuredClone(view);
			},
			restoreView(state) {
				view = structuredClone(state);
				search.value = view.search?.query || "";
				searchOpen = !!view.search;
				renderSearch();
				positionEstablished = true;
				rebuild(true);
			},
			onViewChange: (listener) => subscribe(viewListeners, listener),
			onSettingsChange: (listener) => subscribe(settingsListeners, listener),
			onResumePreload: (listener) => subscribe(resumeListeners, listener),
			onManageToken: (listener) => subscribe(manageListeners, listener),
			onVisiblePaths: (listener) => subscribe(visibleListeners, listener),
			setAuth(scope) {
				auth = scope;
				renderAuth();
				renderStatus();
			},
			setConnectionStatus(message) {
				connectionMessage = message;
				connectionStatus.textContent = renderText(message);
			},
			destroy() {
				clearTimeout(searchTimer);
				clearTimeout(resumeTimer);
				cancelAnimationFrame(scrollFrame);
				resizeObserver.disconnect();
				stopTheme();
				stopLanguage();
				space.destroy();
				host.remove();
				viewListeners.clear();
				settingsListeners.clear();
				resumeListeners.clear();
				manageListeners.clear();
				visibleListeners.clear();
			}
		};
	}
	var safeMessage = (error) => error instanceof ApiError || error instanceof StorageLimitError ? error.detail : msg("The operation failed. Check the network and userscript manager storage permissions.");
	async function startApplication() {
		let settings = await readSettings();
		setLanguage(settings.language);
		let auth = await readAuthScope();
		let sidebar = null, active = null;
		let generation = 0, lastUrl = "", verifiedUrl = "", stopped = false;
		let resolving = new AbortController();
		let saveTimer, settingsTimer;
		let pendingSettings = {};
		let writingSettings = false;
		let authenticatedClient = null;
		const anonymousClient = createGitHubClient(null);
		const memory = new Map();
		const memoryKey = (context, scope) => context.repoId + ":" + context.rootTreeSha + ":" + (context.visibility === "public" ? "public" : scope.id);
		function notice(message) {
			if (sidebar) sidebar.setConnectionStatus(message);
			else _GM.notification({
				title: "OpsGitTrees",
				text: renderText(message),
				timeout: 8e3
			});
		}
		const credentials = createCredentialManager(notice, checkConnection);
		function flushSettings() {
			clearTimeout(settingsTimer);
			if (writingSettings || !Object.keys(pendingSettings).length) return;
			const changes = { ...pendingSettings };
			writingSettings = true;
			writeSettings(changes).catch(() => {
				if (!stopped) notice(msg("Settings could not be saved."));
			}).finally(() => {
				for (const key of Object.keys(changes)) if (pendingSettings[key] === changes[key]) delete pendingSettings[key];
				writingSettings = false;
				flushSettings();
			});
		}
		function applySettings(next) {
			settings = next;
			setLanguage(next.language);
			sidebar?.setSettings(next);
		}
		function flushView() {
			clearTimeout(saveTimer);
			if (!active || !sidebar) return;
			const current = active, view = sidebar.getView();
			writeView(current.context, current.scope, view).catch((error) => {
				if (!isAbortError(error) && active === current) sidebar?.setConnectionStatus(msg("Reading position could not be saved. Check manager storage."));
			});
		}
		function detach(save = true) {
			if (save) flushView();
			else clearTimeout(saveTimer);
			active?.controller.abort();
			active = null;
			sidebar?.destroy();
			sidebar = null;
		}
		function ensureSidebar() {
			if (sidebar) {
				sidebar.reconnect();
				return sidebar;
			}
			const handle = mountSidebar(settings);
			sidebar = handle;
			handle.setAuth(auth);
			handle.onViewChange(() => {
				clearTimeout(saveTimer);
				saveTimer = setTimeout(flushView, 300);
			});
			handle.onSettingsChange((next) => {
				const immediate = settings.shortcutsEnabled !== next.shortcutsEnabled || settings.language !== next.language;
				if (settings.collapsed !== next.collapsed) pendingSettings.collapsed = next.collapsed;
				if (settings.width !== next.width) pendingSettings.width = next.width;
				if (settings.shortcutsEnabled !== next.shortcutsEnabled) pendingSettings.shortcutsEnabled = next.shortcutsEnabled;
				if (settings.language !== next.language) pendingSettings.language = next.language;
				applySettings(next);
				clearTimeout(settingsTimer);
				if (immediate) flushSettings();
				else settingsTimer = setTimeout(flushSettings, 300);
			});
			handle.onResumePreload(() => {
				if (active?.preload) active.preload.resume();
				else navigate(true);
			});
			handle.onVisiblePaths((paths) => active?.preload?.prioritize(paths));
			handle.onManageToken(credentials.open);
			return handle;
		}
		async function authClient(scope) {
			if (authenticatedClient?.id === scope.id) return authenticatedClient.client;
			const client = await getGitHubClient(scope);
			authenticatedClient = {
				id: scope.id,
				client
			};
			return client;
		}
		function live(ticket) {
			return !stopped && ticket === generation;
		}
		async function navigate(force = false) {
			const url = new URL(location.href);
			if (!force && url.href === lastUrl) {
				sidebar?.reconnect();
				return;
			}
			lastUrl = url.href;
			const ticket = ++generation;
			resolving.abort();
			resolving = new AbortController();
			const signal = resolving.signal;
			verifiedUrl = "";
			let page = readPage(document, url);
			if (page.kind === "outside") {
				detach();
				return;
			}
			let handle = ensureSidebar();
			const retainedView = active ? handle.getView() : null;
			if (page.kind === "unresolved") {
				flushView();
				handle.setContext(page);
				handle.setIndex({
					entries: new Map(),
					children: new Map(),
					state: "loading",
					pending: 0
				});
			}
			try {
				if (page.kind === "unresolved") {
					page = await resolvePage(document, url, signal);
					if (!live(ticket)) return;
					if (page.kind === "unresolved" || page.kind === "outside") throw new ApiError("invalid", msg("GitHub page context is not recognized. No branch or commit was guessed."));
				}
				verifiedUrl = url.href;
				if (page.kind === "code" && active && (active.preload || active.index) && active.context.owner === page.context.owner && active.context.repo === page.context.repo && active.context.refKind === page.context.refKind && active.context.refName === page.context.refName && active.context.commitSha === page.context.commitSha && !force) {
					active.context = {
						...active.context,
						...page.context
					};
					handle.setContext(page);
					if (retainedView) handle.restoreView(retainedView);
					if (active.index) handle.setIndex(active.index);
					handle.setCurrentPath(page.context.path);
					return;
				}
				if (retainedView) handle.restoreView(retainedView);
				detach();
				handle = ensureSidebar();
				handle.setContext(page);
				const scope = await readAuthScope();
				if (!live(ticket)) return;
				auth = scope;
				handle.setAuth(scope);
				const pageOwner = page.kind === "code" ? page.context.owner : page.owner;
				const pageRepo = page.kind === "code" ? page.context.repo : page.repo;
				const client = scope.authenticated ? await authClient(scope) : anonymousClient;
				const metadata = await client.getRepository(pageOwner, pageRepo, signal);
				if (!live(ticket)) return;
				if (metadata.visibility !== "public" && !scope.authenticated) throw new ApiError("auth", msg("Configure a fine-grained read-only PAT in Settings → API authentication to read this repository."));
				if (page.kind === "empty") {
					handle.setContext(page);
					handle.setIndex({
						entries: new Map(),
						children: new Map(),
						state: "empty",
						pending: 0
					});
					return;
				}
				const commit = {
					...page.context,
					...metadata
				};
				let rootTreeSha = null;
				let cacheWarning;
				if (metadata.visibility === "public") {
					try {
						rootTreeSha = await readCommitTree(commit, scope);
					} catch (error) {
						if (!live(ticket) || signal.aborted || isAbortError(error)) return;
						cacheWarning = msg("Persistent cache unavailable; index remains usable in memory.");
					}
					if (!live(ticket) || signal.aborted) return;
				}
				const context = rootTreeSha ? {
					...commit,
					rootTreeSha
				} : await client.resolveTree(page.context, metadata, signal);
				if (!live(ticket) || signal.aborted) return;
				if (metadata.visibility !== "public") {
					const checked = await readAuthScope();
					if (!live(ticket) || signal.aborted || checked.id !== scope.id || !checked.authenticated) return;
				}
				if (metadata.visibility === "public" && !rootTreeSha) {
					try {
						await writeCommitTree(context, scope);
					} catch (error) {
						if (!live(ticket) || signal.aborted || isAbortError(error)) return;
						cacheWarning = error instanceof StorageLimitError ? error.detail : msg("Persistent cache unavailable; index remains usable in memory.");
					}
					if (!live(ticket) || signal.aborted) return;
				}
				const controller = new AbortController();
				const current = {
					context,
					scope,
					client,
					controller
				};
				active = current;
				let saved = null;
				try {
					saved = await readView(context, scope);
				} catch (error) {
					if (!live(ticket) || active !== current || isAbortError(error)) return;
					cacheWarning = msg("Persistent cache unavailable; index remains usable in memory.");
				}
				if (!live(ticket) || active !== current) return;
				if (saved) handle.restoreView(saved);
				const display = (view) => view.reason || !cacheWarning ? view : {
					...view,
					reason: cacheWarning
				};
				const key = memoryKey(context, scope);
				const cached = memory.get(key);
				if (context.visibility !== "public" && !isAuthScopeCurrent(scope)) {
					controller.abort();
					return;
				}
				if (!live(ticket) || active !== current) return;
				if (cached) {
					current.index = display(cached);
					memory.delete(key);
					memory.set(key, cached);
					while (memory.size > 2) memory.delete(memory.keys().next().value);
					handle.setIndex(current.index);
					handle.setCurrentPath(context.path);
					return;
				}
				handle.setCurrentPath(context.path);
				current.preload = startPreload(context, scope, client, (view) => {
					if (controller.signal.aborted || active !== current || stopped) return;
					current.index = display(view);
					if (verifiedUrl === location.href) handle.setIndex(current.index);
					if (view.state === "complete") {
						memory.delete(key);
						memory.set(key, view);
						while (memory.size > 2) memory.delete(memory.keys().next().value);
					} else if (view.state === "failed" && !view.canResume && context.visibility !== "public") {
						controller.abort();
						current.index = void 0;
						handle.setIndex({
							entries: new Map(),
							children: new Map(),
							state: "failed",
							pending: 0,
							reason: view.reason
						});
						memory.delete(key);
					}
				}, controller.signal);
			} catch (error) {
				if (!live(ticket) || isAbortError(error)) return;
				active?.controller.abort();
				active = null;
				const canResume = error instanceof ApiError && (error.kind === "network" || error.kind === "rate");
				handle.setIndex({
					entries: new Map(),
					children: new Map(),
					state: error instanceof ApiError && error.kind === "rate" ? "paused" : "failed",
					pending: 0,
					reason: safeMessage(error),
					canResume,
					resumeAt: error instanceof ApiError ? error.resumeAt || void 0 : void 0
				});
			}
		}
		async function checkConnection(cancelSignal) {
			const ticket = generation, signal = AbortSignal.any([cancelSignal, resolving.signal]);
			const page = await resolvePage(document, new URL(location.href), signal);
			if (page.kind !== "code" && page.kind !== "empty") throw new ApiError("invalid", msg("Current GitHub context is unresolved. Reload the page and try again."));
			const scope = await readAuthScope();
			const client = scope.authenticated ? await authClient(scope) : anonymousClient;
			if (scope.authenticated) await client.getIdentity(signal);
			const metadata = await client.getRepository(page.kind === "code" ? page.context.owner : page.owner, page.kind === "code" ? page.context.repo : page.repo, signal);
			if (page.kind === "code") {
				const context = await client.resolveTree(page.context, metadata, signal);
				await client.getTree(context, context.rootTreeSha, false, signal);
			}
			if (!live(ticket) || signal.aborted || !isAuthScopeCurrent(scope)) throw new DOMException("Repository check cancelled", "AbortError");
			return msg(page.kind === "empty" ? "Repository metadata access verified. Empty repository: Contents permission was not exercised." : "Repository read access verified.");
		}
		async function authorizationChanged(next) {
			if (next.id === auth.id && next.authenticated === auth.authenticated) return;
			auth = next;
			generation++;
			resolving.abort();
			detach(false);
			authenticatedClient = null;
			for (const key of memory.keys()) if (!key.endsWith(":public")) memory.delete(key);
			await purgePrivateData();
			if (!stopped) await navigate(true);
		}
		const stopAuth = observeAuthScope((scope) => {
			authorizationChanged(scope).catch(() => notice(msg("Authorization changed; private data stopped. Storage cleanup failed.")));
		});
		const stopSettings = observeSettings((next) => applySettings({
			...next,
			...pendingSettings
		}));
		const menuCommands = [["OpsGitTrees: Manage Token…", credentials.open], ["OpsGitTrees: Open file navigation", () => {
			if (sidebar) sidebar.setCollapsed(false);
			else navigate(true);
		}]];
		let menuIds = [], menuUpdate = Promise.resolve();
		function updateMenus() {
			menuUpdate = menuUpdate.then(async () => {
				for (const id of menuIds) await _GM.unregisterMenuCommand(id);
				menuIds = [];
				if (!stopped) for (const [key, action] of menuCommands) menuIds.push(await _GM.registerMenuCommand(t(key), action));
			}).catch(() => {
				if (!stopped) notice(msg("Script menu could not be updated."));
			});
		}
		const stopLanguage = observeLanguage(updateMenus);
		updateMenus();
		const shortcut = (event) => {
			if (!sidebar || !settings.shortcutsEnabled || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || event.repeat) return;
			if (event.composedPath().some((target) => target instanceof HTMLElement && (target.matches("input,textarea,select,[role=\"textbox\"]") || target.isContentEditable))) return;
			if (event.code === "KeyO") {
				sidebar.setCollapsed(!settings.collapsed);
				event.preventDefault();
			}
			if (event.code === "KeyF") {
				sidebar.focusSearch();
				event.preventDefault();
			}
		};
		const pageHide = () => {
			credentials.close();
			flushView();
			flushSettings();
		};
		window.addEventListener("keydown", shortcut);
		window.addEventListener("pagehide", pageHide);
		const stopPage = observePage(() => {
			navigate();
		});
		purgePrivateData().catch(() => notice(msg("Cache cleanup failed. Check manager storage.")));
		applySettings({
			...await readSettings(),
			...pendingSettings
		});
		await navigate();
		return { stop() {
			stopped = true;
			generation++;
			resolving.abort();
			credentials.close();
			detach();
			stopPage();
			stopAuth();
			stopSettings();
			stopLanguage();
			updateMenus();
			flushSettings();
			window.removeEventListener("keydown", shortcut);
			window.removeEventListener("pagehide", pageHide);
		} };
	}
	window.top === window.self ? startApplication().catch(() => {
		_GM.notification({
			title: "OpsGitTrees",
			text: t("Could not start. Check userscript manager permissions and storage."),
			timeout: 8e3
		});
		return null;
	}) : Promise.resolve(null);
})();
