import { useEffect, useState } from 'react';
import { ArrowDownToLine, ExternalLink, Search } from 'lucide-react';

type Tab = 'budget' | 'execution' | 'barangays';
type RecordData = Record<string, unknown>;

const fileFor: Record<Tab, string> = {
  budget: 'budget-app.json',
  execution: 'q1-execution.json',
  barangays: 'barangay-history.json',
};

const pesos = (raw: unknown) => {
  const amount = Number(
    String(raw ?? '')
      .replace(/[₱,\s]/g, '')
      .replace(/^P/i, '')
  );
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        maximumFractionDigits: 0,
      }).format(amount)
    : '—';
};

function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Transparency() {
  const [tab, setTab] = useState<Tab>('budget');
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    fetch(`${import.meta.env.BASE_URL}data/miagao-disclosure/${fileFor[tab]}`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(value => {
        if (live) setData(value as RecordData);
      })
      .catch(reason => {
        if (live) setError(`Could not load this dataset (${String(reason)}).`);
      });
    return () => {
      live = false;
    };
  }, [tab]);

  useEffect(() => setPage(0), [query, tab]);

  const appRows = (data?.appRows as RecordData[] | undefined) ?? [];
  const bidRows = (data?.bidResultsQ1 as RecordData[] | undefined) ?? [];
  const progressRows = (data?.q1ProgressRows as RecordData[] | undefined) ?? [];
  const profileRows =
    (data?.barangayProfiles2018 as RecordData[] | undefined) ?? [];
  const crosswalkRows =
    (data?.projectTrackingCases as RecordData[] | undefined) ?? [];
  const officeRows =
    ((data?.annualBudget as RecordData | undefined)
      ?.officeAndGroupAppropriations as RecordData[] | undefined) ?? [];
  const searchText = query.trim().toLowerCase();

  const visibleApps = appRows.filter(
    row =>
      !searchText ||
      `${row.description ?? ''} ${row.office ?? ''} ${row.fund ?? ''}`
        .toLowerCase()
        .includes(searchText)
  );
  const visibleProgress = progressRows.filter(
    row =>
      !searchText ||
      `${row.title ?? ''} ${row.office ?? ''} ${row.location ?? ''}`
        .toLowerCase()
        .includes(searchText)
  );
  const visibleProfiles = profileRows.filter(
    row =>
      !searchText ||
      `${row.title ?? ''} ${row.contentText ?? ''}`
        .toLowerCase()
        .includes(searchText)
  );
  const tableRows =
    tab === 'budget'
      ? visibleApps
      : tab === 'execution'
        ? visibleProgress
        : visibleProfiles;
  const start = page * pageSize;
  const pageRows = tableRows.slice(start, start + pageSize);
  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 max-w-4xl">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-primary-700">
          Miagao · Public records
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
          Budget to implementation
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-700">
          A searchable reading room for Miagao’s FY2026 budget, procurement
          plan, bid results and first-quarter reports. Each source stays
          identifiable; similar titles are shown as review leads until checked
          against scope and location.
        </p>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl bg-slate-950 p-5 text-white">
          <p className="text-sm text-slate-300">FY2026 total appropriations</p>
          <strong className="mt-2 block text-3xl">₱356.06M</strong>
          <p className="mt-2 text-sm text-slate-300">
            Office/account-level budget
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Q1 bid-result rows</p>
          <strong className="mt-2 block text-3xl text-slate-950">5</strong>
          <p className="mt-2 text-sm text-slate-600">
            3 civil works · 2 goods and services
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Q1 implementation report</p>
          <strong className="mt-2 block text-3xl text-slate-950">106</strong>
          <p className="mt-2 text-sm text-slate-600">
            Program rows from 11 department sheets
          </p>
        </article>
      </section>

      <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        <strong>How to read the records.</strong> The annual budget lists
        appropriations by office and account, not a project-by-project budget.
        The Q1 receipts-and-expenditures statement is also aggregated. The
        separate COA progress workbook reports program costs incurred to date;
        it is not a transaction ledger. A title resemblance does not prove that
        two rows refer to the same scope.
      </section>

      <div
        className="mb-5 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Public record datasets"
      >
        {(
          [
            ['budget', 'Budget & APP'],
            ['execution', 'Bids & Q1 progress'],
            ['barangays', 'Barangay archive'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key);
              setQuery('');
            }}
            className={`rounded-full px-4 py-2 text-sm font-bold ${tab === key ? 'bg-blue-800 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>
      )}
      {!error && !data && (
        <p className="rounded-xl bg-white p-5 text-slate-600">
          Loading source records…
        </p>
      )}

      {data && tab === 'budget' && (
        <>
          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">
                  FY2026 approved budget
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  The official summary reports ₱356,056,063 in total
                  appropriations. Its totals are grouped by office and budget
                  account, so they cannot be assigned to each named project
                  below.
                </p>
              </div>
              <a
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800"
                href="https://www.miagao.gov.ph/wp-content/uploads/2026/06/Budget2026.xlsx"
                target="_blank"
                rel="noreferrer"
              >
                Official budget <ExternalLink size={15} />
              </a>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="p-3">Office or group</th>
                    <th className="p-3 text-right">Personal services</th>
                    <th className="p-3 text-right">MOOE</th>
                    <th className="p-3 text-right">Capital outlay</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {officeRows.map((row, index) => (
                    <tr
                      key={`${row.sourceRow}-${index}`}
                      className="border-b border-slate-100"
                    >
                      <td className="p-3 font-medium">
                        {String(row.officeOrGroup)}
                      </td>
                      <td className="p-3 text-right">
                        {pesos(row.personalServices)}
                      </td>
                      <td className="p-3 text-right">{pesos(row.mooe)}</td>
                      <td className="p-3 text-right">
                        {pesos(row.capitalOutlay)}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {pesos(row.totalPesos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadJson('miagao-fy2026-budget-by-office.json', officeRows)
              }
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900"
            >
              <ArrowDownToLine size={16} /> Export budget table
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">
                  Annual Procurement Plan · source rows
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  3,578 non-empty rows preserved from the official workbook,
                  including headings and nested supply items. This is not a
                  count of unique projects.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  downloadJson('miagao-fy2026-app-rows.json', visibleApps)
                }
                className="inline-flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white"
              >
                <ArrowDownToLine size={16} /> Export filtered rows
              </button>
            </div>
            <a
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-800 underline"
              href="https://www.miagao.gov.ph/wp-content/uploads/2026/06/CONSOLIDATED-APP-2026.xlsx"
              target="_blank"
              rel="noreferrer"
            >
              Official APP workbook <ExternalLink size={14} />
            </a>
            <label className="mt-5 flex max-w-xl items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
              <Search size={17} className="text-slate-500" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search APP description, office or fund"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            <p className="mt-3 text-sm text-slate-500">
              {visibleApps.length.toLocaleString()} source rows
              {searchText ? ' match your search' : ''}
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="p-3">Row</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Office</th>
                    <th className="p-3">Fund</th>
                    <th className="p-3 text-right">APP estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, index) => (
                    <tr
                      key={`${row.row}-${index}`}
                      className="border-b border-slate-100"
                    >
                      <td className="p-3 text-slate-500">{String(row.row)}</td>
                      <td className="p-3">{String(row.description ?? '—')}</td>
                      <td className="p-3">{String(row.office ?? '—')}</td>
                      <td className="p-3">{String(row.fund ?? '—')}</td>
                      <td className="p-3 text-right">
                        {pesos(row.budgetPesos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {page + 1} of {totalPages} · 20 rows per page
              </span>
              <button
                disabled={page + 1 >= totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}

      {data && tab === 'execution' && (
        <>
          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">
                  Q1 bid results
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Three civil-works awards and two goods/services awards were
                  listed; the consulting-services form says no bid result for
                  the period.
                </p>
              </div>
              <a
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold"
                href="https://www.miagao.gov.ph/wp-content/uploads/2026/05/FDP-DILG-Compliance-1st-Quarter-2026-CivilGoods-and-Consulting-Services.xlsx"
                target="_blank"
                rel="noreferrer"
              >
                Official bid workbook <ExternalLink size={15} />
              </a>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="p-3">Reference</th>
                    <th className="p-3">Project / item</th>
                    <th className="p-3">Location</th>
                    <th className="p-3 text-right">ABC</th>
                    <th className="p-3">Winning bidder</th>
                    <th className="p-3 text-right">Bid</th>
                  </tr>
                </thead>
                <tbody>
                  {bidRows.map((row, index) => (
                    <tr
                      key={`${row.reference}-${index}`}
                      className="border-b border-slate-100"
                    >
                      <td className="p-3 font-mono text-xs">
                        {String(row.reference)}
                      </td>
                      <td className="p-3">{String(row.title)}</td>
                      <td className="p-3">{String(row.location ?? '—')}</td>
                      <td className="p-3 text-right">
                        {pesos(row.approvedBudgetPesos)}
                      </td>
                      <td className="p-3">
                        {String(row.winningBidder ?? '—')}
                      </td>
                      <td className="p-3 text-right">
                        {pesos(row.bidAmountPesos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadJson('miagao-q1-2026-bid-results.json', bidRows)
              }
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white"
            >
              <ArrowDownToLine size={16} /> Export bid results
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">
                  Q1 implementation and reported cost
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  106 source rows from 11 department sheets. “Cost incurred to
                  date” and completion are transcribed from the submitted
                  progress forms; rows may be parent program totals or child
                  activities and must not be summed together.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  downloadJson(
                    'miagao-q1-2026-progress-rows.json',
                    visibleProgress
                  )
                }
                className="inline-flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white"
              >
                <ArrowDownToLine size={16} /> Export filtered rows
              </button>
            </div>
            <a
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-800 underline"
              href="https://www.miagao.gov.ph/wp-content/uploads/2026/04/1CONSOLIDATED-REPORT-1ST-QTR-2026-1.xlsx"
              target="_blank"
              rel="noreferrer"
            >
              Official consolidated report workbook <ExternalLink size={14} />
            </a>
            <label className="mt-5 flex max-w-xl items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
              <Search size={17} className="text-slate-500" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search project, office or location"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            <p className="mt-3 text-sm text-slate-500">
              {visibleProgress.length} progress rows
              {searchText ? ' match your search' : ''}
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="p-3">Office</th>
                    <th className="p-3">Program / activity</th>
                    <th className="p-3">Location</th>
                    <th className="p-3 text-right">Reported total cost</th>
                    <th className="p-3 text-right">Completion</th>
                    <th className="p-3 text-right">Incurred to date</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, index) => (
                    <tr
                      key={`${row.departmentSheet}-${row.row}-${index}`}
                      className="border-b border-slate-100"
                    >
                      <td className="p-3">
                        {String(row.office ?? row.departmentSheet ?? '—')}
                      </td>
                      <td className="p-3">{String(row.title)}</td>
                      <td className="p-3">{String(row.location ?? '—')}</td>
                      <td className="p-3 text-right">
                        {pesos(row.totalCostRaw)}
                      </td>
                      <td className="p-3 text-right">
                        {String(row.percentCompleteRaw ?? '—')}
                      </td>
                      <td className="p-3 text-right">
                        {pesos(row.costIncurredToDateRaw)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {page + 1} of {totalPages} · 20 rows per page
              </span>
              <button
                disabled={page + 1 >= totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
            <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              The separate Q1 Statement of Receipts and Expenditures reports
              fund-level totals; it has no project-title field. The COA progress
              forms are not a substitute for transaction-level spending records.
            </p>
            <button
              type="button"
              onClick={() =>
                downloadJson(
                  'miagao-q1-2026-project-tracking-candidates.json',
                  crosswalkRows
                )
              }
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-800 px-4 py-2 text-sm font-bold text-blue-800"
            >
              <ArrowDownToLine size={16} /> Export title-match review candidates
            </button>
          </section>
        </>
      )}

      {data && tab === 'barangays' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="text-2xl font-bold text-slate-950">
            Barangay source archive
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            The 2024 municipal post announces officials from 119 barangays, but
            its linked images are event photographs rather than a readable,
            name-by-name roster. The official site currently exposes 11
            individual barangay-profile pages in its 2018 archive. Officeholders
            and profile statistics on those pages are historical; they are not
            current roster claims.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="https://www.miagao.gov.ph/about-miagao/news/know-your-barangay-officials/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold"
            >
              2024 roster announcement <ExternalLink size={14} />
            </a>
            <a
              href="https://www.miagao.gov.ph/about-miagao/barangay-map-information/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold"
            >
              2018 barangay profiles <ExternalLink size={14} />
            </a>
            <button
              onClick={() =>
                downloadJson(
                  'miagao-historical-barangay-profiles.json',
                  visibleProfiles
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white"
            >
              <ArrowDownToLine size={16} /> Export profile records
            </button>
          </div>
          <label className="mt-5 flex max-w-xl items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
            <Search size={17} className="text-slate-500" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search barangay profile text"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <div className="mt-4 divide-y divide-slate-100">
            {pageRows.map((row, index) => (
              <article key={`${row.sourceUrl}-${index}`} className="py-4">
                <h3 className="font-bold text-slate-950">
                  {String(row.title)}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Published {String(row.publishedAt).slice(0, 10)} · historical
                  profile
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {String(row.contentText ?? '').slice(0, 500)}…
                </p>
                <a
                  href={String(row.sourceUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-800 underline"
                >
                  Open official source <ExternalLink size={14} />
                </a>
              </article>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {page + 1} of {totalPages}
            </span>
            <button
              disabled={page + 1 >= totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-950">Source notes</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The records are transcribed from Municipality of Miagao disclosure
          files and official barangay pages. Parsed labels, dates, amounts and
          candidate matches retain source-row references in the downloadable
          data. A blank field means the source did not provide a usable value;
          it is not zero.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Research dataset assembled from public records. It is not an audit
          opinion or a verification of completion, payment, current
          officeholding or project site.
        </p>
      </section>
    </main>
  );
}
