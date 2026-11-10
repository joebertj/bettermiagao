import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ExternalLink,
  HeartHandshake,
  Search,
} from 'lucide-react';
import { Link } from 'react-router';

const official = 'https://www.miagao.gov.ph';

type AidRecord = {
  program: string;
  record: string;
  period: string;
  amount: number | null;
  amountLabel: string;
  recipients: string;
  note: string;
  sourceLabel: string;
  sourceUrl: string;
};

const aidRecords: AidRecord[] = [
  {
    program: 'Senior citizen social pension',
    record: 'Q3 trust-fund utilization',
    period: 'As of September 30, 2026',
    amount: 34_494_000,
    amountLabel: '₱34,494,000 total cost · ₱17,355,000 incurred',
    recipients: 'Not stated',
    note: 'Trust-fund project line; not a verified recipient count.',
    sourceLabel: 'Q3 trust-fund utilization',
    sourceUrl: `${official}/wp-content/uploads/2026/10/Trust-Fund-Utilization-as-of-September-30-2026-F.xlsx`,
  },
  {
    program: 'Assistance to Individuals in Crisis Situation (AICS)',
    record: 'Q3 consolidated program report',
    period: 'January–December 2026',
    amount: 2_704_000,
    amountLabel: '₱2,704,000 total cost · ₱2,300,000 incurred',
    recipients: 'Not stated',
    note: 'Continuing program · 85.05% reported completion; not a beneficiary roster or aid-release count.',
    sourceLabel: 'MSWDO worksheet, rows 10–11',
    sourceUrl: `${official}/wp-content/uploads/2026/10/consolidated-report-3rd-qtr-2026-1.xlsx`,
  },
  {
    program: 'Presidential Assistance for Farmers and Fisherfolk (PAFF)',
    record: 'Reported distribution',
    period: 'November 6, 2026',
    amount: 476_625,
    amountLabel: '₱476,625 implied batch total · ₱2,325 each',
    recipients: '205 fisherfolk',
    note: 'Recipients × stated per-person amount. Distribution report; not a municipal appropriation or funding split.',
    sourceLabel: 'Official PAFF distribution report',
    sourceUrl: `${official}/about-miagao/news/%F0%9D%97%A0%F0%9D%97%94%F0%9D%97%AC%F0%9D%97%A2%F0%9D%97%A5-%F0%9D%97%9A%F0%9D%97%94%F0%9D%97%A5%F0%9D%97%9C%F0%9D%97%A1-%F0%9D%97%9F%F0%9D%97%98%F0%9D%97%94%F0%9D%97%97%F0%9D%97%A6-%F0%9D%97%A3/`,
  },
  {
    program: 'TUPAD',
    record: 'Reported salary distribution · 10 workdays',
    period: 'May 14, 2026',
    amount: null,
    amountLabel: 'Not stated',
    recipients: '320 beneficiaries',
    note: 'The municipal post reports 10 workdays but does not state the wage amount.',
    sourceLabel: 'Official 320-beneficiary report',
    sourceUrl: `${official}/about-miagao/news/%F0%9D%97%97%F0%9D%97%A2%F0%9D%97%9F%F0%9D%97%98-%F0%9D%97%A7%F0%9D%97%A8%F0%9D%97%A3%F0%9D%97%94%F0%9D%97%97-%F0%9D%97%95%F0%9D%97%98%F0%9D%97%A1%F0%9D%97%98%F0%9D%97%99%F0%9D%97%9C%F0%9D%97%96/`,
  },
  {
    program: 'TUPAD',
    record: 'Reported wage distribution · 10 workdays',
    period: 'July 3, 2026',
    amount: 874_500,
    amountLabel: '₱874,500 implied batch total · ₱5,500 each',
    recipients: '159 beneficiaries',
    note: 'Recipients × stated per-person wage. One cohort, not a full-year TUPAD allocation.',
    sourceLabel: 'Official TUPAD distribution report',
    sourceUrl: `${official}/about-miagao/news/dole-tupad-beneficiaries-receive-p5500-wages/`,
  },
  {
    program: 'Pantawid Pamilya',
    record: 'Q3 MSWDO program line',
    period: 'Q3 2026',
    amount: 90_000,
    amountLabel: '₱90,000 total cost · ₱36,000 incurred',
    recipients: 'Not stated',
    note: 'Program-line cost, not the value of household cash transfers.',
    sourceLabel: '2026 Full Disclosure index',
    sourceUrl: `${official}/transparency/2026-full-disclosure/`,
  },
];

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

