#!/usr/bin/env python3
"""Extract comparable text rows from archived Miagao disclosure PDFs and XLSX workbooks.

Example:
  python3 scripts/build-miagao-historical-tables.py --archive-root ../nep

Ghostscript's PDF text layout and spreadsheet worksheet cells are retained as
parsed rows with the source filename, detected heading, and reporting period.
PDF spacing-based columns can be approximate; original links remain authoritative.
"""
from __future__ import annotations

import argparse
import json
import posixpath
import re
import subprocess
import zipfile
from xml.etree import ElementTree as ET
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "public/data/miagao-historical-index.json"
OUTPUT = ROOT / "public/data/miagao-historical-tables.json"
INVENTORY_NAME = "analysis_output/miagao-transparency-source-inventory.json"

CATEGORIES = [
    ("bid-out", "Bid-out: civil works, goods and services", re.compile(r"\bbid[- ]out\b|\bbid results?\b|notice of award|minutes of bidding", re.I)),
    ("human-resource-complement", "Human resource complement", re.compile(r"human resource complement|manpower complement", re.I)),
    ("ldrrmf-utilization", "Local disaster risk reduction and management fund utilization", re.compile(r"LDR(?:R?M|MM)F?|disaster risk reduction and management fund utilization", re.I)),
    ("cash-flows", "Cash flow statement", re.compile(r"cash flow", re.I)),
    ("sef-utilization", "Report of SEF utilization", re.compile(r"SEF utilization|special education fund utilization", re.I)),
    ("receipts-expenditures", "Statement of receipts and expenditures", re.compile(r"statement of receipts and expenditures", re.I)),
    ("supplemental-procurement-plan", "Supplemental procurement plan", re.compile(r"supplemental.{0,20}(?:procurement plan|PPMP)|supplemental[ ._-]*PPMP", re.I)),
    ("quarterly-government-projects", "Consolidated quarterly report on government projects, programs or activities", re.compile(r"quarterly report on government project|consolidated.{0,50}report", re.I)),
    ("debt-service", "Statement of debt services", re.compile(r"debt service|statement of indebtedness|indebtedness payments|payments and balances", re.I)),
    ("unliquidated-cash-advances", "Unliquidated cash advances", re.compile(r"unliquidated.{0,20}(?:cash )?advances?|unliquadated.{0,20}advances?|unliquidated[- ]CA[- ]", re.I)),
    ("trust-fund-utilization", "Trust fund utilization", re.compile(r"trust fund utilization|\bTF utilization\b", re.I)),
    ("ira-utilization", "20% component of the IRA utilization", re.compile(r"20.{0,20}component.{0,20}IRA.{0,20}utilization|20[- ]IRA[- ]utilization", re.I)),
    ("nta-utilization", "20% component of the NTA utilization", re.compile(r"20.{0,20}(?:component.{0,20})?NTA.{0,20}utilization|NTA utilization", re.I)),
    ("annual-procurement-plan", "Annual procurement plan", re.compile(r"annual.{0,25}(?:procurement plan|\bAPP\b)|\bAPP\b.{0,25}(?:procurement|plan)|\bFDP[- ]APP\b", re.I)),
    ("annual-budget-report", "Annual budget report", re.compile(r"annual budget report|budget year.{0,10}report|\bbudget ?20\d{2}\b", re.I)),
    ("gad-accomplishment-report", "Gender and development accomplishment report", re.compile(r"(?:gender and development|\bGAD\b).{0,50}accomplishment report|accomplishment report.{0,50}(?:gender and development|\bGAD\b)", re.I)),
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
            cells = cells or [normalized]
            row = {"cells": cells, "text": normalized}
            second_cell_is_value = len(cells) == 2 and bool(
                re.fullmatch(
                    r"(?:₱\s*)?[-–—]?(?:\d[\d,]*(?:\.\d+)?%?|n/?a|none)",
                    cells[1],
                    re.I,
                )
            )
            if len(cells) == 2 and second_cell_is_value:
                row.update({"item": cells[0], "value": cells[1]})
            rows.append(row)
            if len(rows) >= max_rows:
                break
        if rows:
            pages.append({"pageNumber": page_number, "rows": rows})
    return pages


def xlsx_sheets(path: Path):
    """Read XLSX values with the standard library, retaining worksheet rows."""
    namespace = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
                 "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
                 "pkg": "http://schemas.openxmlformats.org/package/2006/relationships"}
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        shared_strings = []
        if "xl/sharedStrings.xml" in names:
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("main:si", namespace):
                shared_strings.append("".join(node.text or "" for node in item.iter(f"{{{namespace['main']}}}t")))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {}
        for item in relationships.findall("pkg:Relationship", namespace):
            target = item.attrib["Target"].lstrip("/")
            if not target.startswith("xl/"):
                target = posixpath.join("xl", target)
            targets[item.attrib["Id"]] = posixpath.normpath(target)
        sheets = []
        for sheet in workbook.findall("main:sheets/main:sheet", namespace):
            name = sheet.attrib.get("name", "Sheet")
            target = targets.get(sheet.attrib.get(f"{{{namespace['rel']}}}id"))
            if not target or target not in names:
                continue
            sheet_root = ET.fromstring(archive.read(target))
            rows = []
            for row in sheet_root.findall(".//main:sheetData/main:row", namespace):
                values = []
                for cell in row.findall("main:c", namespace):
                    cell_ref = cell.attrib.get("r", "")
                    column_letters = re.match(r"[A-Z]+", cell_ref)
                    column = 0
                    if column_letters:
                        for letter in column_letters.group(0):
                            column = column * 26 + ord(letter) - ord("A") + 1
                    while len(values) < max(column - 1, 0):
                        values.append("")
                    cell_type = cell.attrib.get("t")
                    value = cell.find("main:v", namespace)
                    if cell_type == "inlineStr":
                        text = "".join(node.text or "" for node in cell.iter(f"{{{namespace['main']}}}t"))
                    elif value is None:
                        text = ""
                    elif cell_type == "s":
                        try:
                            text = shared_strings[int(value.text or "0")]
                        except (ValueError, IndexError):
                            text = value.text or ""
                    else:
                        text = value.text or ""
                    values.append(text)
                while values and not values[-1].strip():
                    values.pop()
                if any(value.strip() for value in values):
                    rows.append({"rowNumber": int(row.attrib.get("r", len(rows) + 1)),
                                 "cells": values,
                                 "text": " | ".join(value for value in values if value.strip())})
            sheets.append({"name": name, "rows": rows})
    return sheets


