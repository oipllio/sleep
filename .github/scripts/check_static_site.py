from html.parser import HTMLParser
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]


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

    if errors:
        print("Static validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Validated {len(html_files)} HTML file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
