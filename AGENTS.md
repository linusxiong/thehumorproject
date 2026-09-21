<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project conventions

- Use English for all source code comments, UI text, sample data, documentation, and commit messages.
- Format commit messages as `<type>(<scope>): <short description>`. A scope is required, with one space after the colon.
- Choose the type that matches the change: `feat` (features), `fix` (bug fixes), `docs` (documentation), `refactor` (refactoring), `test` (tests), or `chore` (maintenance).
- Use the affected module as the scope, such as `project`, `app`, `config`, or `supabase`.
- Summarize the actual changes in each commit; do not reuse an earlier commit's description for unrelated work.
- Examples: `feat(app): display humor entries from Supabase`, `fix(app): correct home page layout`, and `docs(agent): document commit conventions`.
