# Contributing

Thanks for your interest in improving Sleep.

## Project Goals

Sleep should stay easy to read, easy to run, and useful for beginners learning static frontend work. The project intentionally avoids build tools and external dependencies unless there is a clear maintenance or educational reason to add one.

## How To Contribute

1. Fork the repository.
2. Create a branch for your change.
3. Keep changes focused and easy to review.
4. Run the static validation script:

   ```bash
   python .github/scripts/check_static_site.py
   ```

5. Test interactions in a browser, including a mobile-size viewport.
6. Open a pull request with a short description of the change and screenshots when the UI changes.

## Good First Contributions

- Improve accessibility and keyboard interaction.
- Refine mobile layout and animation performance.
- Add new copy variants for the invitation flow.
- Improve documentation and examples.
- Explain a small JavaScript interaction in beginner-friendly language.

## Review Checklist

Before requesting review, please confirm:

- HTML files include a title, charset, and viewport metadata.
- Dynamic text is inserted safely, preferably with `textContent`.
- Decorative animation still works with reduced-motion preferences.
- The page works without external services.
- The change keeps the repository understandable for beginners.

## Maintainer Notes

The maintainer reviews changes for readability, browser compatibility, accessibility, and whether the interaction still works as a simple static web page.
