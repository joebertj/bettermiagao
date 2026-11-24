#!/usr/bin/env python3
"""Refresh Miagao's SCR comparison and historical repeat catalog from local BetterGov data."""

import argparse
from collections import defaultdict
from functools import partial
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'src/data'
STAGE_ORDER = {'SCR': 0, 'HGAB 3rd': 1, 'NEP': 2, 'GAA': 3}
PROGRAMS = {'dpwh': 'DPWH infrastructure', 'fmr': 'Farm-to-market roads',
            'hfep': 'Health facilities', 'nia': 'NIA irrigation'}


def read(path):
    return json.loads(path.read_bytes())


def write(name, payload):
    (DATA / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def pesos(value):
    return int(value) if value not in ('', None) else None


def stage(row, amount, url, label):
    if row[amount] in ('', None):
        return None
    return {'amountPesos': pesos(row[amount]), 'url': row[url] or None, 'source': label}


def scr_records(source, assets, classify, miagao_pattern):
    rows = []
    for row in source['rows']:
        if row['program'] not in PROGRAMS:
            continue
        title, house_title = row['title'], row['house_title']
        asset = next((item for key, item in assets.items() if key in title or key in house_title), None)
        if not miagao_pattern.search(title) and not miagao_pattern.search(house_title) and not asset:
            continue
        pap = row.get('pap') or ''
        category = ('Bridge' if asset else classify(title) or classify(pap)
                    or ('Flood control' if 'river control' in title.lower() else PROGRAMS[row['program']]))
        page = row['senate_page']
        house = stage(row, 'house_php', 'house_pdf_url', 'House 3rd reading')
        scr = stage(row, 'senate_php', 'senate_pdf_url', 'Senate Committee Report')
        if scr and not page:
            scr['url'] = house['url'] if house else None
            scr['source'] = 'House schedule carried into SCR' if house else 'SCR comparison data'
        rows.append({
            'id': row['id'], 'program': row['program'], 'category': category,
            'title': title, 'houseTitle': house_title or None, 'office': row.get('office') or None,
            'status': row['status_label'], 'barangays': [asset['barangay']] if asset and asset['barangay'] else [],
            'locationBasis': f"DPWH bridge inventory · {asset['id']} · {asset['barangay']}, Miagao, Iloilo"
            if asset else 'Miagao or Miag-ao in source title',
            'nep': stage(row, 'nep_php', 'nep_pdf_url', 'National Expenditure Program'),
            'house': house, 'scr': scr,
        })
    return sorted(rows, key=lambda row: (row['program'], row['title'].casefold(), row['id']))


def annual_groups(annual, snapshot, scr, assets, title_key, in_miagao):
    groups = defaultdict(dict)

    def add(group, row):
        identity = (row['year'], row['stage'], row['title'], row['amountPesos'], row['source'])
        groups[group].setdefault(identity, row)

    def annual_row(year, title, amount, reference, category):
        return {'year': year, 'stage': 'GAA', 'title': title, 'amountPesos': amount,
                'source': reference, 'url': None, 'category': category}

    seen_annual = set()
    for year, row in annual:
        title = row['name']
        key = title_key(title)
        seen_annual.add((year, key, row['amount']))
        add(key, annual_row(year, title, row['amount'], row['source'], row['category']))
    for row in snapshot['projects']:
        year, title, amount = row['year'], row['name'], row['amountPesos']
        if row['stage'] == 'GAA' and amount > 0 and in_miagao(title) and (year, title_key(title), amount) not in seen_annual:
            add(title_key(title), annual_row(year, title, amount, row['source'], row['category']))
    asset_keys = {}
    for asset_id, asset in assets.items():
        group = 'inventory ' + asset_id
        for year, rows in asset['years']:
            for row in rows:
                add(group, annual_row(year, row['title'], row['pesos'], row['source'], 'Bridge'))
                asset_keys[title_key(row['title'])] = group
    for row in scr:
        title = row['title']
        asset_id = next((asset_id for asset_id in assets if asset_id in title), None)
        for stage_key, stage_label in [('nep', 'NEP'), ('house', 'HGAB 3rd'), ('scr', 'SCR')]:
            value = row[stage_key]
            if not value or value['amountPesos'] <= 0:
                continue
            name = (row['houseTitle'] or title) if stage_key == 'house' else title
            if stage_key == 'nep' and row['status'] != 'NEP only':
                # The comparison can pair a different NEP title. Use the
                # original title supplied by the project browser for the bridge.
                asset_nep = next((item for item in assets.get(asset_id, {}).get('stages', [])
                                  if item['stage'] == '2027 NEP'), None)
                if not asset_nep:
                    continue
                name = asset_nep['title']
            group = 'inventory ' + asset_id if asset_id else asset_keys.get(title_key(name), title_key(name))
            if group in groups and (asset_id or in_miagao(name)):
                add(group, {**value, 'year': 2027, 'stage': stage_label, 'title': name, 'category': row['category']})

    result = []
    for group, lines in groups.items():
        occurrences = sorted(lines.values(), key=lambda row: (-row['year'], STAGE_ORDER[row['stage']], row['source']))
        years = sorted({row['year'] for row in occurrences}, reverse=True)
        if len(years) < 2:
            continue
        asset = assets.get(group.removeprefix('inventory '))
        latest = occurrences[0]
        result.append({
            'id': group, 'title': latest['title'], 'category': latest['category'],
            'method': (f"DPWH bridge inventory · {asset['id']} · {asset['barangay']}" if asset
                       else 'Matching title and place after removing trailing station and coordinate annotations'),
            'years': years, 'lines': occurrences,
            'gaaTotalPesos': sum(row['amountPesos'] for row in occurrences if row['stage'] == 'GAA'),
        })
    return sorted(result, key=lambda row: (-len(row['years']), -row['gaaTotalPesos'], row['title']))


def browser_assets(public, municipality_code):
    index = read(public / 'repeat-project-browser-data.json')
    town = next(node for node in index['geography'] if node[0] == municipality_code)
    assets = {}
    for offset in town[4]:
        part, position = divmod(offset, index['pageSize'])
        project = (read(public / index['pages'][part - 1]) if part else index['first'])[position]
        asset = project.get('bridgeAsset')
        if asset:
            assets[asset['id']] = {**project, **asset}
    return assets


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--nep-root', type=Path, default=ROOT.parent / 'nep')
    parser.add_argument('--preview-root', type=Path, default=ROOT.parent / 'open-data-visualization/static/nep-preview')
    args = parser.parse_args()
    sys.path.insert(0, str(args.nep_root.resolve()))
    from analyze_priority_repeats import classify, previous_rows
    from location_data.miagao_historical_repeats import CODE, MIAGAO, annual_rows, in_miagao, title_key
    from location_data.repeat_browser_places import RepeatPlaces

    public = args.preview_root
    source = read(public / 'scr-data.json')
    assets = browser_assets(public, CODE)
    scr = scr_records(source, assets, classify, MIAGAO)
    historical = previous_rows(list(range(2016, 2027)))
    local = read(DATA / 'miagao-projects.json')
    places = RepeatPlaces()
    repeats = annual_groups(annual_rows(historical, places), local, scr, assets,
                            title_key, partial(in_miagao, places=places))
    write('miagao-scr.json', {'rows': scr, 'programs': PROGRAMS,
                            'sourceUrl': 'https://research.bettergov.ph/static/nep-preview/scr.html'})
    write('miagao-repeats.json', {'firstYear': min(historical), 'lastGaaYear': max(historical), 'projects': repeats})
    print(f'Wrote {len(scr)} FY2027 comparison rows and {len(repeats)} historical repeat groups')


if __name__ == '__main__':
    main()