function exportRecords(rows: AidRecord[], format: 'json' | 'csv') {
  const content =
    format === 'json'
      ? JSON.stringify(rows, null, 2)
      : [
          Object.keys(rows[0] ?? {}).join(','),
          ...rows.map(row =>
            Object.values(row)
              .map(value => `"${String(value ?? '').replaceAll('"', '""')}"`)
              .join(',')
          ),
        ].join('\r\n');
  const blob = new Blob([content], {
    type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `miagao-ayuda-records.${format}`;
  anchor.click();
  URL.revokeObjectURL(href);
}

export default function Ayuda() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const matchingRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return aidRecords;
    return aidRecords.filter(row =>
      Object.values(row).join(' ').toLowerCase().includes(term)
    );
  }, [query]);
  const chartRows = matchingRows
    .filter((row): row is AidRecord & { amount: number } => row.amount !== null)
    .sort((a, b) => b.amount - a.amount);
  const maximumAmount = Math.max(...chartRows.map(row => row.amount), 1);
  const pageRows = matchingRows.slice(page * pageSize, (page + 1) * pageSize);
  const pageCount = Math.max(1, Math.ceil(matchingRows.length / pageSize));

  return (
    <main className="flex-1">
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">
            <HeartHandshake size={17} /> Public assistance records
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Ayuda programs
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-200">
            Compare published program costs and reported assistance
            distributions. Budget and incurred amounts are distinct from
            recipient payouts; implied batch totals are calculated from the
            reported recipient count and per-person amount.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <section
          aria-labelledby="ayuda-chart-title"
          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        >
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">
              Amounts in cited records
            </p>
            <h2
              id="ayuda-chart-title"
              className="mt-1 text-xl font-bold text-slate-950"
            >
              Reported or implied amount by program
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Scale comparison only: total program costs, incurred amounts, and
              distribution batch totals are different measures. Search filters
              both the chart and table.
            </p>
          </div>
          <div className="space-y-4">
            {chartRows.map(row => (
              <div
                key={`${row.program}-${row.record}`}
                className="grid gap-1 sm:grid-cols-[minmax(11rem,0.8fr)_minmax(0,2fr)_auto] sm:items-center sm:gap-4"
              >
                <span className="text-sm font-semibold text-slate-800">
                  {row.program}
                </span>
                <div
                  className="h-3 overflow-hidden rounded-full bg-slate-100"
                  role="img"
                  aria-label={`${row.program}: ${peso.format(row.amount)}`}
                >
                  <div
                    className="h-full rounded-full bg-blue-800"
                    style={{
                      width: `${Math.max(1.5, (row.amount / maximumAmount) * 100)}%`,
                    }}
                  />
                </div>
                <strong className="text-sm tabular-nums text-slate-950 sm:text-right">
                  {peso.format(row.amount)}
                </strong>
              </div>
            ))}
            {!chartRows.length && (
              <p className="text-sm text-slate-600">No amount records match.</p>
            )}
          </div>
        </section>

        <section
          aria-labelledby="ayuda-table-title"
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                id="ayuda-table-title"
                className="text-xl font-bold text-slate-950"
              >
                Program records
              </h2>
              <p className="text-sm text-slate-600">
                {matchingRows.length} records · one row per reported program
                figure
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => exportRecords(matchingRows, 'json')}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-800 px-3 py-2 text-sm font-bold text-white hover:bg-blue-900"
              >
                <ArrowDownToLine size={15} /> JSON
              </button>
              <button
                type="button"
                onClick={() => exportRecords(matchingRows, 'csv')}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-800 px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50"
              >
                <ArrowDownToLine size={15} /> CSV
              </button>
            </div>
          </div>

          <label className="flex min-h-10 max-w-xl items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
            <Search size={16} className="shrink-0 text-slate-500" />
            <input
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder="Search program, period, or source"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Rows per page
              <select
                value={pageSize}
                onChange={event => {
                  setPageSize(Number(event.target.value));
                  setPage(0);
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-900"
              >
                {[10, 20, 50].map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-sm text-slate-600">
              {matchingRows.length
                ? `${page * pageSize + 1}–${Math.min(matchingRows.length, (page + 1) * pageSize)} of ${matchingRows.length} · Page ${page + 1} of ${pageCount}`
                : '0 records'}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(value => Math.max(0, value - 1))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page + 1 >= pageCount}
                onClick={() =>
                  setPage(value => Math.min(pageCount - 1, value + 1))
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>

          <table className="w-full table-fixed text-left text-xs sm:text-sm">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[16%]" />
              <col className="w-[25%]" />
              <col className="w-[13%]" />
              <col className="w-[26%]" />
            </colgroup>
            <thead className="bg-slate-900 text-white">
              <tr>
                {[
                  'Program',
                  'Record · period',
                  'Amount reported',
                  'Recipients',
                  'Source and note',
                ].map(label => (
                  <th
                    key={label}
                    className="break-words p-2 font-semibold sm:p-3"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map(row => (
                <tr
                  key={`${row.program}-${row.record}`}
                  className="border-b border-slate-100 align-top odd:bg-white even:bg-slate-50"
                >
                  <td className="break-words p-2 font-semibold text-slate-900 sm:p-3">
                    {row.program}
                  </td>
                  <td className="break-words p-2 text-slate-700 sm:p-3">
                    {row.record}
                    <span className="mt-1 block text-slate-500">
                      {row.period}
                    </span>
                  </td>
                  <td className="break-words p-2 text-slate-800 sm:p-3">
                    {row.amountLabel}
                  </td>
                  <td className="break-words p-2 text-slate-700 sm:p-3">
                    {row.recipients}
                  </td>
                  <td className="break-words p-2 text-slate-700 sm:p-3">
                    <a
                      href={row.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-blue-800 underline decoration-blue-300 underline-offset-4 hover:text-blue-950"
                    >
                      {row.sourceLabel} <ExternalLink size={13} />
                    </a>
                    <span className="mt-1 block text-xs leading-5 text-slate-600">
                      {row.note}
                    </span>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={5} className="p-5 text-center text-slate-600">
                    No records match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <Link
          to="/transparency"
          className="inline-block font-semibold text-blue-800 underline"
        >
          Browse all budget and procurement records
        </Link>
      </div>
    </main>
  );
}
