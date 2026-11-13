#!/usr/bin/env python3
"""Extract comparable text rows from archived Miagao disclosure PDFs.

Example:
  python3 scripts/build-miagao-historical-tables.py --archive-root ../nep

Ghostscript's text layout is retained as parsed cells with the source filename,
detected document heading, and reporting period. Spacing-based columns can be
approximate; the original document link remains authoritative.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "public/data/miagao-historical-index.json"
OUTPUT = ROOT / "public/data/miagao-historical-tables.json"

CATEGORIES = [
    ("bid-out", "Bid-out: civil works, goods and services", re.compile(r"\bbid[- ]out\b|\bbid results?\b", re.I)),
    ("human-resource-complement", "Human resource complement", re.compile(r"human resource complement|manpower complement", re.I)),
    ("ldrrmf-utilization", "Local disaster risk reduction and management fund utilization", re.compile(r"LDR(?:R?M|MM)F?|disaster risk reduction and management fund utilization", re.I)),
    ("cash-flows", "Cash flow statement", re.compile(r"cash flow", re.I)),
    ("sef-utilization", "Report of SEF utilization", re.compile(r"SEF utilization|special education fund utilization", re.I)),
    ("receipts-expenditures", "Statement of receipts and expenditures", re.compile(r"statement of receipts and expenditures", re.I)),
    ("supplemental-procurement-plan", "Supplemental procurement plan", re.compile(r"supplemental.{0,20}(?:procurement plan|PPMP)|supplemental[ ._-]*PPMP", re.I)),
    ("quarterly-government-projects", "Consolidated quarterly report on government projects, programs or activities", re.compile(r"quarterly report on government project", re.I)),
    ("debt-service", "Statement of debt services", re.compile(r"debt service|indebtedness payments", re.I)),
    ("unliquidated-cash-advances", "Unliquidated cash advances", re.compile(r"unliquidated.{0,20}(?:cash )?advances?|unliquadated.{0,20}advances?|unliquidated[- ]CA[- ]", re.I)),
    ("trust-fund-utilization", "Trust fund utilization", re.compile(r"trust fund utilization|\bTF utilization\b", re.I)),
    ("ira-utilization", "20% component of the IRA utilization", re.compile(r"20.{0,20}component.{0,20}IRA.{0,20}utilization|20[- ]IRA[- ]utilization", re.I)),
]


def decode_legacy_text(text: str) -> str:
    """Undo a legacy PDF font's ROT+3 letters and space control character."""
    if text.count("\x03") < 4:
        return text

    def rotate(char: str) -> str:
        if "A" <= char <= "Z":
            return chr((ord(char) - ord("A") - 3) % 26 + ord("A"))
        if "a" <= char <= "z":
            return chr((ord(char) - ord("a") - 3) % 26 + ord("a"))
        if char == "\x03" or (ord(char) < 32 and char not in "\n\r\f\t"):
            return " "
        return char

    return "".join(rotate(char) for char in text)


def source_filename(url: str | None, fallback: str) -> str:
    if not url:
        return fallback
    return unquote(Path(urlparse(url).path).name) or fallback


def parsed_table_rows(text: str, max_rows: int = 900):
    pages = []
    for page_number, page in enumerate(text.split("\f"), 1):
        rows = []
        for line in page.splitlines():
            normalized = re.sub(r"[\t ]+", " ", line).strip()
            if not normalized:
                continue
            cells = [cell.strip() for cell in re.split(r"\s{2,}", line.strip()) if cell.strip()]
            rows.append({"cells": cells or [normalized], "text": normalized})
            if len(rows) >= max_rows:
                break
        if rows:
            pages.append({"pageNumber": page_number, "rows": rows})
    return pages


