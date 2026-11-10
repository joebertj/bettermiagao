import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDownToLine, ExternalLink, Search } from 'lucide-react';

type Tab = 'budget' | 'execution' | 'bettergov';
type RecordData = Record<string, unknown>;
type Column = { label: string; align?: 'left' | 'right' };
type DataRow = { id: string; cells: ReactNode[]; searchText?: string };
type PageKey =
  'offices' | 'app' | 'bids' | 'sre' | 'progress' | 'crosswalk' | 'research';

const files: Record<Tab, string> = {
  budget: 'budget-app/manifest.json',
  execution: 'q1-execution.json',
  bettergov: 'bettergov-project-and-place-records.json',
};
const basePath = `${import.meta.env.BASE_URL}data/miagao-disclosure/`;
const defaultPageSize = 20;

function amount(raw: unknown) {
  const value = Number(
    String(raw ?? '')
      .replace(/[₱,\s]/g, '')
      .replace(/^P/i, '')
  );
  return Number.isFinite(value) ? value : null;
}

function pesos(raw: unknown) {
  const value = amount(raw);
  return value === null
    ? '—'
    : new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        maximumFractionDigits: 0,
      }).format(value);
}

function display(raw: unknown) {
  return raw === null || raw === undefined || raw === '' ? '—' : String(raw);
}

function download(name: string, rows: RecordData[], format: 'json' | 'csv') {
  const text =
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
  const blob = new Blob([text], {
    type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
  });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `${name}.${format}`;
  link.click();
  URL.revokeObjectURL(href);
}

function ExportButtons({ name, rows }: { name: string; rows: RecordData[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => download(name, rows, 'json')}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-800 px-3 py-2 text-sm font-bold text-white hover:bg-blue-900"
      >
        <ArrowDownToLine size={15} /> JSON
      </button>
      <button
        type="button"
        onClick={() => download(name, rows, 'csv')}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-800 px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50"
      >
        <ArrowDownToLine size={15} /> CSV
      </button>
    </div>
  );
}

