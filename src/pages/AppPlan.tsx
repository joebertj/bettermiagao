import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDownToLine, ExternalLink, Search, X } from 'lucide-react';

type AppRow = {
  row: number;
  sectionOrProject: string | null;
  office: string | null;
  description: string | null;
  fund: string | null;
  budgetPesos: string | null;
  mode: string | null;
  procurementStart: string | null;
  procurementEnd: string | null;
  sourceUrl: string;
  sourceSheet: string;
};
type Manifest = { appRowShards: { url: string }[]; appRowCount: number };

const basePath = `${import.meta.env.BASE_URL}data/miagao-disclosure/`;
const officialApp =
  'https://www.miagao.gov.ph/wp-content/uploads/2026/06/CONSOLIDATED-APP-2026.xlsx';
const categoryPattern = /^\s*[A-Z]\.\s*[A-Z]/i;
const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

function money(raw: string | null | undefined) {
  const cleaned = String(raw ?? '')
    .replace(/[₱,\s]/g, '')
    .replace(/^P/i, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function downloadRows(rows: AppRow[], format: 'json' | 'csv') {
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
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `miagao-fy2026-app.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Bars({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(...rows.map(row => row.value), 1);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-lg font-bold text-slate-950">{title}</h2>
      <div className="space-y-3">
        {rows.map(row => (
          <div key={row.label}>
            <div className="mb-1 flex items-start justify-between gap-3 text-xs">
              <span className="min-w-0 break-words text-slate-700">
                {row.label}
              </span>
              <strong className="shrink-0 tabular-nums text-slate-950">
                {peso.format(row.value)}
              </strong>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-blue-800"
                style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-slate-500">No rows.</p>}
      </div>
    </section>
  );
}

function Pager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const count = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        Rows per page
        <select
          value={pageSize}
          onChange={event => onPageSize(Number(event.target.value))}
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
        {total ? page * pageSize + 1 : 0}–
        {Math.min(total, (page + 1) * pageSize)} of {total} · Page {page + 1} of{' '}
        {count}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPage(Math.max(0, page - 1))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page + 1 >= count}
          onClick={() => onPage(Math.min(count - 1, page + 1))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function BreakdownCell({
  rows,
  onOpen,
}: {
  rows: AppRow[];
  onOpen: () => void;
}) {
  return rows.length ? (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex min-h-9 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-left text-xs font-bold text-blue-800 hover:border-blue-400 hover:bg-blue-100"
      aria-label={`View ${rows.length} supporting APP rows`}
    >
      View {rows.length} line items
    </button>
  ) : (
    <span className="text-slate-400">—</span>
  );
}

function Cell({
  children,
  right = false,
}: {
  children: ReactNode;
  right?: boolean;
}) {
  return (
    <td
      className={`break-words p-2 align-top ${right ? 'text-right tabular-nums' : ''}`}
    >
      {children}
    </td>
  );
}

export default function AppPlan() {
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [selectedDetails, setSelectedDetails] = useState<{
    parent: AppRow;
    rows: AppRow[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${basePath}budget-app/manifest.json`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<Manifest>;
      })
      .then(async manifest => {
        const shards = await Promise.all(
          manifest.appRowShards.map(async shard => {
            const href = shard.url.startsWith('/')
              ? shard.url
              : `${basePath}${shard.url}`;
            const response = await fetch(href);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json() as Promise<{ rows: AppRow[] }>;
          })
        );
        return shards.flatMap(shard => shard.rows);
      })
      .then(value => {
        if (active) {
          setRows(value);
          setError('');
        }
      })
      .catch(reason => {
        if (active)
          setError(`Could not load the APP rows (${String(reason)}).`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedDetails) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedDetails(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedDetails]);

  const selectedDetailSummary = selectedDetails
    ? (() => {
        const values = selectedDetails.rows.map(row => money(row.budgetPesos));
        const priced = values.filter(
          (value): value is number => value !== null
        );
        const parentEstimate = money(selectedDetails.parent.budgetPesos);
        return {
          total: priced.reduce((sum, value) => sum + value, 0),
          pricedCount: priced.length,
          missingCount: values.length - priced.length,
          parentEstimate,
          difference:
            values.length === priced.length && parentEstimate !== null
              ? priced.reduce((sum, value) => sum + value, 0) - parentEstimate
              : null,
        };
      })()
    : null;

  const normalizedQuery = query.trim().toLowerCase();
  const siblings = useMemo(
    () =>
      rows.filter(
        row =>
          row.office === "MAYOR'S OFFICE" &&
          row.sectionOrProject ===
            'GENERAL ADMINISTRATION AND SUPPORT SERVICES' &&
          categoryPattern.test(row.description ?? '')
      ),
    [rows]
  );
  const categoryChart = siblings
    .map(row => ({
      label: row.description ?? '',
      value: money(row.budgetPesos) ?? 0,
    }))
    .sort((a, b) => b.value - a.value);
  const largestRows = [...rows]
    .filter(row => (money(row.budgetPesos) ?? 0) > 0)
    .sort((a, b) => (money(b.budgetPesos) ?? 0) - (money(a.budgetPesos) ?? 0))
    .slice(0, 8)
    .map(row => ({
      label: row.description ?? row.sectionOrProject ?? `Row ${row.row}`,
      value: money(row.budgetPesos) ?? 0,
    }));

  const breakdownFor = useCallback(
    (parent: AppRow) => {
      if (!categoryPattern.test(parent.description ?? '')) return [];
      const start = rows.findIndex(row => row.row === parent.row);
      const children: AppRow[] = [];
      for (const row of rows.slice(start + 1)) {
        if (
          row.office !== parent.office ||
          row.sectionOrProject !== parent.sectionOrProject
        )
          break;
        if (categoryPattern.test(row.description ?? '')) break;
        children.push(row);
      }
      return children;
    },
    [rows]
  );

  const rowMatches = useCallback(
    (row: AppRow) =>
      [row.row, row.sectionOrProject, row.office, row.description, row.fund]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    [normalizedQuery]
  );
  const nestedDetailIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of rows) {
      if (categoryPattern.test(row.description ?? '')) {
        for (const child of breakdownFor(row)) ids.add(child.row);
      }
    }
    return ids;
  }, [rows, breakdownFor]);
  const visibleRows = useMemo(
    () =>
      rows.filter(row => {
        if (nestedDetailIds.has(row.row)) return false;
        if (!normalizedQuery || rowMatches(row)) return true;
        return (
          categoryPattern.test(row.description ?? '') &&
          breakdownFor(row).some(rowMatches)
        );
      }),
    [rows, nestedDetailIds, normalizedQuery, rowMatches, breakdownFor]
  );
  const matchingSourceRows = useMemo(
    () => rows.filter(row => !normalizedQuery || rowMatches(row)),
    [rows, normalizedQuery, rowMatches]
  );
  const currentRows = visibleRows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 max-w-4xl">
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-blue-800">
          Budget & procurement · FY2026
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
          Annual Procurement Plan
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The APP lists planned procurement and estimates. Expand a category to
          inspect its following source rows; listed estimates are not proof of
          procurement or spending.
        </p>
      </header>

      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>
      )}
      {loading && (
        <p className="rounded-xl bg-white p-5 text-slate-600">
          Loading APP rows…
        </p>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Bars
              title="APP rows with a recorded estimate · top 8"
              rows={largestRows}
            />
            <Bars
              title="Mayor’s Office · lettered estimates in General Administration and Support Services"
              rows={categoryChart}
            />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  FY2026 APP source rows
                </h2>
                <p className="text-sm text-slate-600">
                  {visibleRows.length.toLocaleString()} displayed rows ·
                  unlettered lines nested under lettered headings are in the
                  drill-down. Exports retain matching source rows.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={officialApp}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                >
                  Official APP <ExternalLink size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => downloadRows(matchingSourceRows, 'json')}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-800 px-3 py-2 text-sm font-bold text-white hover:bg-blue-900"
                >
                  <ArrowDownToLine size={15} /> JSON
                </button>
                <button
                  type="button"
                  onClick={() => downloadRows(matchingSourceRows, 'csv')}
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
                placeholder="Search description, office, project, or account code"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <Pager
              page={page}
              pageSize={pageSize}
              total={visibleRows.length}
              onPage={setPage}
              onPageSize={size => {
                setPageSize(size);
                setPage(0);
              }}
            />
            <div className="w-full">
              <table className="w-full table-fixed text-left text-xs sm:text-sm">
                <colgroup>
                  <col className="w-[7%]" />
                  <col className="w-[37%]" />
                  <col className="w-[13%]" />
                  <col className="w-[14%]" />
                  <col className="w-[13%]" />
                  <col className="w-[16%]" />
                </colgroup>
                <thead className="bg-slate-900 text-white">
                  <tr>
                    {[
                      'Row',
                      'Description',
                      'Office',
                      'Account code',
                      'Estimate',
                      'Drill down',
                    ].map(label => (
                      <th key={label} className="break-words p-2 font-semibold">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentRows.map(row => {
                    const children = breakdownFor(row);
                    return (
                      <tr
                        key={row.row}
                        className="border-b border-slate-100 align-top"
                      >
                        <Cell>{row.row}</Cell>
                        <Cell>
                          {row.description || row.sectionOrProject || '—'}
                        </Cell>
                        <Cell>{row.office || '—'}</Cell>
                        <Cell>{row.fund || '—'}</Cell>
                        <Cell right>
                          {row.budgetPesos
                            ? peso.format(money(row.budgetPesos) ?? 0)
                            : '—'}
                        </Cell>
                        <Cell>
                          <BreakdownCell
                            rows={children}
                            onOpen={() =>
                              setSelectedDetails({
                                parent: row,
                                rows: children,
                              })
                            }
                          />
                        </Cell>
                      </tr>
                    );
                  })}
                  {!currentRows.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-5 text-center text-slate-600"
                      >
                        No APP rows match this search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pager
              page={page}
              pageSize={pageSize}
              total={visibleRows.length}
              onPage={setPage}
              onPageSize={size => {
                setPageSize(size);
                setPage(0);
              }}
            />
          </section>
        </div>
      )}
      {selectedDetails && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-3 sm:p-6"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setSelectedDetails(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-detail-title"
            className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-7">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-800">
                  FY2026 APP · supporting lines
                </p>
                <h2
                  id="app-detail-title"
                  className="mt-2 break-words text-xl font-bold text-slate-950 sm:text-2xl"
                >
                  {selectedDetails.parent.description}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {selectedDetails.parent.office || 'Office not stated'} ·{' '}
                  {selectedDetails.parent.sectionOrProject ||
                    'Project not stated'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetails(null)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                aria-label="Close supporting rows"
              >
                <X size={18} />
              </button>
            </header>
            <div className="overflow-y-auto p-4 sm:p-7">
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <strong className="text-slate-900">
                  {selectedDetails.rows.length} supporting line items
                </strong>
                <div className="mt-2 grid gap-1 text-slate-700 sm:grid-cols-2">
                  <span>
                    Heading estimate:{' '}
                    {selectedDetailSummary?.parentEstimate === null
                      ? 'not stated'
                      : peso.format(selectedDetailSummary?.parentEstimate ?? 0)}
                  </span>
                  <span>
                    Sum of stated line estimates:{' '}
                    {peso.format(selectedDetailSummary?.total ?? 0)}
                    {selectedDetailSummary?.missingCount ? ' (partial)' : ''}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  {selectedDetailSummary?.difference === null
                    ? `Cannot fully compare: ${selectedDetailSummary?.missingCount ?? 0} line estimate(s) or the heading estimate are missing.`
                    : Math.abs(selectedDetailSummary?.difference ?? 0) < 0.005
                      ? 'The line estimates match the heading estimate.'
                      : `The line estimates are ${peso.format(Math.abs(selectedDetailSummary?.difference ?? 0))} ${(selectedDetailSummary?.difference ?? 0) > 0 ? 'above' : 'below'} the heading estimate.`}
                </p>
              </div>
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                {selectedDetails.rows.map(row => (
                  <article
                    key={row.row}
                    className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6"
                  >
                    <div className="min-w-0">
                      <p className="whitespace-pre-line break-words font-medium leading-6 text-slate-900">
                        {row.description || 'Unlabeled source row'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Source row {row.row} · {row.sourceSheet}
                      </p>
                    </div>
                    <strong className="text-left tabular-nums text-slate-900 sm:text-right">
                      {row.budgetPesos
                        ? peso.format(money(row.budgetPesos) ?? 0)
                        : 'Estimate not stated'}
                    </strong>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
