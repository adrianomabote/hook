---
name: Mockup artifact dependencies
description: A generated mockup artifact may have a separate dependency tree from the root project.
---

Creating a mockup artifact can add its package manifest and workflow before the artifact's own dependencies are installed. In that state, the preview workflow may fail with a missing Vite executable even though the artifact files are present.

**Why:** The artifact's local dependency tree is separate from the main project's `node_modules`; successful artifact creation does not guarantee its package install completed.

**How to apply:** When a mockup preview workflow fails to find its runner, check the artifact-local dependencies before debugging the component or changing application code. For standalone builds, inspect the artifact's Vite configuration for required environment variables.