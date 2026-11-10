#!/usr/bin/env python3
"""Build a source-linked barangay view of Miagao local allocations and activity."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public/data"
DISCLOSURE = DATA / "miagao-disclosure"
INVENTORY = json.loads((ROOT / "src/data/miagao-barangay-inventory.json").read_text())
BARANGAYS = INVENTORY["barangays"]


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def find_barangays(text: str) -> list[dict]:
    """Find longest, non-overlapping official barangay-name phrases."""
    haystack = f" {normalize(text)} "
    candidates = []
    aliases = {"igcabito on": ["igcabitoon"], "to og": ["toog"]}
    for barangay in BARANGAYS:
        names = [barangay["name"], *aliases.get(normalize(barangay["name"]), [])]
        for name in names:
            phrase = normalize(name)
            if not phrase:
                continue
            needle = f" {phrase} "
            start = haystack.find(needle)
            if start >= 0:
                candidates.append((start, -len(phrase), barangay))
    selected = []
    occupied: list[tuple[int, int]] = []
    for start, negative_length, barangay in sorted(
        candidates, key=lambda item: (item[0], item[1])
    ):
        end = start - 1 - negative_length
        if any(start < old_end and end > old_start for old_start, old_end in occupied):
            continue
        if any(item["psgc"] == barangay["psgc"] for item in selected):
            continue
        occupied.append((start, end))
        selected.append({"psgc": barangay["psgc"], "name": barangay["name"]})
    return selected


def numeric(value):
    try:
        number = float(str(value).replace(",", "").replace("₱", "").strip())
        return int(number) if number.is_integer() else number
    except (TypeError, ValueError):
        return None


q3 = json.loads((DISCLOSURE / "full-disclosure-q3.json").read_text())
source_by_type = {source["documentType"]: source for source in q3["sources"]}
nta_source = source_by_type["20% NTA development fund utilization"]
nta_url = nta_source["sourceUrl"]
nta_rows = []
for row in q3["rows"]:
    if row["documentType"] != "20% NTA development fund utilization":
        continue
    values = row["values"]
    title = str(values.get("A", "")).strip()
    amount = numeric(values.get("C"))
    if not re.match(r"^\d+\.\s+", title) or amount is None:
        continue
    matches = find_barangays(f"{title} {values.get('B', '')}")
    released = "released to barangay" in str(values.get("I", "")).lower()
    nta_rows.append({
        "id": f"nta-q3-2026-row-{row['sourceRow']}",
        "stage": "20% NTA development fund utilization",
        "year": 2026,
        "quarter": 3,
        "sourceDocument": "20NTAutilizationnewformat2026.xlsx",
        "sourceSheet": row["worksheet"],
        "sourceRow": row["sourceRow"],
        "sourceUrl": nta_url,
        "title": title,
        "location": values.get("B"),
        "listedAmountPesos": amount,
        "costIncurredToDatePesos": numeric(values.get("G")),
        "completionFraction": numeric(values.get("F")),
        "remarks": values.get("I"),
        "releasedToBarangay": released,
        "isDirectBarangayAssistance": bool(re.match(r"^\d+\.\s*barangay\b", title, re.I)),
        "barangays": matches,
        "assignedAmountPerBarangayPesos": amount / len(matches) if matches else None,
    })

app_rows = []
for path in sorted((DISCLOSURE / "budget-app").glob("rows-*.json")):
    payload = json.loads(path.read_text())
    for row in payload.get("rows", []):
        description = " ".join(str(row.get(key) or "") for key in ("sectionOrProject", "description", "procurementDescription", "remarks"))
        amount = numeric(row.get("budgetPesos"))
        matches = find_barangays(description)
        if not matches or not amount or not re.search(r"road|bridge|culvert|drainage|evacuation|irrigation|water|building|center|hall|facility|fence|multi.?purpose|flood|concreting|rehabilitation|improvement|construction|slope|streetlight|lighting|waiting shed|outpost|toilet|warehouse", description, re.I):
            continue
        app_rows.append({
            "id": f"app-2026-row-{row['row']}",
            "stage": "Annual Procurement Plan",
            "year": 2026,
            "sourceDocument": "CONSOLIDATED-APP-2026.xlsx",
            "sourceSheet": row.get("sourceSheet"),
            "sourceRow": row.get("row"),
            "sourceUrl": row.get("sourceUrl"),
            "title": row.get("procurementDescription") or row.get("description") or row.get("sectionOrProject"),
            "office": row.get("office"),
            "fund": row.get("fund"),
            "plannedProcurementAmountPesos": amount,
            "barangays": matches,
        })

bid_rows = []
def add_bid(year, quarter, worksheet, source_row, values, source_url):
    title = str(values.get("C", "")).strip()
    if not title:
        return
    location = str(values.get("E", "")).strip()
    matches = find_barangays(location or title)
    # Use location as primary where the sheet provides it. This avoids treating
    # a named irrigation system or multi-site program as an actual project site.
    if not matches and location:
        matches = find_barangays(title)
    if not matches:
        return
    bid_rows.append({
        "id": f"bid-{year}-q{quarter}-{source_row}",
        "stage": "Civil works bid result",
        "year": year,
        "quarter": quarter,
        "reference": values.get("B"),
        "sourceDocument": "FDP-DILG-Compliance-3rd-Quarter-2026-CivilGoods-and-Consulting-Services.xlsx" if year == 2026 and quarter == 3 else "FDP-DILG-Compliance-1st-Quarter-2026-CivilGoods-and-Consulting-Services.xlsx",
        "sourceSheet": worksheet,
        "sourceRow": source_row,
        "sourceUrl": source_url,
        "title": title,
        "location": location,
        "approvedBudgetPesos": numeric(values.get("D")),
        "winningBidder": values.get("F"),
        "bidAmountPesos": numeric(values.get("H")),
        "barangays": matches,
    })

bid_type = source_by_type["Bid results"]
for row in q3["rows"]:
    if row["documentType"] == "Bid results" and row["worksheet"] == "FORM 10a - CW":
        add_bid(2026, 3, row["worksheet"], row["sourceRow"], row["values"], row["sourceUrl"])
q1 = json.loads((DISCLOSURE / "q1-execution.json").read_text())
for row in q1.get("bidResultsQ1", []):
    values = {"B": row.get("reference"), "C": row.get("title"), "D": row.get("approvedBudgetPesos"), "E": row.get("location"), "F": row.get("winningBidder"), "H": row.get("bidAmountPesos")}
    add_bid(2026, 1, row.get("form") or "FORM 10a - CW", row.get("row"), values, row.get("sourceUrl"))

by_psgc = {row["psgc"]: {"psgc": row["psgc"], "name": row["name"], "ntaProjectRows": 0, "ntaListedAmountPesos": 0, "directBarangayRows": 0, "directBarangayAmountPesos": 0, "releasedDirectRows": 0, "releasedDirectAmountPesos": 0, "otherNtaRows": 0, "appRows": 0, "appPlannedAmountPesos": 0, "civilWorksBidRows": 0, "ntaRecords": [], "appRecords": [], "bidRecords": []} for row in BARANGAYS}
unlocated_nta = []
for row in nta_rows:
    if not row["barangays"]:
        unlocated_nta.append(row)
        continue
    for barangay in row["barangays"]:
        aggregate = by_psgc[barangay["psgc"]]
        share = row["assignedAmountPerBarangayPesos"]
        aggregate["ntaProjectRows"] += 1
        aggregate["ntaListedAmountPesos"] += share
        if row["isDirectBarangayAssistance"]:
            aggregate["directBarangayRows"] += 1
            aggregate["directBarangayAmountPesos"] += share
            if row["releasedToBarangay"]:
                aggregate["releasedDirectRows"] += 1
                aggregate["releasedDirectAmountPesos"] += share
        else:
            aggregate["otherNtaRows"] += 1
        aggregate["ntaRecords"].append({**row, "assignedAmountForBarangayPesos": share})
for row in app_rows:
    per_site = row["plannedProcurementAmountPesos"] / len(row["barangays"])
    for barangay in row["barangays"]:
        aggregate = by_psgc[barangay["psgc"]]
        aggregate["appRows"] += 1
        aggregate["appPlannedAmountPesos"] += per_site
        aggregate["appRecords"].append({**row, "plannedAmountShareForBarangayPesos": per_site})
for row in bid_rows:
    for barangay in row["barangays"]:
        aggregate = by_psgc[barangay["psgc"]]
        aggregate["civilWorksBidRows"] += 1
        aggregate["bidRecords"].append(row)

for aggregate in by_psgc.values():
    aggregate["ntaListedAmountPesos"] = round(aggregate["ntaListedAmountPesos"], 2)
    aggregate["directBarangayAmountPesos"] = round(aggregate["directBarangayAmountPesos"], 2)
    aggregate["releasedDirectAmountPesos"] = round(aggregate["releasedDirectAmountPesos"], 2)
    aggregate["appPlannedAmountPesos"] = round(aggregate["appPlannedAmountPesos"], 2)

def total(field):
    return sum(row[field] for row in nta_rows)

output = {
    "title": "Miagao local barangay allocations and project records",
    "generatedAt": "2026-11-10",
    "asOf": "2026 Q3 for 20% NTA; 2026 APP and Q1/Q3 bid results",
    "sources": [
        {"label": "2026 Q3 20% NTA utilization", "url": nta_url, "period": "2026 Q3", "type": "Local development-fund utilization schedule"},
        {"label": "2026 Annual Procurement Plan", "url": "https://www.miagao.gov.ph/wp-content/uploads/2026/06/CONSOLIDATED-APP-2026.xlsx", "period": "2026", "type": "Procurement plan"},
        {"label": "2026 Q1 civil works bid results", "url": next((row["sourceUrl"] for row in q1.get("bidResultsQ1", [])), None), "period": "2026 Q1", "type": "Procurement results"},
        {"label": "2026 Q3 civil works bid results", "url": bid_type["sourceUrl"], "period": "2026 Q3", "type": "Procurement results"},
    ],
    "summary": {
        "ntaRows": len(nta_rows),
        "ntaListedAmountPesos": total("listedAmountPesos"),
        "ntaLocatedRows": sum(bool(row["barangays"]) for row in nta_rows),
        "ntaLocatedAmountPesos": round(sum(row["listedAmountPesos"] for row in nta_rows if row["barangays"]), 2),
        "ntaUnlocatedRows": len(unlocated_nta),
        "ntaUnlocatedAmountPesos": round(sum(row["listedAmountPesos"] for row in unlocated_nta), 2),
        "directBarangayRows": sum(row["isDirectBarangayAssistance"] for row in nta_rows),
        "directBarangayAmountPesos": sum(row["listedAmountPesos"] for row in nta_rows if row["isDirectBarangayAssistance"]),
        "releasedDirectRows": sum(row["isDirectBarangayAssistance"] and row["releasedToBarangay"] for row in nta_rows),
        "releasedDirectAmountPesos": sum(row["listedAmountPesos"] for row in nta_rows if row["isDirectBarangayAssistance"] and row["releasedToBarangay"]),
        "appBarangayProjectRows": len(app_rows),
        "appPlannedAmountPesos": round(sum(row["plannedProcurementAmountPesos"] for row in app_rows), 2),
        "civilWorksBidRows": len(bid_rows),
        "unlocatedNtaRecords": unlocated_nta,
    },
    "methodology": [
        "Only the latest available Q3 2026 20% NTA schedule is used; Q2 is not added to it.",
        "NTA project records are assigned only when a listed project title names an official barangay. Rows without a barangay match remain unassigned.",
        "For a project naming multiple barangays, its listed amount is split equally for map shading. This is a visualization estimate, not an official barangay share.",
        "The schedule's listed Total Cost is not treated as spending. Cost incurred to date and remarks are shown separately when provided.",
        "Annual Procurement Plan amounts and bid results are separate procurement-stage evidence and are not added to the NTA allocation map total.",
        "Barangay-level markers mean the source names that barangay; they are not exact project coordinates.",
    ],
    "ntaRecords": nta_rows,
    "appRecords": app_rows,
    "bidRecords": bid_rows,
    "barangays": list(by_psgc.values()),
}
out = DATA / "miagao-local-allocations.json"
out.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n")
print(json.dumps({"output": str(out), "summary": output["summary"] | {"unlocatedNtaRecords": len(unlocated_nta)}, "appRows": len(app_rows), "bidRows": len(bid_rows)}, ensure_ascii=False, indent=2))
