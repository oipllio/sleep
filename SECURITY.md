# Security Policy

## Supported Scope

Sleep is a static GitHub Pages project built with plain HTML, CSS, and JavaScript. There is no backend service, database, account system, or package runtime in the current project scope.

Security reports are still welcome, especially for:

- unsafe DOM updates
- unexpected external resource loading
- misleading user-facing behavior
- accessibility problems that create unsafe or confusing interactions
- changes that introduce unnecessary dependencies or supply-chain risk

## Reporting A Vulnerability

Please do not open a public issue for a sensitive security report.

Instead, contact the maintainer through GitHub at:

https://github.com/oipllio

Include:

- the affected file or page
- steps to reproduce
- the expected and actual behavior
- any browser or device details that help reproduce the issue

The maintainer will review valid reports and publish fixes through normal commits and releases.

## Maintenance Principles

- Keep the project static and dependency-free when possible.
- Prefer safe text rendering with `textContent` for dynamic copy.
- Avoid third-party scripts unless the need is clear and reviewed.
- Review browser behavior on desktop and mobile before releases.
