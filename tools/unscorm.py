"""Turns a sector's SCORM upload back into its pages.

    python -I -X utf8 tools/unscorm.py <SAMAI2-<CODE>-SCORM.zip> <out folder>

The zip holds Unit N/UNN_LMM.zip packages, made by the kit's أدوات/scorm-pack.js from الصفحات/U{u}_L{n}.html. That
script changed each page in these ways, undone here in turn: the SCORM runtime it put after <meta charset> comes out
(it also takes the page's own previous and next links away), the icons and font point at their sites again instead
of the package's assets/, the font's preconnects come back, a stepper's stage sizes itself from the window again (the
packed one shrinks to nothing in any frame, the shell's included), and a unit's intro video, where packed, is kept
beside the pages in videos/. Tested on energy, whose pages came with its upload: what is left is the content team's
two script tags for files that never existed, which the packer dropped.
"""
import io
import re
import sys
import zipfile
from pathlib import Path

FONT = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap"
ICONS = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
PRECONNECT = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
              '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n')
BOOT = re.compile(r'\n<script>window\.__SAMAI_SCO=[^<]*</script>\n<script id="samai-scorm">\n.*?\n</script>\n', re.S)


def page(html):
    html, runtime = BOOT.subn("", html, count=1)
    if not runtime:
        raise ValueError("no SCORM runtime found")
    html = html.replace('"assets/fa/css/all.min.css"', f'"{ICONS}"')
    html = html.replace('"assets/fonts/plex.css"', f'"{FONT}"')
    html = html.replace("const room = (window.parent !== window ? 0 : innerHeight) - top0();", "const room = innerHeight - top0();")
    link = re.search(r'<link[^>]*href="https://fonts\.googleapis\.com/css2\?family=IBM\+Plex', html)
    if link and "fonts.gstatic.com" not in html:
        html = html[:link.start()] + PRECONNECT + html[link.start():]
    return html


def packages(upload):
    """Every UNN_LMM package in the upload, however deep: some uploads hold one zip per unit, holding the packages."""
    for name in sorted(upload.namelist()):
        found = re.search(r"U0(\d)_L0(\d)\.zip$", name)
        if found:
            yield found[1], found[2], zipfile.ZipFile(io.BytesIO(upload.read(name)))
        elif name.endswith(".zip"):
            yield from packages(zipfile.ZipFile(io.BytesIO(upload.read(name))))


def main(source, out):
    out = Path(out)
    (out / "videos").mkdir(parents=True, exist_ok=True)
    done = 0
    for unit, lesson, package in packages(zipfile.ZipFile(source)):
        # U00_L00 is the course's welcome, which the shell does not show.
        if unit == "0":
            continue
        html = package.read("index.html").decode("utf-8")
        (out / f"U{unit}_L{lesson}.html").write_text(page(html), encoding="utf-8", newline="")
        for video in (n for n in package.namelist() if n.startswith("videos/") and n.endswith(".mp4")):
            (out / video).write_bytes(package.read(video))
        done += 1
    print(f"{done} pages into {out}")


if __name__ == "__main__":
    main(*sys.argv[1:])