SIGNATURE_MARKER = re.compile(r"\(?\s*s\s*\.?\s*g\s*\.?\s*d\s*\.?\s*\)?", re.I)
ROLE_HINT = re.compile(
    r"\b(mayor|accountant|chair(?:man|person)|secretary|engineer|officer|"
    r"treasurer|administrator|clerk|lce|chief|head|department|division|"
    r"budget|assessor|civil registrar|planning|general services|approved by|"
    r"prepared by|noted by|certified correct)\b",
    re.I,
)
NAME_PARTICLE = {"da", "das", "de", "del", "della", "dela", "di", "dos", "la", "van", "von", "y"}


def normalize_person_name(name: str) -> str:
    """Normalize OCR casing while preserving initials and common suffixes."""
    tokens = re.findall(r"[^\s]+", name.strip())
    normalized = []
    for index, token in enumerate(tokens):
        match = re.match(r"^([^A-Za-zÀ-ÖØ-öø-ÿ]*)(.*?)([^A-Za-zÀ-ÖØ-öø-ÿ]*)$", token)
        if not match:
            normalized.append(token)
            continue
        prefix, core, suffix = match.groups()
        lower = core.lower().rstrip(".")
        if lower in {"m.d", "md"}:
            fixed = "M.D."
        elif re.fullmatch(r"(?:[A-Z]\.){1,4}[A-Z]?\.?", core):
            fixed = core.upper()
        elif lower in {"jr", "sr"}:
            fixed = lower.capitalize() + ("." if core.endswith(".") else "")
        elif lower in {"ii", "iii", "iv"}:
            fixed = lower.upper()
        elif index and lower in NAME_PARTICLE:
            fixed = lower
        else:
            fixed = core.lower().capitalize()
        normalized.append(prefix + fixed + suffix)
    result = " ".join(normalized)
    identity = re.sub(r"[^a-z]", "", result.lower())
    if identity in {"macarionnapulanmd", "macarionnapulan"}:
        return "Macario N. Napulan, M.D."
    return result


