import { Fragment, useMemo, useState } from 'react';
import { Download, ExternalLink, Search } from 'lucide-react';
import records from '../data/miagao-barangay-inventory.json';

type ProjectRecord = {
  year: number;
  stage: string;
  category: string;
  title: string;
  amountPesos: number;
  source: string;
  locationBasis?: string;
  identityConfidence?: string;
};
type BarangayRecord = {
  psgc: string;
  name: string;
  population2024: number;
  mpb: {
    projectRowsAllYears: number;
    buildingCountAllYears: number;
    allocationPesosAllYears: number;
    records: ProjectRecord[];
  };
  titleMatchedProjects: ProjectRecord[];
  captain: null | {
    name: string;
    role: string;
    asOf: string;
    sourceLabel: string;
    status: string;
    source: string;
  };
};

const barangays = records.barangays as BarangayRecord[];
const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

function BarangayRankChart({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; display: string }[];
}) {
  const maximum = Math.max(...rows.map(row => row.value), 1);
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-bold text-slate-950">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`}>
            <div className="mb-1 flex items-start justify-between gap-3 text-xs sm:text-sm">
              <span className="min-w-0 break-words text-slate-700">
                {row.label}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-950">
                {row.display}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-blue-800"
                style={{
                  width: `${Math.max(2, (row.value / maximum) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function downloadRows(rows: BarangayRecord[], format: 'json' | 'csv') {
  const exportRows = rows.map(row => ({
    psgc: row.psgc,
    barangay: row.name,
    population2024: row.population2024,
    captain: row.captain?.name ?? '',
    captainSource: row.captain?.source ?? '',
    fy2027MpbProjects: row.mpb.records
      .filter(project => project.year === 2027)
      .map(project => project.title)
      .join(' | '),
    fy2027MpbAllocationPesos: row.mpb.records
      .filter(project => project.year === 2027)
      .reduce((sum, project) => sum + project.amountPesos, 0),
    titleMatchedDpwhProjects: row.titleMatchedProjects
      .map(project => project.title)
      .join(' | '),
  }));
  const csv = [
    Object.keys(exportRows[0] ?? {}).join(','),
    ...exportRows.map(row =>
      Object.values(row)
        .map(value => `"${String(value).replaceAll('"', '""')}"`)
        .join(',')
    ),
  ].join('\r\n');
  const blob = new Blob(
    [format === 'json' ? JSON.stringify(exportRows, null, 2) : csv],
    {
      type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
    }
  );
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `miagao-barangays.${format}`;
  anchor.click();
  URL.revokeObjectURL(href);
}

