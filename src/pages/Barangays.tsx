import { useMemo, useState } from 'react';
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

function downloadJson(rows: BarangayRecord[]) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], {
    type: 'application/json',
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = 'miagao-barangays.json';
  anchor.click();
  URL.revokeObjectURL(href);
}

export default function Barangays() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
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
            onChange={event => setQuery(event.target.value)}
            placeholder="Search barangay, captain, or project"
          />
        </label>
        <button
          type="button"
          onClick={() => downloadJson(filtered)}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900"
        >
          <Download size={16} /> Export visible rows
        </button>
        <span className="text-sm text-gray-600">
          {filtered.length} of {barangays.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-slate-950 text-white">
              <tr>
                <th className="px-4 py-3">Barangay</th>
                <th className="px-4 py-3">Population · 2024</th>
                <th className="px-4 py-3">Punong Barangay</th>
                <th className="px-4 py-3">FY2027 MPB</th>
                <th className="px-4 py-3">Title-matched DPWH records</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const currentMpb = row.mpb.records.filter(
                  project => project.year === 2027
                );
                const currentMpbAmount = currentMpb.reduce(
                  (sum, p) => sum + (p.amountPesos || 0),
                  0
                );
                const isOpen = expanded === row.psgc;
                return (
                  <>
                    <tr
                      key={row.psgc}
                      className="border-t border-gray-200 odd:bg-white even:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-950">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {row.population2024.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {row.captain ? (
                          <span>{row.captain.name}</span>
                        ) : (
                          <span className="text-gray-500">
                            Not yet verified
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {currentMpb.length
                          ? `${currentMpb.length} · ${peso.format(currentMpbAmount)}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {row.titleMatchedProjects.length || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="font-semibold text-blue-800 underline"
                          onClick={() => setExpanded(isOpen ? null : row.psgc)}
                        >
                          {isOpen ? 'Hide' : 'Show'} records
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr
                        key={`${row.psgc}-details`}
                        className="border-t border-blue-100 bg-blue-50"
                      >
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
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
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