def extract_signatories(table_pages: list[dict]):
    """Capture signed names with nearby position labels as dated document evidence."""
    signatories = []
    seen = set()
    for page in table_pages:
        rows = page["rows"]
        for row_index, row in enumerate(rows):
            cells = row.get("cells") or [row["text"]]
            marker_cells = [
                (cell_index, cell)
                for cell_index, cell in enumerate(cells)
                if SIGNATURE_MARKER.search(cell)
            ]
            if not marker_cells:
                continue

            name_candidates = []
            for cell_index, cell in marker_cells:
                # A signature marker and name may share a cell, or be on the next row.
                inline = SIGNATURE_MARKER.sub(" ", cell).strip(" :;,-")
                if inline:
                    role_match = ROLE_HINT.search(inline)
                    inline_role = inline[role_match.start():].strip(" :;,-") if role_match else None
                    inline_name = inline[:role_match.start()].strip(" :;,-") if role_match else inline
                    name_candidates.append((cell_index, inline_name, row_index, inline_role))
                elif row_index + 1 < len(rows):
                    next_cells = rows[row_index + 1].get("cells") or [rows[row_index + 1]["text"]]
                    if cell_index < len(next_cells):
                        name_candidates.append((cell_index, next_cells[cell_index], row_index + 1, None))
                    elif len(marker_cells) == 1 and next_cells:
                        name_candidates.append((0, " ".join(next_cells), row_index + 1, None))

            for cell_index, name, name_row_index, inline_role in name_candidates:
                name = re.sub(r"\s+", " ", name).strip(" :;,-")
                name = re.sub(r"^(?:HON\.?|DR\.?|ATTY\.?)\s+", "", name, flags=re.I)
                name = normalize_person_name(name)
                if not re.search(r"[A-Za-z]{2,}.*\s+[A-Za-z]{2,}", name) or ROLE_HINT.search(name):
                    continue
                role = inline_role
                if not role and name_row_index == row_index and cell_index + 1 < len(cells):
                    same_row_role = cells[cell_index + 1]
                    if ROLE_HINT.search(same_row_role):
                        role = same_row_role
                if not role and name_row_index + 1 < len(rows):
                    role_cells = rows[name_row_index + 1].get("cells") or [rows[name_row_index + 1]["text"]]
                    if cell_index < len(role_cells):
                        role = role_cells[cell_index]
                    elif len(role_cells) == 1:
                        role = role_cells[0]
                role = re.sub(r"\s+", " ", role or "").strip(" :;,-")
                if not role or not ROLE_HINT.search(role):
                    continue
                key = (page["pageNumber"], name.casefold(), role.casefold())
                if key in seen:
                    continue
                seen.add(key)
                signatories.append({
                    "name": name,
                    "position": role,
                    "pageNumber": page["pageNumber"],
                    "evidence": "Signature marker and adjacent printed name and position",
                })
    return signatories


