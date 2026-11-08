"""Writes a small synthetic PDF in the layout of the supported export.

Original content only: no material from the test publisher. It is used to test the PDF
preparation code, including the cases that matter most:

* a yellow highlight annotation over the correct option (must never appear in an image),
* vector math that starts immediately below the "Question" heading (must not be clipped),
* the answer-key area (must not leak into the question image),
* a question that continues onto a second page.

    python scripts/make_synthetic_export.py --output synthetic_math.pdf [--prefix mathin --section Math]
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "private-data/python-deps"))
import pymupdf as fitz  # noqa: E402

FONT = "emb"
# Embedding the font keeps the PDF self-contained, like the real exports: a reader
# then needs no external font data to draw it.
EMBEDDED = fitz.Font("helv").buffer


def new_page(doc):
    page = doc.new_page(width=612, height=792)
    page.insert_font(fontname=FONT, fontbuffer=EMBEDDED)
    return page


def header(page, question_id, skill, section="Math", domain="Algebra", difficulty="Easy"):
    page.insert_text((18, 33), f"Question ID: {question_id}", fontsize=8, fontname=FONT)
    for x, label in [(24.8, "Assessment"), (139.6, "Test"), (254.5, "Domain"), (369.4, "Skill"), (484.4, "Difficulty")]:
        page.insert_text((x, 65.3), label, fontsize=8.7, fontname=FONT)
    for x, value in [(24.8, "SAT"), (140, section), (254.9, domain), (369.8, skill), (484.7, difficulty)]:
        page.insert_text((x, 90.8), value, fontsize=8.7, fontname=FONT)


def label(page, text, baseline):
    page.insert_text((18, baseline), text, fontsize=7.89, fontname=FONT)


def build(path, prefix="synth", section="Math"):
    doc = fitz.open()

    # Question 1: multiple choice, highlighted correct option, math under the heading.
    p = new_page(doc)
    header(p, f"{prefix}0001", "Linear functions", section=section)
    label(p, "Question", 135.75)
    # A numerator-like bar that starts 2 pt below the heading box.
    p.draw_rect(fitz.Rect(200, 138.9, 250, 141.9), color=None, fill=(0, 0, 0))
    p.insert_text((18, 180), "What is 2 + 2?", fontsize=9.3, fontname=FONT)
    label(p, "Answer", 210)
    for i, c in enumerate("ABCD"):
        p.insert_text((18, 232 + i * 22), f"{c}. {i + 2}", fontsize=9.3, fontname=FONT)
    label(p, "Correct Answer: C", 354.75)
    label(p, "Rationale", 384)
    p.insert_text((18, 410), "Two plus two is four.", fontsize=9.3, fontname=FONT)
    for rect in p.search_for("C. 4"):
        p.add_highlight_annot(rect)

    # Question 2: student-produced answer that continues onto a second page.
    p = new_page(doc)
    header(p, f"{prefix}0002", "Percentages", section=section, difficulty="Hard")
    label(p, "Question", 135.75)
    p.insert_text((18, 180), "A synthetic stem that continues on the next page.", fontsize=9.3, fontname=FONT)
    label(p, "Answer", 700)
    p = new_page(doc)
    p.insert_text((18, 60), "How many are there?", fontsize=9.3, fontname=FONT)
    label(p, "Correct Answer: 12", 300)
    label(p, "Rationale", 330)
    p.insert_text((18, 356), "There are twelve.", fontsize=9.3, fontname=FONT)

    try:
        doc.subset_fonts()  # keeps the embedded font small when fontTools is available
    except Exception:
        pass
    doc.save(path, garbage=4, deflate=True)
    doc.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--prefix", default="synth", help="Question ID prefix: the IDs are <prefix>0001 and <prefix>0002")
    parser.add_argument("--section", default="Math", choices=["Math", "Reading and Writing"])
    args = parser.parse_args()
    build(args.output, args.prefix, args.section)
