---
name: Patch application results
description: Handling partial success when applying a diff across multiple files.
---

Applying one patch to multiple files can produce mixed results: some files may be updated while another file fails because one context hunk no longer matches.

**Why:** Retrying the whole patch without inspecting the per-file result can duplicate changes or cause more context mismatches.

**How to apply:** After a partial patch result, inspect the affected files, then retry only the missed changes with smaller, exact-context hunks.