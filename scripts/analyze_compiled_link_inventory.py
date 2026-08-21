from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/home/ubuntu/classify_compiled_cad_ai_links.csv')
JSON_OUTPUT = ROOT / 'docs' / 'compiled_link_inventory.json'
MARKDOWN_OUTPUT = ROOT / 'docs' / 'compiled_link_inventory.md'


def main() -> None:
    with SOURCE.open(newline='', encoding='utf-8') as stream:
        rows = list(csv.DictReader(stream))

    access_counts = Counter(row['Access Status'] for row in rows)
    category_counts = Counter(
        row['Evidence Category']
        for row in rows
        if row['Access Status'] == 'ACCESSIBLE'
    )
    names_by_category: dict[str, list[str]] = defaultdict(list)
    unavailable: list[dict[str, str]] = []

    for row in rows:
        if row['Access Status'] == 'ACCESSIBLE':
            names_by_category[row['Evidence Category']].append(row['Filename'])
        else:
            unavailable.append({
                'url': row['URL'],
                'status': row['Access Status'],
                'error': row['Error'] or row['Technical Summary'],
            })

    payload = {
        'total_links': len(rows),
        'access_counts': dict(sorted(access_counts.items())),
        'accessible_category_counts': dict(sorted(category_counts.items())),
        'accessible_filenames_by_category': {
            category: sorted(set(names))
            for category, names in sorted(names_by_category.items())
        },
        'unavailable_links': unavailable,
    }
    JSON_OUTPUT.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')

    lines = [
        '# Compiled Shared-Link Inventory',
        '',
        'This index is generated from passive retrieval of the compiled Manus share links. An accessible file establishes only visible source or test provenance; it does not establish production runtime readiness.',
        '',
        '## Access Summary',
        '',
        '| Access Status | Count |',
        '|---|---:|',
    ]
    for status, count in sorted(access_counts.items()):
        lines.append(f'| {status} | {count} |')

    lines.extend([
        '',
        '## Accessible Evidence by Category',
        '',
        '| Category | Files |',
        '|---|---:|',
    ])
    for category, count in sorted(category_counts.items()):
        lines.append(f'| {category} | {count} |')

    lines.extend([
        '',
        '## Accessible File Index',
        '',
        '| Category | Filenames |',
        '|---|---|',
    ])
    for category, names in sorted(names_by_category.items()):
        lines.append(f"| {category} | {', '.join(sorted(set(names)))} |")

    lines.extend([
        '',
        '## Retrieval Limitation',
        '',
        f"{len(unavailable)} compiled links were unavailable at passive retrieval time. Their filenames and contents are classified as **UNKNOWN** and are not used as project or readiness evidence.",
        '',
        'The raw, row-level scan is preserved in `compiled_link_inventory.json`.',
        '',
    ])
    MARKDOWN_OUTPUT.write_text('\n'.join(lines), encoding='utf-8')


if __name__ == '__main__':
    main()
