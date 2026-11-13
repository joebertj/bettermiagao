import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import AnalysisDisclaimer from '../components/ui/AnalysisDisclaimer';

type BidRecord = {
  form: string;
  reference: string;
  title: string;
  approvedBudgetPesos: string | null;
  location: string | null;
  winningBidder: string | null;
  bidAmountPesos: string | null;
  bidDateExcelSerial: string | null;
  duration: string | null;
  row: number;
  sourceUrl: string;
};

type ProgressRecord = {
  departmentSheet: string;
  row: number;
  office: string | null;
  title: string | null;
  location: string | null;
  totalCostRaw: string | null;
  dateStarted: string | null;
  targetCompletion: string | null;
  percentCompleteRaw: string | null;
  costIncurredToDateRaw: string | null;
  remarks: string | null;
  evidenceType: string | null;
  sourceUrl: string;
};

type ReportData = {
  bidResultsQ1: BidRecord[];
  q1ProgressRows: ProgressRecord[];
};

const dataPath = `${import.meta.env.BASE_URL}data/miagao-disclosure/q1-execution.json`;
const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

const categories = [
  {
    form: 'FORM 10a - CW',
    title: 'Civil works',
    note: 'Three reported works: an Igbugo water inlet canal and overflow mitigation in Naclub and Igsoligue. No direct APP line or named Q1 progress entry was identified for these specific sites. The APP culvert in Brgy. Sapa is a different location and scope.',
  },
  {
    form: 'FORM 10b - GS',
    title: 'Goods and services',
    note: 'The security-services bid has a strong APP match at row 851: 15 guards for 12 months, with the same ₱4.32M approved budget. No named progress entry was identified for that service. The stake truck has no direct APP match; low-similarity grader and compactor candidates were rejected.',
  },
  {
    form: 'FORM 10c - CS',
    title: 'Consulting services',
    note: 'No Form 10c consulting-service bid result appears in the available Q1 extract.',
  },
];

const appProgressReview = [
  {
    app: 'APP row 3571 · heavy-equipment maintenance',
    appAmount: 1_500_000,
    progressRow: 'MEO row 16',
    progressTitle:
      'Repair/maintenance of heavy equipment, dump trucks and engineering vehicles',
    incurred: null,
    completion: null,
  },
  {
    app: 'APP row 3582 · infrastructure-asset maintenance',
    appAmount: 300_000,
    progressRow: 'MEO row 18',
    progressTitle: 'Repair and maintenance of infrastructure assets',
    incurred: null,
    completion: null,
  },
  {
    app: 'APP row 3588 · motor vehicles',
    appAmount: 75_000,
    progressRow: 'MEO row 19',
    progressTitle: 'Purchase of transportation equipment and service vehicle',
    incurred: null,
    completion: null,
  },
  {
    app: 'APP row 3591 · technical and scientific equipment',
    appAmount: 300_000,
    progressRow: 'MEO row 20',
    progressTitle:
      'Aerial survey, construction monitoring, land survey and mapping equipment',
    incurred: null,
    completion: null,
  },
  {
    app: 'APP row 3585 · building maintenance',
    appAmount: 300_000,
    progressRow: 'MEO row 21',
    progressTitle: 'Maintenance of municipal and other government facilities',
    incurred: null,
    completion: null,
  },
];

function amount(raw: string | null | undefined) {
  const value = Number(String(raw ?? '').replace(/[₱P,\s]/gi, ''));
  return Number.isFinite(value) ? value : null;
}

function money(raw: string | null | undefined) {
  const value = amount(raw);
  return value === null ? '—' : peso.format(value);
}

