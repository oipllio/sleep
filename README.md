# Sleep

Sleep is a small, dependency-free collection of interactive Chinese static pages. It uses plain HTML, CSS, and JavaScript to demonstrate danmaku-style text, lightweight animation, playful button interactions, and no-build GitHub Pages deployment.

Live demo: https://oipllio.github.io/sleep/

Environmental lab calculator: https://oipllio.github.io/sleep/water-lab/

## Why This Project Exists

Many beginners learn frontend development by modifying small static pages before they are ready for build tools, package managers, or frameworks. Sleep keeps the source easy to inspect and remix, so learners can understand how browser APIs, DOM updates, animation, responsive layout, and GitHub Pages hosting work in one public example.

This repository is not distributed as an npm/PyPI package, so monthly package downloads are not a meaningful signal. Its value is educational: it is a simple open-source reference for people learning how to build and publish interactive pages with only browser-native technology.

## Features

- No build step, package manager, or external runtime
- Public GitHub Pages deployment
- Mobile-friendly static pages
- Danmaku-style animated text
- Floating decorative effects and click fireworks
- Playful confirmation flow with keyboard-accessible buttons
- Reduced-motion support for users who prefer less animation
- Browser-side calculator for COD, ammonia nitrogen, total phosphorus, noise Leq, calibration curves, R², concentration conversion, result tables, conclusions, and CSV / Markdown export

## Project Structure

```text
.
|-- index.html
|-- water-lab/
|   |-- index.html
|   |-- styles.css
|   |-- app.js
|   `-- assets/
|-- 1_panjun_danmaku_fixed.html
|-- xixi.html
|-- zhu.html
|-- haha/
|   `-- index.html
|-- .github/
|   |-- ISSUE_TEMPLATE/
|   `-- scripts/
|-- CHANGELOG.md
|-- CODE_OF_CONDUCT.md
|-- CONTRIBUTING.md
|-- LICENSE
`-- SECURITY.md
```

## Local Usage

Open `index.html` in a browser, or serve the repository with any static file server.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

The lab calculator is available at `http://localhost:8000/water-lab/`.

## Quality Checks

The repository includes a lightweight static validation script that checks HTML files for basic document structure, UTF-8 compatibility, titles, charset declarations, and viewport metadata.

```bash
python .github/scripts/check_static_site.py
```

Contributors should run this check before opening pull requests.

## Accessibility And Security Notes

- Dynamic status text uses live regions where appropriate.
- Decorative animation has reduced-motion fallbacks.
- The project avoids third-party scripts and external runtime dependencies.
- Contributions should keep user-facing text safe, static, and easy to review.
- Please report security concerns through `SECURITY.md` instead of public issues.

## Roadmap

- Add more localized copy variants.
- Continue improving keyboard and screen-reader behavior.
- Add examples that explain how each interaction works.
- Keep the project dependency-free unless a clear teaching or maintenance reason appears.

## Maintainer

Maintained by [oipllio](https://github.com/oipllio).

## License

This project is licensed under the MIT License.
