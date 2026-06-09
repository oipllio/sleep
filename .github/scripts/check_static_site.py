from html.parser import HTMLParser
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
PHOTO_MANIFEST = ROOT / "kumiko-christmas" / "photos.json"


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.has_doctype = False
        self.has_html_lang = False
        self.has_charset = False
        self.has_viewport = False
        self.title_parts = []
        self._in_title = False

    def handle_decl(self, decl):
        if decl.lower() == "doctype html":
            self.has_doctype = True

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html" and attrs.get("lang"):
            self.has_html_lang = True
        if tag == "meta":
            charset = attrs.get("charset", "")
            name = attrs.get("name", "")
            if charset.lower() == "utf-8":
                self.has_charset = True
            if name.lower() == "viewport" and attrs.get("content"):
                self.has_viewport = True
        if tag == "title":
            self._in_title = True

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title_parts.append(data)

    @property
    def has_title(self):
        return bool("".join(self.title_parts).strip())


def validate_html(path):
    errors = []
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        return [f"{path}: is not valid UTF-8 ({exc})"]

    parser = PageParser()
    parser.feed(text)

    checks = {
        "doctype": parser.has_doctype,
        "html lang": parser.has_html_lang,
        "charset": parser.has_charset,
        "viewport": parser.has_viewport,
        "title": parser.has_title,
    }

    for name, ok in checks.items():
        if not ok:
            errors.append(f"{path}: missing {name}")

    if "<script" in text.lower() and "textContent" not in text:
        errors.append(f"{path}: scripts should prefer textContent for dynamic text")

    return errors


def validate_photo_manifest(path):
    errors = []
    if not path.exists():
        return [f"{path}: missing photo manifest"]

    try:
        photos = json.loads(path.read_text(encoding="utf-8"))
    except UnicodeDecodeError as exc:
        return [f"{path}: is not valid UTF-8 ({exc})"]
    except json.JSONDecodeError as exc:
        return [f"{path}: invalid JSON ({exc})"]

    if not isinstance(photos, list) or not photos:
        return [f"{path}: expected a non-empty JSON array"]

    base = path.parent.resolve()
    seen_names = set()
    for index, item in enumerate(photos, start=1):
        if not isinstance(item, dict):
            errors.append(f"{path}: item {index} must be an object")
            continue

        name = item.get("name")
        if not isinstance(name, str) or not name.strip():
            errors.append(f"{path}: item {index} missing name")
        elif name in seen_names:
            errors.append(f"{path}: duplicate photo name {name}")
        else:
            seen_names.add(name)

        for field in ("src", "fullSrc"):
            value = item.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{path}: item {index} missing {field}")
                continue
            if value.startswith(("/", "http://", "https://")):
                errors.append(f"{path}: item {index} {field} must be a relative local path")
                continue

            target = (path.parent / value).resolve()
            if not target.is_relative_to(base):
                errors.append(f"{path}: item {index} {field} escapes the site root")
            elif not target.is_file():
                errors.append(f"{path}: item {index} {field} does not exist: {value}")

    return errors


def main():
    html_files = sorted(
        p for p in ROOT.rglob("*.html") if ".git" not in p.parts
    )
    if not html_files:
        print("No HTML files found.")
        return 1

    errors = []
    for path in html_files:
        errors.extend(validate_html(path))
    errors.extend(validate_photo_manifest(PHOTO_MANIFEST))

    if errors:
        print("Static validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Validated {len(html_files)} HTML file(s) and {PHOTO_MANIFEST.name}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