function excelDate(raw: string | null | undefined) {
  const serial = Number(raw);
  if (!Number.isFinite(serial) || serial <= 0) return 'Date not stated';
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function dateLabel(raw: string | null | undefined) {
  if (!raw) return '—';
  const serial = Number(raw);
  return Number.isFinite(serial) && serial > 30000 ? excelDate(raw) : raw;
}

function percent(raw: string | null | undefined) {
  if (!raw) return '—';
  const hasPercent = raw.includes('%');
  const value = Number(raw.replace('%', '').trim());
  if (!Number.isFinite(value)) return raw;
  return `${(hasPercent ? value : value * 100).toFixed(1)}%`;
}

function bidReview(reference: string) {
  if (reference === '100-26-01-0039') return 'Strong APP match · row 851';
  if (reference === '100-26-02-0068') return 'No direct APP match';
  return 'No direct APP match identified';
}

function CategorySection({
  category,
  bids,
}: {
  category: (typeof categories)[number];
  bids: BidRecord[];
}) {
  return (
    <section
      id={category.form.replaceAll(' ', '-').toLowerCase()}
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-800">
            {category.form}
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">
            {category.title}
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
          {bids.length} {bids.length === 1 ? 'result' : 'results'}
        </span>
      </div>
      <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-700">
        {category.note}
      </p>

      {bids.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="p-3">Reference / project</th>
                <th className="p-3">Approved budget</th>
                <th className="p-3">Reported bid</th>
                <th className="p-3">Reported winning bidder</th>
                <th className="p-3">Bid date / duration</th>
                <th className="p-3">APP review</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid, index) => {
                const approved = amount(bid.approvedBudgetPesos);
                const offered = amount(bid.bidAmountPesos);
                const gap =
                  approved !== null && offered !== null
                    ? approved - offered
                    : null;
                return (
                  <tr
                    key={bid.reference}
                    className={index % 2 ? 'bg-slate-50' : 'bg-white'}
                  >
                    <td className="p-3 align-top">
                      <strong className="block text-slate-900">
                        {bid.reference}
                      </strong>
                      <span className="mt-1 block max-w-lg text-slate-700">
                        {bid.title}
                      </span>
                      {bid.location && (
                        <span className="mt-1 block text-xs text-slate-500">
                          {bid.location}
                        </span>
                      )}
                      <a
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-800 underline"
                        href={bid.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Source form <ExternalLink size={12} />
                      </a>
                    </td>
                    <td className="p-3 align-top tabular-nums">
                      {money(bid.approvedBudgetPesos)}
                    </td>
                    <td className="p-3 align-top tabular-nums">
                      {money(bid.bidAmountPesos)}
                      {gap !== null && (
                        <span className="mt-1 block text-xs text-slate-500">
                          {money(String(gap))} below budget
                        </span>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      {bid.winningBidder || '—'}
                    </td>
                    <td className="p-3 align-top">
                      {excelDate(bid.bidDateExcelSerial)}
                      {bid.duration && (
                        <span className="mt-1 block text-xs text-slate-500">
                          {bid.duration}
                        </span>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      {bidReview(bid.reference)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          No results in the available Q1 bid-results extract.
        </p>
      )}
    </section>
  );
}

export default function Bids() {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    let active = true;
    fetch(dataPath)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<ReportData>;
      })
      .then(result => {
        if (active) setData(result);
      })
      .catch(cause => {
        if (active)
          setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      active = false;
    };
  }, []);

  const departments = useMemo(
    () =>
      [
        ...new Set(
          (data?.q1ProgressRows ?? []).map(row => row.departmentSheet)
        ),
      ].sort(),
    [data]
  );
  const filteredProgress = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.q1ProgressRows ?? []).filter(row => {
      if (department !== 'all' && row.departmentSheet !== department)
        return false;
      if (!needle) return true;
      return [
        row.departmentSheet,
        row.office,
        row.title,
        row.location,
        row.remarks,
      ].some(value =>
        String(value ?? '')
          .toLowerCase()
          .includes(needle)
      );
    });
  }, [data, department, query]);
  const pageCount = Math.max(1, Math.ceil(filteredProgress.length / pageSize));
  const visibleProgress = filteredProgress.slice(
    page * pageSize,
    (page + 1) * pageSize
  );

  useEffect(() => setPage(0), [department, query]);

  const bids = data?.bidResultsQ1 ?? [];
  const progress = data?.q1ProgressRows ?? [];
  const costCount = progress.filter(row => row.costIncurredToDateRaw).length;
  const completionCount = progress.filter(
    row => row.percentCompleteRaw !== null && row.percentCompleteRaw !== ''
  ).length;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-7 max-w-4xl">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-800">
          Miagao · FY2026
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">
          Bids & implementation
        </h1>
        <p className="mt-3 text-lg leading-7 text-slate-700">
          Browse reported Q1 bid results by procurement category and review the
          municipality’s quarterly project and program implementation records.
        </p>
      </header>

      <div className="mb-7">
        <AnalysisDisclaimer>
          These records come from separate plans, bid forms and progress
          reports. A matching title or amount is a review lead, not proof of a
          signed contract, payment or completed work. APP budgets are plans;
          progress reports may combine multiple activities. No finding of
          wrongdoing is implied.
        </AnalysisDisclaimer>
      </div>

      <section
        className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Record coverage"
      >
        {[
          [data ? String(bids.length) : '—', 'Q1 bid results'],
          [
            data
              ? String(bids.filter(row => row.form === 'FORM 10a - CW').length)
              : '—',
            'Civil works',
          ],
          [
            data
              ? String(bids.filter(row => row.form === 'FORM 10b - GS').length)
              : '—',
            'Goods and services',
          ],
          [
            data ? `${costCount} / ${progress.length}` : '—',
            'Progress rows with incurred cost',
          ],
        ].map(([value, label]) => (
          <article
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <strong className="block text-2xl font-bold text-slate-950">
              {value}
            </strong>
            <span className="mt-1 block text-sm text-slate-600">{label}</span>
          </article>
        ))}
      </section>

      {error && (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          Could not load the local Q1 records: {error}
        </p>
      )}
      {!data && !error && (
        <p className="mb-6 text-sm text-slate-600">
          Loading Q1 bid and implementation records…
        </p>
      )}

      {data && (
        <div className="space-y-5">
          <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            Current cross-check: one bid has a strong APP match. No named bid
            project was found in the Q1 implementation rows; the implementation
            table below is presented separately from bid awards.
          </p>
          {categories.map(category => (
            <CategorySection
              key={category.form}
              category={category}
              bids={bids.filter(bid => bid.form === category.form)}
            />
          ))}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <div className="mb-5 max-w-4xl">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-800">
                Q1 implementation
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                APP categories carried into progress reporting
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Five MEO categories have matching APP descriptions and amounts.
                Their Q1 progress rows leave incurred cost and completion blank,
                so these records confirm category-level tracking but do not
                establish execution.
              </p>
              <a
                href="https://www.miagao.gov.ph/wp-content/uploads/2026/06/CONSOLIDATED-APP-2026.xlsx"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-800 underline"
              >
                Official APP workbook <ExternalLink size={13} />
              </a>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="p-3">APP item</th>
                    <th className="p-3">APP amount</th>
                    <th className="p-3">Progress record</th>
                    <th className="p-3">Incurred</th>
                    <th className="p-3">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {appProgressReview.map((row, index) => (
                    <tr
                      key={row.progressRow}
                      className={index % 2 ? 'bg-slate-50' : 'bg-white'}
                    >
                      <td className="p-3 align-top">{row.app}</td>
                      <td className="p-3 align-top tabular-nums">
                        {peso.format(row.appAmount)}
                      </td>
                      <td className="p-3 align-top">
                        <strong>{row.progressRow}</strong>
                        <span className="mt-1 block text-slate-600">
                          {row.progressTitle}
                        </span>
                      </td>
                      <td className="p-3 align-top">
                        {row.incurred === null
                          ? 'Not reported'
                          : money(String(row.incurred))}
                      </td>
                      <td className="p-3 align-top">
                        {row.completion === null
                          ? 'Not reported'
                          : percent(String(row.completion))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              The parent and detail APP rows for building maintenance repeat the
              same ₱300,000 amount; they are treated as one budget item.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-800">
                  Quarterly report · all departments
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Implementation records
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {progress.length} rows · {costCount} with incurred-cost
                  entries · {completionCount} with completion entries
                </p>
              </div>
              <a
                href="https://www.miagao.gov.ph/wp-content/uploads/2026/04/1CONSOLIDATED-REPORT-1ST-QTR-2026-1.xlsx"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-800 px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50"
              >
                Source report <ExternalLink size={14} />
              </a>
            </div>
            <div className="mb-3 grid gap-3 sm:grid-cols-[minmax(220px,1fr)_220px]">
              <label className="relative block">
                <span className="sr-only">Search implementation records</span>
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-3 text-slate-400"
                />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search title, office or location"
                  className="min-h-10 w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
                />
              </label>
              <label className="sr-only" htmlFor="progress-department">
                Filter by department
              </label>
              <select
                id="progress-department"
                value={department}
                onChange={event => setDepartment(event.target.value)}
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="all">All departments</option>
                {departments.map(name => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="p-3">Department / row</th>
                    <th className="p-3">Program or project</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Reported total</th>
                    <th className="p-3">Incurred to date</th>
                    <th className="p-3">Completion</th>
                    <th className="p-3">Period</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProgress.map((row, index) => (
                    <tr
                      key={`${row.departmentSheet}-${row.row}`}
                      className={index % 2 ? 'bg-slate-50' : 'bg-white'}
                    >
                      <td className="p-3 align-top">
                        <strong>{row.departmentSheet}</strong>
                        <span className="block text-xs text-slate-500">
                          row {row.row}
                        </span>
                      </td>
                      <td className="p-3 align-top">
                        {row.title || '—'}
                        {row.remarks && (
                          <span className="mt-1 block text-xs text-slate-500">
                            {row.remarks}
                          </span>
                        )}
                      </td>
                      <td className="p-3 align-top">{row.location || '—'}</td>
                      <td className="p-3 align-top tabular-nums">
                        {money(row.totalCostRaw)}
                      </td>
                      <td className="p-3 align-top tabular-nums">
                        {money(row.costIncurredToDateRaw)}
                      </td>
                      <td className="p-3 align-top">
                        {percent(row.percentCompleteRaw)}
                      </td>
                      <td className="p-3 align-top">
                        {dateLabel(row.dateStarted)} –{' '}
                        {dateLabel(row.targetCompletion)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visibleProgress.length && (
                <p className="p-5 text-sm text-slate-600">
                  No implementation rows match this filter.
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <span>
                {filteredProgress.length ? page * pageSize + 1 : 0}–
                {Math.min((page + 1) * pageSize, filteredProgress.length)} of{' '}
                {filteredProgress.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage(value => Math.max(0, value - 1))}
                  disabled={page === 0}
                  className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage(value => Math.min(pageCount - 1, value + 1))
                  }
                  disabled={page + 1 >= pageCount}
                  className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
