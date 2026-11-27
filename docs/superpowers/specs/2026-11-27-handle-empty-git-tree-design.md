# Empty Git tree handling design

## Intent

Show a valid empty branch as an empty, complete navigation index instead of an API failure. The public GitHub page for `feat/initial-userscript` identifies commit `8aa6215ed60efbc19f877999f5e5f70c9caa8526`; its commit object points to Git's canonical empty tree SHA `4b825dc642cb6eb9a060e54bf8d69288fbee4904`. GitHub returns HTTP 404 for `GET /git/trees/{empty-tree-sha}`, which currently leaves the sidebar in `failed` state.

## Approaches

- **Exact empty-tree sentinel (selected):** before scheduling the root Tree request, recognize only the canonical Git empty-tree SHA and emit a complete empty index. Keep every other tree request and 404 behavior unchanged. The commit object's verified root SHA is sufficient evidence that the tree has no entries.
- **Parse GitHub's empty-page markup:** add route-specific DOM detection. Rejected because it duplicates commit metadata and relies on page markup when the resolved tree SHA already proves emptiness.
- **Treat any root Tree 404 as empty:** rejected because it can misreport missing or inaccessible objects as valid empty repositories.

## Scope and verification

Add a regression test proving the exact empty-tree context completes with no entries and makes no Tree request. Preserve error handling for all other SHAs. Rebuild the self-contained userscript and verify the real ScriptCat branch page after user approval of the update. No cache-format, authorization, request-budget, or ordinary 404 changes.