function ResponsiveTable({
  columns,
  rows,
}: {
  columns: Column[];
  rows: DataRow[];
}) {
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {rows.map(row => (
          <article
            key={row.id}
            className="rounded-xl border border-slate-200 p-3"
          >
            {row.cells.map((cell, index) => (
              <div
                key={`${row.id}-${columns[index].label}`}
                className="grid grid-cols-[minmax(5.5rem,0.7fr)_minmax(0,1.3fr)] gap-2 border-b border-slate-100 py-2 last:border-0"
              >
                <span className="text-xs font-semibold text-slate-500">
                  {columns[index].label}
                </span>
                <span className="break-words text-sm text-slate-900">
                  {cell}
                </span>
              </div>
            ))}
          </article>
        ))}
      </div>
      <table className="hidden w-full table-fixed text-left text-sm md:table">
        <thead className="bg-slate-900 text-white">
          <tr>
            {columns.map(column => (
              <th
                key={column.label}
                className={`break-words p-2 font-semibold ${column.align === 'right' ? 'text-right' : ''}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-slate-100 align-top">
              {row.cells.map((cell, index) => (
                <td
                  key={`${row.id}-${columns[index].label}`}
                  className={`break-words p-2 ${columns[index].align === 'right' ? 'text-right tabular-nums' : ''}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Pager({
  page,
  setPage,
  pageSize,
  setPageSize,
  total,
}: {
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total ? page * pageSize + 1 : 0;
  const last = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        Rows per page
        <select
          value={pageSize}
          onChange={event => {
            setPageSize(Number(event.target.value));
            setPage(0);
          }}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-800"
        >
          {[10, 20, 50].map(size => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <span className="text-sm text-slate-600">
        {first}–{last} of {total} · Page {page + 1} of {pages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage(Math.max(0, page - 1))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page + 1 >= pages}
          onClick={() => setPage(Math.min(pages - 1, page + 1))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex min-h-10 min-w-0 max-w-xl items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
      <Search size={16} className="shrink-0 text-slate-500" />
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
    </label>
  );
}

function Bars({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; display: string }[];
}) {
  const max = Math.max(...rows.map(row => row.value), 1);
  return (
    <section className="rounded-xl bg-slate-50 p-4" aria-label={title}>
      <h3 className="mb-3 text-sm font-bold text-slate-800">{title}</h3>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`}>
            <div className="mb-1 flex items-start justify-between gap-3 text-xs">
              <span className="min-w-0 break-words text-slate-700">
                {row.label}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                {row.display}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-blue-800"
                style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PairedBars({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; first: number; second: number }[];
}) {
  const max = Math.max(...rows.flatMap(row => [row.first, row.second]), 1);
  return (
    <section className="rounded-xl bg-slate-50 p-4" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <div className="flex gap-3 text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-sm bg-blue-800" /> ABC
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-sm bg-cyan-500" /> Bid
          </span>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`}>
            <p className="mb-1 break-words text-xs text-slate-700">
              {row.label}
            </p>
            <div className="space-y-1">
              {[
                { key: 'abc', value: row.first, color: 'bg-blue-800' },
                { key: 'bid', value: row.second, color: 'bg-cyan-500' },
              ].map(series => (
                <div key={series.key} className="flex items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-slate-200">
                    <div
                      className={`h-2 rounded-full ${series.color}`}
                      style={{
                        width: `${Math.max(2, (series.value / max) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-24 text-right text-[11px] tabular-nums text-slate-700">
                    {pesos(series.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children} <ExternalLink size={14} />
    </a>
  );
}

export default function Transparency() {
  const [tab, setTab] = useState<Tab>('budget');
  const [data, setData] = useState<RecordData | null>(null);
  const [loadedTab, setLoadedTab] = useState<Tab | null>(null);
  const [loadError, setLoadError] = useState<{
    tab: Tab;
    message: string;
  } | null>(null);
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [pages, setPages] = useState<Record<PageKey, number>>({
    offices: 0,
    app: 0,
    bids: 0,
    sre: 0,
    progress: 0,
    crosswalk: 0,
    research: 0,
  });

  useEffect(() => {
    let live = true;
    fetch(`${basePath}${files[tab]}`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(async value => {
        if (tab !== 'budget') return value;
        const manifest = value as {
          appRowShards: { url: string }[];
          annualBudget: RecordData;
          appRowCount: number;
        };
        const shards = await Promise.all(
          manifest.appRowShards.map(async shard => {
            const url = shard.url.startsWith('/')
              ? shard.url
              : `${basePath}${shard.url}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json() as Promise<{ rows: RecordData[] }>;
          })
        );
        return {
          annualBudget: manifest.annualBudget,
          appRows: shards.flatMap(shard => shard.rows),
          appRowCount: manifest.appRowCount,
        };
      })
      .then(value => {
        if (live) {
          setData(value as RecordData);
          setLoadedTab(tab);
          setLoadError(null);
        }
      })
      .catch(reason => {
        if (live) {
          setLoadError({
            tab,
            message: `Could not load this dataset (${String(reason)}).`,
          });
        }
      });
    return () => {
      live = false;
    };
  }, [tab]);
  const error = loadError?.tab === tab ? loadError.message : '';
  const dataReady = loadedTab === tab && data !== null;

  const setTablePage = (key: PageKey, page: number) =>
    setPages(previous => ({ ...previous, [key]: page }));
  const resetPages = () =>
    setPages({
      offices: 0,
      app: 0,
      bids: 0,
      sre: 0,
      progress: 0,
      crosswalk: 0,
      research: 0,
    });

  const appRows = (data?.appRows as RecordData[] | undefined) ?? [];
  const bidRows = (data?.bidResultsQ1 as RecordData[] | undefined) ?? [];
  const sreRows = (data?.sreQ1Rows as RecordData[] | undefined) ?? [];
  const progressRows = (data?.q1ProgressRows as RecordData[] | undefined) ?? [];
  const betterGovRows = (data?.records as RecordData[] | undefined) ?? [];
  const crosswalkRows =
    (data?.projectTrackingCases as RecordData[] | undefined) ?? [];
  const officeRows =
    ((data?.annualBudget as RecordData | undefined)
      ?.officeAndGroupAppropriations as RecordData[] | undefined) ?? [];
  const searchText = query.trim().toLowerCase();

  const filter = (rows: RecordData[], fields: string[]) =>
    rows.filter(
      row =>
        !searchText ||
        fields
          .map(field => String(row[field] ?? ''))
          .join(' ')
          .toLowerCase()
          .includes(searchText)
    );
  const visibleOffices = filter(officeRows, ['officeOrGroup']);
  const visibleApps = filter(appRows, [
    'description',
    'office',
    'fund',
    'sectionOrProject',
  ]);
  const visibleBids = filter(bidRows, [
    'title',
    'reference',
    'location',
    'winningBidder',
  ]);
  const visibleSre = filter(sreRows, ['particulars']);
  const visibleProgress = filter(progressRows, ['title', 'office', 'location']);
  const visibleResearch = filter(betterGovRows, [
    'source',
    'recordType',
    'title',
    'year',
    'stage',
    'category',
    'sourceReference',
  ]);
  const visibleCrosswalk = filter(crosswalkRows, [
    'projectTitle',
    'procurementPlan',
    'reportedQ1ProgressOrCostIncurred',
  ]);
  const pageRows = (key: PageKey, rows: RecordData[]) =>
    rows.slice(pages[key] * pageSize, (pages[key] + 1) * pageSize);
  const pageControl = (key: PageKey, rows: RecordData[]) => (
    <Pager
      page={pages[key]}
      setPage={page => setTablePage(key, page)}
      pageSize={pageSize}
      setPageSize={size => {
        setPageSize(size);
        resetPages();
      }}
      total={rows.length}
    />
  );

  const officeChart = [...officeRows]
    .map(row => ({
      label: String(row.officeOrGroup),
      value: amount(row.totalPesos) ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map(row => ({ ...row, display: pesos(row.value) }));
  const appChart = [...appRows]
    .map(row => ({
      label: String(row.description ?? row.sectionOrProject ?? 'Unlabeled row'),
      value: amount(row.budgetPesos) ?? 0,
    }))
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map(row => ({ ...row, display: pesos(row.value) }));
  const progressChart = [...progressRows]
    .map(row => ({
      label: String(row.title ?? row.office),
      value: amount(row.costIncurredToDateRaw) ?? 0,
    }))
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map(row => ({ ...row, display: pesos(row.value) }));
  const bidChart = bidRows
    .map(row => ({
      label: String(row.title),
      first: amount(row.approvedBudgetPesos) ?? 0,
      second: amount(row.bidAmountPesos) ?? 0,
    }))
    .filter(row => row.first > 0 || row.second > 0);
  const sreChart = sreRows
    .filter(row => Number(row.row) >= 29 && Number(row.row) <= 36)
    .map(row => ({
      label: String(row.particulars),
      value: amount(row.total) ?? 0,
    }))
    .map(row => ({ ...row, display: pesos(row.value) }));
  const sourceCounts = Object.entries(
    betterGovRows.reduce<Record<string, number>>((counts, row) => {
      const source = String(row.source ?? 'Unlabeled source');
      counts[source] = (counts[source] ?? 0) + 1;
      return counts;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, display: String(value) }));

  const officeTableRows = pageRows('offices', visibleOffices).map(
    (row, index) => ({
      id: `office-${row.sourceRow}-${index}`,
      cells: [
        display(row.officeOrGroup),
        pesos(row.personalServices),
        pesos(row.mooe),
        pesos(row.capitalOutlay),
        pesos(row.totalPesos),
      ],
    })
  );
  const appTableRows = pageRows('app', visibleApps).map((row, index) => ({
    id: `app-${row.row}-${index}`,
    cells: [
      display(row.row),
      display(row.description ?? row.sectionOrProject),
      display(row.office),
      display(row.fund),
      pesos(row.budgetPesos),
    ],
  }));
  const bidTableRows = pageRows('bids', visibleBids).map((row, index) => ({
    id: `bid-${row.reference}-${index}`,
    cells: [
      display(row.reference),
      display(row.title),
      display(row.location),
      pesos(row.approvedBudgetPesos),
      display(row.winningBidder),
      pesos(row.bidAmountPesos),
    ],
  }));
  const sreTableRows = pageRows('sre', visibleSre).map((row, index) => ({
    id: `sre-${row.row}-${index}`,
    cells: [
      display(row.particulars),
      pesos(row.budgetOrIncomeTarget),
      pesos(row.generalFund),
      pesos(row.sef),
      pesos(row.total),
    ],
  }));
  const progressTableRows = pageRows('progress', visibleProgress).map(
    (row, index) => ({
      id: `progress-${row.departmentSheet}-${row.row}-${index}`,
      cells: [
        display(row.office ?? row.departmentSheet),
        display(row.title),
        display(row.location),
        pesos(row.totalCostRaw),
        display(row.percentCompleteRaw),
        pesos(row.costIncurredToDateRaw),
      ],
    })
  );
  const crosswalkTableRows = pageRows('crosswalk', visibleCrosswalk).map(
    (row, index) => ({
      id: `crosswalk-${row.projectTitle}-${index}`,
      cells: [
        display(row.projectTitle),
        display(row.budgetEntry),
        display(row.procurementPlan),
        display(row.reportedQ1ProgressOrCostIncurred),
      ],
    })
  );
  const researchTableRows = pageRows('research', visibleResearch).map(
    (row, index) => ({
      id: `research-${row.source}-${index}`,
      cells: [
        display(row.source),
        display(row.recordType),
        display(row.title),
        display(row.year),
        display(row.stage),
        display(row.category),
        pesos(row.amountPesos),
        display(row.sourceReference),
      ],
    })
  );

  const tableProps = { className: 'mt-4' };
  const navTab = (key: Tab, label: string) => (
    <button
      key={key}
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => {
        setTab(key);
        setQuery('');
        resetPages();
      }}
      className={`min-h-10 rounded-full px-4 py-2 text-sm font-bold ${tab === key ? 'bg-blue-800 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
    >
      {label}
    </button>
  );

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 max-w-4xl">
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-primary-700">
          Miagao · Public records
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
          FY2026 budget and implementation records
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Budget, procurement, bid results, quarterly progress, and barangay
          profile data.
        </p>
      </header>

      <div
        className="mb-5 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Datasets"
      >
        {navTab('budget', 'Budget & APP')}
        {navTab('execution', 'Bids & Q1 reports')}
        {navTab('bettergov', 'BetterGov records')}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>
      )}
      {!error && !dataReady && (
        <p className="rounded-xl bg-white p-5 text-slate-600">
          Loading records…
        </p>
      )}

      {data && dataReady && tab === 'budget' && (
        <div className="space-y-6">
          <section className="grid gap-4 lg:grid-cols-2">
            <Bars
              title="FY2026 appropriations by office or fund · top 8"
              rows={officeChart}
            />
            <Bars
              title="APP rows with a recorded estimate · top 8"
              rows={appChart}
            />
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  Annual budget by office or fund
                </h2>
                <p className="text-sm text-slate-600">
                  Total appropriations:{' '}
                  {pesos(
                    (data.annualBudget as RecordData)?.totalAppropriationsPesos
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <LinkButton href="https://www.miagao.gov.ph/wp-content/uploads/2026/06/Budget2026.xlsx">
                  Official budget
                </LinkButton>
                <ExportButtons
                  name="miagao-fy2026-budget-by-office"
                  rows={visibleOffices}
                />
              </div>
            </div>
            <SearchBox
              value={query}
              onChange={value => {
                setQuery(value);
                resetPages();
              }}
              placeholder="Search office or fund"
            />
            <div {...tableProps}>
              <ResponsiveTable
                columns={[
                  { label: 'Office or fund' },
                  { label: 'Personal services', align: 'right' },
                  { label: 'MOOE', align: 'right' },
                  { label: 'Capital outlay', align: 'right' },
                  { label: 'Total', align: 'right' },
                ]}
                rows={officeTableRows}
              />
            </div>
            {pageControl('offices', visibleOffices)}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  Annual Procurement Plan · source rows
                </h2>
                <p className="text-sm text-slate-600">
                  {appRows.length.toLocaleString()} extracted rows · headings
                  and sub-items are retained.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <LinkButton href="https://www.miagao.gov.ph/wp-content/uploads/2026/06/CONSOLIDATED-APP-2026.xlsx">
                  Official APP
                </LinkButton>
                <ExportButtons
                  name="miagao-fy2026-app-rows"
                  rows={visibleApps}
                />
              </div>
            </div>
            <SearchBox
              value={query}
              onChange={value => {
                setQuery(value);
                resetPages();
              }}
              placeholder="Search APP description, office, or fund"
            />
            <p className="mt-2 text-xs text-slate-500">
              {visibleApps.length.toLocaleString()} rows
            </p>
            <div {...tableProps}>
              <ResponsiveTable
                columns={[
                  { label: 'Source row' },
                  { label: 'Description' },
                  { label: 'Office' },
                  { label: 'Fund' },
                  { label: 'APP estimate', align: 'right' },
                ]}
                rows={appTableRows}
              />
            </div>
            {pageControl('app', visibleApps)}
          </section>
        </div>
      )}

      {data && dataReady && tab === 'execution' && (
        <div className="space-y-6">
          <section className="grid gap-4 lg:grid-cols-2">
            <PairedBars
              title="Q1 bid amounts · ABC compared with submitted bid"
              rows={bidChart}
            />
            <Bars
              title="Q1 reported cost incurred · individual rows, top 8"
              rows={progressChart}
            />
          </section>
          <Bars
            title="Q1 receipts and expenditures · functional expenditure totals"
            rows={sreChart}
          />
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  Q1 Statement of Receipts and Expenditures
                </h2>
                <p className="text-sm text-slate-600">
                  {sreRows.length} labeled rows · fund-level amounts
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <LinkButton href="https://www.miagao.gov.ph/wp-content/uploads/2026/06/template-sre-1STQ2026.xlsx">
                  Official SRE workbook
                </LinkButton>
                <ExportButtons
                  name="miagao-q1-2026-receipts-expenditures"
                  rows={visibleSre}
                />
              </div>
            </div>
            <SearchBox
              value={query}
              onChange={value => {
                setQuery(value);
                resetPages();
              }}
              placeholder="Search statement line"
            />
            <div {...tableProps}>
              <ResponsiveTable
                columns={[
                  { label: 'Particulars' },
                  { label: 'Budget / income target', align: 'right' },
                  { label: 'General fund', align: 'right' },
                  { label: 'SEF', align: 'right' },
                  { label: 'Total', align: 'right' },
                ]}
                rows={sreTableRows}
              />
            </div>
            {pageControl('sre', visibleSre)}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Q1 bid results</h2>
                <p className="text-sm text-slate-600">
                  {bidRows.length} result rows · 3 civil works · 2 goods and
                  services
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <LinkButton href="https://www.miagao.gov.ph/wp-content/uploads/2026/05/FDP-DILG-Compliance-1st-Quarter-2026-CivilGoods-and-Consulting-Services.xlsx">
                  Official bid workbook
                </LinkButton>
                <ExportButtons
                  name="miagao-q1-2026-bid-results"
                  rows={visibleBids}
                />
              </div>
            </div>
            <SearchBox
              value={query}
              onChange={value => {
                setQuery(value);
                resetPages();
              }}
              placeholder="Search bid title, reference, location, or bidder"
            />
            <div {...tableProps}>
              <ResponsiveTable
                columns={[
                  { label: 'Reference' },
                  { label: 'Project or item' },
                  { label: 'Location' },
                  { label: 'ABC', align: 'right' },
                  { label: 'Winning bidder' },
                  { label: 'Bid amount', align: 'right' },
                ]}
                rows={bidTableRows}
              />
            </div>
            {pageControl('bids', visibleBids)}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Q1 implementation report</h2>
                <p className="text-sm text-slate-600">
                  {progressRows.length} rows · 11 department sheets
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <LinkButton href="https://www.miagao.gov.ph/wp-content/uploads/2026/04/1CONSOLIDATED-REPORT-1ST-QTR-2026-1.xlsx">
                  Official Q1 report
                </LinkButton>
                <ExportButtons
                  name="miagao-q1-2026-progress-rows"
                  rows={visibleProgress}
                />
              </div>
            </div>
            <SearchBox
              value={query}
              onChange={value => {
                setQuery(value);
                resetPages();
              }}
              placeholder="Search program, office, or location"
            />
            <div {...tableProps}>
              <ResponsiveTable
                columns={[
                  { label: 'Office' },
                  { label: 'Program or activity' },
                  { label: 'Location' },
                  { label: 'Reported total cost', align: 'right' },
                  { label: 'Completion', align: 'right' },
                  { label: 'Incurred to date', align: 'right' },
                ]}
                rows={progressTableRows}
              />
            </div>
            {pageControl('progress', visibleProgress)}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  Bid-to-report title crosswalk
                </h2>
                <p className="text-sm text-slate-600">
                  {crosswalkRows.length} bid rows compared with available APP
                  and Q1 report titles.
                </p>
              </div>
              <ExportButtons
                name="miagao-q1-2026-project-crosswalk"
                rows={visibleCrosswalk}
              />
            </div>
            <SearchBox
              value={query}
              onChange={value => {
                setQuery(value);
                resetPages();
              }}
              placeholder="Search project or candidate title"
            />
            <div {...tableProps}>
              <ResponsiveTable
                columns={[
                  { label: 'Bid-result project' },
                  { label: 'Budget schedule' },
                  { label: 'APP title result' },
                  { label: 'Q1 progress title result' },
                ]}
                rows={crosswalkTableRows}
              />
            </div>
            {pageControl('crosswalk', visibleCrosswalk)}
          </section>
        </div>
      )}

      {data && dataReady && tab === 'bettergov' && (
        <div className="space-y-6">
          <Bars
            title="Miagao-related records by BetterGov source collection"
            rows={sourceCounts}
          />
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">BetterGov source records</h2>
                <p className="text-sm text-slate-600">
                  {betterGovRows.length.toLocaleString()} rows ·{' '}
                  {String(
                    (data.sourceInventory as unknown[] | undefined)?.length ??
                      '—'
                  )}{' '}
                  source collections ·{' '}
                  {String(
                    (data.crossSourceGroups as unknown[] | undefined)?.length ??
                      '—'
                  )}{' '}
                  exact title/year/amount groups
                </p>
              </div>
              <ExportButtons
                name="miagao-bettergov-source-records"
                rows={visibleResearch}
              />
            </div>
            <SearchBox
              value={query}
              onChange={value => {
                setQuery(value);
                resetPages();
              }}
              placeholder="Search title, source, year, or category"
            />
            <div {...tableProps}>
              <ResponsiveTable
                columns={[
                  { label: 'Source' },
                  { label: 'Record type' },
                  { label: 'Project or place' },
                  { label: 'Year' },
                  { label: 'Stage' },
                  { label: 'Category' },
                  { label: 'Amount', align: 'right' },
                  { label: 'Source reference' },
                ]}
                rows={researchTableRows}
              />
            </div>
            {pageControl('research', visibleResearch)}
          </section>
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="font-bold text-slate-900">Data files</h2>
        <p className="mt-1 text-sm text-slate-600">
          Rows retain sheet, row, and source references where available.
        </p>
        <a
          href={`${import.meta.env.BASE_URL}data/miagao-disclosure/bettergov-project-and-place-records.json`}
          className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-800 px-3 py-2 text-sm font-bold text-white hover:bg-blue-900"
          download
        >
          <ArrowDownToLine size={15} /> Download 583 BetterGov records
        </a>
      </section>
    </main>
  );
}
