# Empty Git tree support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native inline implementation). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Treat a context whose root SHA is Git's canonical empty-tree SHA as an empty, complete index without issuing a Tree request.

**Architecture:** Keep commit and repository authorization checks in `main.ts`. In `startPreload`, skip only the initial Tree task for the canonical empty-tree SHA; the existing scheduler then publishes the empty index as complete. All other SHAs retain the normal cache and API path.

**Tech Stack:** TypeScript, Vitest, existing GM test adapter, pnpm, Vite.

**Spec:** [Empty Git tree handling design](../specs/2026-11-27-handle-empty-git-tree-design.md)

## Global Constraints

- Special-case only `4b825dc642cb6eb9a060e54bf8d69288fbee4904`.
- Do not bypass repository Metadata checks, private Contents authorization, or cancellation.
- Do not change handling for any other Tree 404, cache keys, or persistent formats.
- Use the existing preload tests and storage lock setup; add no dependency.

## Review Focus

1. A canonical empty root must finish with zero paths and no pending work, without a Tree request; pin this behavior in the preload regression test.
2. A missing non-empty tree SHA must remain an error, never be converted to an empty index; test a non-empty root returning HTTP 404.
3. A normal non-empty root must retain current preload behavior; the existing `preloadContinuesAcrossBatches` test covers it.
4. An aborted loader must not publish an empty completion after cancellation; preserve the existing `abortDuringStorageWaitStopsFollowupWork` coverage.
5. Private navigation must still pass the existing online Contents authorization gate before preload is started; preserve `privateCacheStillChecksContents` coverage.

---

### Task 1: Empty root preload

**Files:**
- Modify: `src/preload.ts`
- Test: `tests/preload.test.ts`
- Update: `docs/cache-implementation-plan.md`, `docs/cache-design.md`, `docs/directory-preloading.md`, `docs/technology.md`
- Rebuild: `dist/opsgittrees.user.js`

**Interfaces:**
- Consume the existing `RepoContext.rootTreeSha` and `IndexView` types.
- Keep `startPreload(...)` signature unchanged.

- [x] **Step 1: Add two focused preload tests.** The canonical empty-tree test asserts complete state, zero entries, root children `[]`, `pending === 0`, and no Tree request. The non-empty root 404 test asserts failed state with the existing not-found reason.
- [x] **Step 2: Run the canonical-empty regression test and confirm the expected failure.** The targeted test failed before the implementation because the loader treated the root 404 as a failure.
- [x] **Step 3: Implement the exact-SHA fast path in `src/preload.ts`.** Only the canonical empty-tree SHA omits the initial Tree task; the scheduler publishes the complete empty index. Other root SHAs retain the existing path.
- [x] **Step 4: Verify behavior.** Both focused cases, `pnpm test` (8 files, 167 tests passed), and `pnpm typecheck` passed.
- [x] **Step 5: Rebuild and verify in the existing ScriptCat instance.** `pnpm build` produced 128.30 kB (gzip 34.74 kB); after user approval, the existing UUID ran in Chrome 156 / ScriptCat 1.5.2. The empty branch showed 0 paths complete, and main showed 58 paths complete.
- [x] **Step 6: Commit implementation and validation records with the eval `commit` namespace.** Commit `40c8d930c6948b647e2a92577731855a3bad3f45` records source, tests, production bundle, observed behavior, and explicit external verification gaps.