export default function Barangays() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return barangays;
    return barangays.filter(row =>
      [
        row.name,
        row.psgc,
        row.captain?.name ?? '',
        ...row.titleMatchedProjects.map(p => p.title),
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(q)
    );
  }, [query]);
  const visibleRows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const firstRow = filtered.length ? page * pageSize + 1 : 0;
  const lastRow = Math.min(filtered.length, (page + 1) * pageSize);
  const latestMpbRanks = barangays
    .map(row => ({
      label: row.name,
      value: row.mpb.records
        .filter(project => project.year === 2027)
        .reduce((sum, project) => sum + (project.amountPesos || 0), 0),
    }))
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map(row => ({ ...row, display: peso.format(row.value) }));
  const latestDpwhRanks = barangays
    .map(row => ({
      label: row.name,
      value: row.titleMatchedProjects.filter(project => project.year === 2027)
        .length,
    }))
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 8)
    .map(row => ({ ...row, display: `${row.value} rows` }));
  const populationRanks = [...barangays]
    .sort((a, b) => b.population2024 - a.population2024)
    .slice(0, 8)
    .map(row => ({
      label: row.name,
      value: row.population2024,
      display: row.population2024.toLocaleString(),
    }));
  const pagination = (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <label className="flex items-center gap-2 text-sm text-gray-600">
        Rows per page
        <select
          value={pageSize}
          onChange={event => {
            setPageSize(Number(event.target.value));
            setPage(0);
          }}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900"
        >
          {[10, 20, 50].map(size => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <span className="text-sm text-gray-600">
        {firstRow}–{lastRow} of {filtered.length} · Page {page + 1} of{' '}
        {pageCount}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage(Math.max(0, page - 1))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page + 1 >= pageCount}
          onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 max-w-4xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-800">
          Miagao · 119 barangays
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Barangay records
        </h1>
        <p className="mt-4 text-lg leading-8 text-gray-700">
          Browse barangay population, MPB records, and DPWH project titles that
          name each place. Project title matches are leads to records; they do
          not confirm a project’s exact site.
        </p>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          The municipality’s published roster confirms the officials elected in
          2023 but presents names in images. Names appear below only where a
          dated text source identifies the captain. Blank entries mean “not yet
          verified from an accessible text roster,” not that the barangay has no
          captain.
        </p>
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-950 p-5 text-white">
          <strong className="block text-3xl">{barangays.length}</strong>
          <span className="text-sm text-slate-300">PSGC barangays</span>
        </div>
        <div className="rounded-xl bg-blue-800 p-5 text-white">
          <strong className="block text-3xl">
            {barangays.filter(r => r.titleMatchedProjects.length).length}
          </strong>
          <span className="text-sm text-blue-100">
            with a title-matched DPWH record
          </span>
        </div>
        <div className="rounded-xl bg-amber-400 p-5 text-slate-950">
          <strong className="block text-3xl">
            {
              barangays.filter(r => r.mpb.records.some(p => p.year === 2027))
                .length
            }
          </strong>
          <span className="text-sm">with an FY2027 MPB record</span>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <strong className="block text-3xl">
            {barangays.filter(r => r.captain).length}
          </strong>
          <span className="text-sm text-gray-600">
            captains confirmed by a text source
          </span>
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <BarangayRankChart
          title="FY2027 MPB allocations · by named barangay"
          rows={latestMpbRanks}
        />
        <BarangayRankChart
          title="FY2027 DPWH project-title matches · by barangay"
          rows={latestDpwhRanks}
        />
        <BarangayRankChart
          title="PSA 2024 population · largest barangays"
          rows={populationRanks}
        />
      </section>

      <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <strong>Barangay captain roster:</strong> the municipal site’s “Know
        Your Barangay Officials” post (January 2024) links event photos rather
        than a searchable name list. The 2018 profile names are excluded as
        current officials. The next barangay election is scheduled for November
        2028 under Republic Act 12326.
        <div className="mt-2 flex flex-wrap gap-4">
          <a
            className="inline-flex items-center gap-1 font-semibold underline"
            href={records.sources.barangayOfficialsRoster}
            target="_blank"
            rel="noreferrer"
          >
            Municipal roster post <ExternalLink size={13} />
          </a>
          <a
            className="inline-flex items-center gap-1 font-semibold underline"
            href="https://www.comelec.gov.ph/index.html?r=References%2FRelatedLaws%2FElectionLaws%2FSynchronizedBarangayandSK%2FRA12326"
            target="_blank"
            rel="noreferrer"
          >
            RA 12326 <ExternalLink size={13} />
          </a>
          <a
            className="inline-flex items-center gap-1 font-semibold underline"
            href={records.sources.barangayProfiles}
            target="_blank"
            rel="noreferrer"
          >
            Municipal barangay profiles · older records{' '}
            <ExternalLink size={13} />
          </a>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2">
          <Search size={17} className="text-gray-500" />
          <input
            className="w-full border-0 bg-transparent text-sm outline-none"
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search barangay, captain, or project"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadRows(filtered, 'json')}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900"
          >
            <Download size={16} /> Export JSON
          </button>
          <button
            type="button"
            onClick={() => downloadRows(filtered, 'csv')}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-800 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
        <span className="text-sm text-gray-600">
          {filtered.length} of {barangays.length}
        </span>
      </div>

      {pagination}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="grid gap-3 p-3 md:hidden">
          {visibleRows.map(row => {
            const currentMpb = row.mpb.records.filter(
              project => project.year === 2027
            );
            const currentMpbAmount = currentMpb.reduce(
              (sum, project) => sum + (project.amountPesos || 0),
              0
            );
            const isOpen = expanded === row.psgc;
            return (
              <article
                key={row.psgc}
                className="rounded-lg border border-gray-200 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-bold text-slate-950">{row.name}</h2>
                  <button
                    type="button"
                    className="shrink-0 font-semibold text-blue-800 underline"
                    onClick={() => setExpanded(isOpen ? null : row.psgc)}
                  >
                    {isOpen ? 'Hide' : 'Records'}
                  </button>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-gray-500">Population · 2024</dt>
                    <dd>{row.population2024.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Punong Barangay</dt>
                    <dd className="break-words">
                      {row.captain?.name ?? 'Not yet verified'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">FY2027 MPB</dt>
                    <dd>
                      {currentMpb.length
                        ? `${currentMpb.length} · ${peso.format(currentMpbAmount)}`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">
                      DPWH title matches
                    </dt>
                    <dd>{row.titleMatchedProjects.length || '—'}</dd>
                  </div>
                </dl>
                {isOpen && (
                  <div className="mt-3 space-y-4 border-t border-gray-200 pt-3">
                    <div>
                      <h3 className="font-bold">FY2027 MPB records</h3>
                      {currentMpb.length ? (
                        currentMpb.map((project, index) => (
                          <p
                            key={`${project.source}-${index}`}
                            className="mt-2 break-words text-sm"
                          >
                            {project.title} · {peso.format(project.amountPesos)}{' '}
                            · {project.source}
                          </p>
                        ))
                      ) : (
                        <p className="mt-1 text-sm text-gray-600">
                          No linked FY2027 MPB row.
                        </p>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold">
                        Historical and proposed DPWH title matches
                      </h3>
                      {row.titleMatchedProjects.length ? (
                        row.titleMatchedProjects.map((project, index) => (
                          <p
                            key={`${project.source}-${index}`}
                            className="mt-2 break-words text-sm"
                          >
                            {project.year} · {project.title} ·{' '}
                            {peso.format(project.amountPesos)} ·{' '}
                            {project.source}
                          </p>
                        ))
                      ) : (
                        <p className="mt-1 text-sm text-gray-600">
                          No linked DPWH title match.
                        </p>
                      )}
                    </div>
                    {row.captain && (
                      <p className="break-words text-xs text-gray-600">
                        {row.captain.status} ({row.captain.asOf}) ·{' '}
                        <a
                          className="underline"
                          href={row.captain.source}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {row.captain.sourceLabel}
                        </a>
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <div className="hidden md:block">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead className="bg-slate-950 text-white">
              <tr>
                <th className="w-[18%] break-words px-3 py-3">Barangay</th>
                <th className="w-[10%] break-words px-3 py-3">
                  Population · 2024
                </th>
                <th className="w-[18%] break-words px-3 py-3">
                  Punong Barangay
                </th>
                <th className="w-[17%] break-words px-3 py-3">FY2027 MPB</th>
                <th className="w-[20%] break-words px-3 py-3">
                  Title-matched DPWH records
                </th>
                <th className="w-[17%] break-words px-3 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(row => {
                const currentMpb = row.mpb.records.filter(
                  project => project.year === 2027
                );
                const currentMpbAmount = currentMpb.reduce(
                  (sum, p) => sum + (p.amountPesos || 0),
                  0
                );
                const isOpen = expanded === row.psgc;
                return (
                  <Fragment key={row.psgc}>
                    <tr className="border-t border-gray-200 odd:bg-white even:bg-slate-50">
                      <td className="break-words px-3 py-3 font-semibold text-slate-950">
                        {row.name}
                      </td>
                      <td className="break-words px-3 py-3 tabular-nums">
                        {row.population2024.toLocaleString()}
                      </td>
                      <td className="break-words px-3 py-3">
                        {row.captain ? (
                          <span>{row.captain.name}</span>
                        ) : (
                          <span className="text-gray-500">
                            Not yet verified
                          </span>
                        )}
                      </td>
                      <td className="break-words px-3 py-3 tabular-nums">
                        {currentMpb.length
                          ? `${currentMpb.length} · ${peso.format(currentMpbAmount)}`
                          : '—'}
                      </td>
                      <td className="break-words px-3 py-3 tabular-nums">
                        {row.titleMatchedProjects.length || '—'}
                      </td>
                      <td className="break-words px-3 py-3">
                        <button
                          className="font-semibold text-blue-800 underline"
                          onClick={() => setExpanded(isOpen ? null : row.psgc)}
                        >
                          {isOpen ? 'Hide' : 'Show'} records
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-blue-100 bg-blue-50">
                        <td colSpan={6} className="px-4 py-5">
                          <div className="grid gap-6 lg:grid-cols-2">
                            <div>
                              <h2 className="font-bold text-slate-950">
                                FY2027 MPB records
                              </h2>
                              {currentMpb.length ? (
                                currentMpb.map((project, i) => (
                                  <article
                                    key={`${project.source}-${i}`}
                                    className="mt-3 rounded-lg border border-blue-100 bg-white p-3"
                                  >
                                    <p className="font-semibold">
                                      {project.title}
                                    </p>
                                    <p className="mt-1 text-sm">
                                      {peso.format(project.amountPesos)} ·{' '}
                                      {project.stage}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-600">
                                      {project.locationBasis};{' '}
                                      {project.identityConfidence}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">
                                      {project.source}
                                    </p>
                                  </article>
                                ))
                              ) : (
                                <p className="mt-2 text-sm text-gray-600">
                                  No FY2027 MPB record linked by the current
                                  source data.
                                </p>
                              )}
                            </div>
                            <div>
                              <h2 className="font-bold text-slate-950">
                                Historical and proposed DPWH title matches
                              </h2>
                              {row.titleMatchedProjects.length ? (
                                row.titleMatchedProjects.map((project, i) => (
                                  <article
                                    key={`${project.source}-${i}`}
                                    className="mt-3 rounded-lg border border-blue-100 bg-white p-3"
                                  >
                                    <p className="font-semibold">
                                      {project.title}
                                    </p>
                                    <p className="mt-1 text-sm">
                                      {project.year} · {project.category} ·{' '}
                                      {peso.format(project.amountPesos)}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">
                                      {project.source}
                                    </p>
                                  </article>
                                ))
                              ) : (
                                <p className="mt-2 text-sm text-gray-600">
                                  No current title match. Projects named at
                                  municipality or corridor level may not appear
                                  under a barangay.
                                </p>
                              )}
                            </div>
                          </div>
                          {row.captain && (
                            <p className="mt-5 text-xs text-gray-600">
                              {row.captain.status} ({row.captain.asOf}) Source:{' '}
                              <a
                                className="underline"
                                href={row.captain.source}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {row.captain.sourceLabel}
                              </a>
                              .
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {pagination}
      <p className="mt-4 text-xs leading-5 text-gray-500">
        Population source: PSA 2024 POPCEN, checked through the PSGC
        municipality record. MPB figures come from BetterGov’s title and
        source-line map. Project amounts are attached to every named barangay
        where a shared title mentions it and must not be added across rows as if
        each were a separate allocation.
      </p>
    </main>
  );
}