def pretty_payload(payload: dict) -> str:
    """Keep cell arrays compact while formatting the surrounding JSON."""
    lines = json.dumps(payload, ensure_ascii=False, indent=2).splitlines()
    output = []
    index = 0
    while index < len(lines):
        line = lines[index]
        if '"cells": [' not in line or not line.rstrip().endswith("["):
            output.append(line)
            index += 1
            continue
        indent = line[: len(line) - len(line.lstrip())]
        prefix = line[: line.index("[")]
        index += 1
        cell_lines = []
        while index < len(lines) and lines[index].strip() not in {"]", "],"}:
            cell_lines.append(lines[index].strip())
            index += 1
        cells = json.loads("[" + "".join(cell_lines) + "]")
        output.append(prefix + json.dumps(cells, ensure_ascii=False, separators=(", ", ": ")) + ("," if lines[index].strip().endswith("],") else ""))
        index += 1
    return "\n".join(output) + "\n"


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
    priority_ids = {"annual-procurement-plan", "supplemental-procurement-plan"}
    for category_id, label, pattern in CATEGORIES:
        if category_id in priority_ids and pattern.search(heading):
            return category_id, label, "document heading"
    for category_id, label, pattern in CATEGORIES:
        if category_id in priority_ids and pattern.search(filename.replace("-", " ").replace("_", " ")):
            return category_id, label, "source filename"
    for category_id, label, pattern in CATEGORIES:
        if category_id not in priority_ids and pattern.search(heading):
            return category_id, label, "document heading"
    for category_id, label, pattern in CATEGORIES:
        if category_id not in priority_ids and pattern.search(filename.replace("-", " ").replace("_", " ")):
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

    inventory_path = args.archive_root / INVENTORY_NAME
    if inventory_path.is_file():
        inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
        for source in inventory.get("linkedUrls", []):
            url = source.get("url")
            archive = source.get("archive") or {}
            archive_path = archive.get("localPath")
            if not url or not archive_path or Path(urlparse(url).path).suffix.lower() != ".xlsx":
                continue
            refs = []
            for ref in source.get("sources", []):
                refs.append({
                    "documentUrl": url,
                    "sourcePageUrl": ref.get("sourceUrl"),
                    "sourceTitle": ref.get("sourceTitle"),
                    "publishedAt": ref.get("sourceDate"),
                    "sourceElement": ref.get("element"),
                    "sourceAttribute": ref.get("attribute"),
                    "fileName": source_filename(url, Path(archive_path).name),
                })
            first_ref = refs[0] if refs else {}
            documents.setdefault(url, {
                "documentUrl": url,
                "sourcePageUrl": first_ref.get("sourcePageUrl"),
                "sourceTitle": first_ref.get("sourceTitle") or source_filename(url, "Workbook"),
                "sourceFileName": Path(archive_path).name,
                "sourceArchivePath": archive_path,
                "publishedAt": first_ref.get("publishedAt"),
                "originalLabel": source_filename(url, Path(archive_path).name),
                "sourceReferences": refs,
                "documentSha256": archive.get("sha256"),
                "parseStatus": "structured_workbook",
                "extractionMethod": "XLSX worksheet cell extraction",
                "format": "xlsx",
            })

    output_docs = []
    for url, document in documents.items():
        path = args.archive_root / document["sourceArchivePath"]
        is_xlsx = path.suffix.lower() == ".xlsx"
        if is_xlsx:
            try:
                sheets = xlsx_sheets(path)
                raw_text = "\n".join(f"{sheet['name']}\n" + "\n".join(row["text"] for row in sheet["rows"])
                                      for sheet in sheets)
                result_returncode = 0
            except (OSError, ValueError, KeyError, zipfile.BadZipFile, ET.ParseError) as exc:
                sheets = []
                raw_text = ""
                result_returncode = 1
                document["parseError"] = f"{type(exc).__name__}: {exc}"
        else:
            result = subprocess.run(
                [args.ghostscript, "-q", "-sDEVICE=txtwrite", "-o", "-", str(path)],
                capture_output=True,
                check=False,
            )
            raw_text = decode_legacy_text(result.stdout.decode("latin-1", errors="replace"))
            result_returncode = result.returncode
        category_id, category_label, category_basis = infer_category(
            raw_text, document["originalLabel"] + " " + (document.get("sourceTitle") or "")
        )
        if result_returncode:
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
        if is_xlsx and not result_returncode:
            table_pages = [
                {"pageNumber": sheet_index, "worksheetName": sheet["name"],
                 "rows": [{"cells": row["cells"], "sourceRowNumber": row["rowNumber"]}
                          for row in sheet["rows"]]}
                for sheet_index, sheet in enumerate(sheets, 1)
            ]
            status = "spreadsheet_cells_extracted" if any(page["rows"] for page in table_pages) else "no_text"
        else:
            table_pages = parsed_table_rows(raw_text)
        signatories = extract_signatories(table_pages)
        signatory_date = reporting_period(raw_text)
        signatory_date_basis = "document reporting period" if signatory_date else "source publication date"
        if not signatory_date:
            signatory_date = (document.get("publishedAt") or "")[:10] or None
        for person in signatories:
            person["recordedDate"] = signatory_date
            person["dateBasis"] = signatory_date_basis if signatory_date else None
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
            "signatories": signatories,
        })

    output_docs.sort(key=lambda item: (item["normalizedCategoryLabel"], item.get("publishedAt") or "", item["originalLabel"].lower()))
    payload = {
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(timespec="seconds"),
        "method": "Ghostscript text extraction for PDFs and ZIP/XML worksheet cell extraction for XLSX workbooks",
        "disclaimer": "Extracted cells are comparison aids. PDF text spacing and custom fonts can misalign or garble values; spreadsheet formulas, formatting and merged-cell layouts may not be reproduced. Verify all values in the linked original.",
        "documents": output_docs,
    }
    OUTPUT.write_text(pretty_payload(payload), encoding="utf-8")
    counts = {}
    for item in output_docs:
        counts[item["normalizedCategoryLabel"]] = counts.get(item["normalizedCategoryLabel"], 0) + 1
    print(json.dumps({"output": str(OUTPUT), "documents": len(output_docs), "categories": counts}, indent=2))


if __name__ == "__main__":
    main()
