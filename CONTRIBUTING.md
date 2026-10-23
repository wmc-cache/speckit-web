# Contributing to Spec Kit Web

Thanks for helping! This document explains how to set up the project and what we expect in pull requests.

## Development setup

- Node.js **22+** and pnpm **10+**
- Optional: the official `specify` CLI (only needed to try `init` against the real tool)

```bash
pnpm install
pnpm build          # vite build (web app → dist/web) + tsup (CLI → dist/cli.js)
pnpm dev            # serve examples/demo-project from source (tsx)
pnpm dev:web        # Vite dev server for the web app, proxying /api to pnpm dev
```

## Scripts

| Script | Purpose |
|---|---|
| `pnpm test` | Unit + integration tests (Vitest) |
| `pnpm test:perf` | Performance checks on a generated 50-feature / 500-document project |
| `pnpm test:e2e` | Playwright end-to-end tests (run `pnpm build` first; `PW_CHANNEL=chrome` uses your installed Chrome) |
| `pnpm lint` / `pnpm typecheck` | ESLint and TypeScript |
| `pnpm screenshots` | Regenerate `docs/screenshots/` |
| `pnpm sync-integrations` | Refresh the AI-agent list snapshot from the local `specify` |
| `pnpm check-size` | Fail if the npm package would exceed 15 MB |

## Layout

```text
src/core      Spec Kit scanning, parsing, stage detection, Markdown rendering, search (no runtime assumptions)
src/server    Local mode: Hono app, file watcher, SSE, init wizard API
src/build     Static site export
src/init      Orchestration of the official `specify init` (staging → preview → apply → rollback)
src/cli       Command line entry points
web/          React single-page app shared by local and static mode
examples/     Demo Spec Kit project and the GitHub Pages workflow for users
tests/        unit, integration, perf and e2e tests plus fixtures
specs/        The Spec Kit specification of this project
```

## Pull requests

- Keep changes focused; describe the user-visible effect.
- Add or update tests. Counting rules (tasks, checklists, clarifications) and path security must stay covered.
- User-facing strings go into **both** `src/i18n/*.json` / `web/src/i18n/*.json` (English and 简体中文); `tests/unit/i18n.test.ts` checks the keys match.
- No native `<select>` in the web app — use `web/src/components/Dropdown.tsx`.
- Add a changeset: `pnpm changeset` (patch/minor/major plus a short summary). It becomes the CHANGELOG entry.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:` …).

## Releasing (maintainers)

Merging changesets into `main` opens a "Version Packages" PR. Merging that PR publishes to npm with provenance (`NPM_TOKEN` secret required) and updates `CHANGELOG.md`.

To let others start from this repository, enable **Settings → General → Template repository**. Enable **Settings → Pages → Source: GitHub Actions** for the live demo.
