"""Puts one sector's pages into the site.

    python -I -X utf8 tools/add_sector.py <slug> <pages folder> [videos folder]

The pages folder is a kit's الصفحات/: U{u}_L{n}.html, built to stand alone. They are copied into <slug>/,
the sector's outline is read from their titles ("سماي 2 — الوحدة 1 · الدرس 2: <title>") into
sectors/<slug>.js, and intro_N_1080p.mp4 files, where given, go into <slug>/videos/.
"""
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main(slug, pages, videos=None):
    names = {entry["slug"]: entry["name"] for entry in json.loads(
        re.search(r"var LIST = (\[.*?\]);", (ROOT / "sectors/sectors.js").read_text(encoding="utf-8")).group(1))}
    if slug not in names:
        sys.exit(f"unknown sector {slug}; one of {', '.join(names)}")
    pages = Path(pages)
    found = sorted(pages.glob("U*_L*.html"))
    if not found:
        sys.exit(f"no U*_L*.html in {pages}")

    target = ROOT / slug
    if target.exists():
        for old in target.glob("U*_L*.html"):
            old.unlink()
    target.mkdir(exist_ok=True)

    units = {}
    for page in found:
        unit, lesson = map(int, re.match(r"U(\d+)_L(\d+)\.html$", page.name).groups())
        title = re.search(r"<title>([^<]*)", page.read_text(encoding="utf-8")).group(1).split(":", 1)[1].strip()
        entry = units.setdefault(unit, {"title": None, "lessons": {}})
        if lesson == 0:
            entry["title"] = title
        else:
            entry["lessons"][lesson] = title
        shutil.copyfile(page, target / page.name)

    course = {"units": [{"title": units[u]["title"], "lessons": [units[u]["lessons"][n] for n in sorted(units[u]["lessons"])]}
                        for u in sorted(units)]}
    data = {"slug": slug, "sector": names[slug], "course": course}
    (ROOT / "sectors" / f"{slug}.js").write_text(
        f"// سماي 2 — {names[slug]}. Its course is its own, every page in {slug}/.\n"
        "window.SAMAI_SECTOR = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8", newline="\n")

    if videos:
        (target / "videos").mkdir(exist_ok=True)
        for video in sorted(Path(videos).glob("intro_*_1080p.mp4")):
            shutil.copyfile(video, target / "videos" / video.name)

    print(f"{names[slug]}: {len(found)} pages, {len(course['units'])} units")
    for number, unit in enumerate(course["units"], 1):
        print(f"  {number}. {unit['title']} — {len(unit['lessons'])} lessons")


if __name__ == "__main__":
    main(*sys.argv[1:])
