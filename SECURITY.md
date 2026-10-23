# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's private vulnerability reporting (**Security → Report a vulnerability**) on this repository. We aim to acknowledge reports within 3 working days and to publish a fix or mitigation within 30 days.

## Supported versions

Only the latest minor release receives security fixes.

## Threat model

`speckit-web serve` runs a local HTTP server that any web page in your browser could try to reach. It is designed so that this is harmless:

| Risk | Mitigation |
|---|---|
| Access from other machines | Listens on `127.0.0.1` only |
| DNS rebinding from a malicious site | Requests whose `Host` is not `localhost`/`127.0.0.1`/`[::1]` on the server port get `403` |
| Reading arbitrary files | Documents are addressed by id from a whitelist built at scan time (constitution + `specs/**` with allowed extensions); `..`, URL-encoded traversal and symlinks leaving the project are ignored; `.git/`, `node_modules/` and `.env*` are never registered |
| Cross-site request forgery against the init wizard | Write endpoints require a random per-process token embedded in the page and explicit confirmation before overwriting |
| Script injection through Markdown | Rendered HTML is sanitized (no scripts, event handlers or `javascript:` URLs) |

`speckit-web build` only exports the same whitelisted documents and never includes absolute paths, host names or user names.