def reporting_period(text: str) -> str | None:
    patterns = [
        r"(?i)\bAs of\s+[A-Z][a-z]+\s+\d{1,2},?\s+20\d{2}",
        r"(?i)\bFor the (?:Month|Year) of\s+[A-Z][a-z]+(?:\s+\d{1,2},?)?\s+20\d{2}",
        r"(?i)\b[1-4](?:st|nd|rd|th)\s+Quarter(?:,\s*CY)?\s*20\d{2}",
        r"(?i)\bQ[1-4],?\s*20\d{2}",
        r"(?i)\bBudget Year\s*20\d{2}",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return re.sub(r"\s+", " ", match.group(0)).strip()
    return None


def infer_category(text: str, filename: str):
    heading_lines = [line.strip() for line in text.splitlines()[:35] if line.strip()]
    heading = "\n".join(heading_lines)
    for category_id, label, pattern in CATEGORIES:
        if pattern.search(heading):
            return category_id, label, "document heading"
    for category_id, label, pattern in CATEGORIES:
        if pattern.search(filename.replace("-", " ").replace("_", " ")):
            return category_id, label, "source filename"
    return "other", "Other / unclassified", "source filename"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive-root", type=Path, required=True)
    parser.add_argument("--ghostscript", default="gs")
    args = parser.parse_args()

    index = json.loads(INDEX.read_text(encoding="utf-8"))
    documents = {}
    for row in index.get("rows", []):
        url = row.get("documentUrl")
        archive_path = row.get("sourceArchivePath")
        page_url = (row.get("sourcePageUrl") or "").lower()
        title = (row.get("sourceTitle") or "").lower()
        filename = source_filename(url, row.get("sourceFileName", ""))
        lower_name = filename.lower()
        is_invitation_to_bid = (
            "invitation-to-bid" in page_url
            or "invitation to bid" in title
            or "invitation-to-bid" in title
        )
        if not url or not archive_path or not url.lower().endswith(".pdf"):
            continue
        if is_invitation_to_bid:
            continue
        document = documents.setdefault(url, {
            "documentUrl": url,
            "sourcePageUrl": row.get("sourcePageUrl"),
            "sourceTitle": row.get("sourceTitle"),
            "sourceFileName": row.get("sourceFileName"),
            "sourceArchivePath": archive_path,
            "publishedAt": row.get("publishedAt"),
            "originalLabel": filename,
            "sourceReferences": row.get("sourceReferences", []),
            "documentSha256": row.get("documentSha256"),
            "parseStatus": row.get("parseStatus"),
            "extractionMethod": row.get("extractionMethod"),
        })
        if not document.get("sourcePageUrl"):
            document["sourcePageUrl"] = row.get("sourcePageUrl")

    output_docs = []
    for url, document in documents.items():
        path = args.archive_root / document["sourceArchivePath"]
        result = subprocess.run(
            [args.ghostscript, "-q", "-sDEVICE=txtwrite", "-o", "-", str(path)],
            capture_output=True,
            check=False,
        )
        raw_text = decode_legacy_text(result.stdout.decode("latin-1", errors="replace"))
        category_id, category_label, category_basis = infer_category(raw_text, document["originalLabel"])
        if result.returncode:
            status = "extract_failed"
            raw_text = ""
        elif len(re.findall(r"[A-Za-z]{2,}", raw_text)) >= 20:
            status = "text_extracted"
        elif raw_text.strip():
            status = "partial_text"
        else:
            status = "no_text"
        heading = None
        title_patterns = [pattern for _, _, pattern in CATEGORIES]
        for line in raw_text.splitlines()[:35]:
            cleaned = re.sub(r"\s+", " ", line).strip()
            if cleaned and any(pattern.search(cleaned) for pattern in title_patterns):
                heading = cleaned[:240]
                break
        table_pages = parsed_table_rows(raw_text)
        output_docs.append({
            **{key: value for key, value in document.items() if key != "sourceArchivePath"},
            "normalizedCategory": category_id,
            "normalizedCategoryLabel": category_label,
            "categoryBasis": category_basis,
            "parsedTitle": heading,
            "reportingPeriod": reporting_period(raw_text),
            "extractionStatus": status,
            "pageCount": len(table_pages),
            "tablePages": table_pages,
        })

    output_docs.sort(key=lambda item: (item["normalizedCategoryLabel"], item.get("publishedAt") or "", item["originalLabel"].lower()))
    payload = {
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(timespec="seconds"),
        "method": "Ghostscript txtwrite with spacing-based row and cell extraction",
        "disclaimer": "Extracted cells are comparison aids. PDF text spacing and custom fonts can misalign or garble values; verify all values in the linked original.",
        "documents": output_docs,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    counts = {}
    for item in output_docs:
        counts[item["normalizedCategoryLabel"]] = counts.get(item["normalizedCategoryLabel"], 0) + 1
    print(json.dumps({"output": str(OUTPUT), "documents": len(output_docs), "categories": counts}, indent=2))


if __name__ == "__main__":
    main()
