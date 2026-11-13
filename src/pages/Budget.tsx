import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ExternalLink, Search } from 'lucide-react';

const API = 'https://budget.bettergov.ph/api/v1/hgab/2027';
const DATASETS = ['dpwh', 'fmr', 'hfep', 'nia'] as const;
const PAGE_SIZE = 200;
const MAX_ROWS = 4000;
type Dataset = (typeof DATASETS)[number];
type Group =
  | 'house_only'
  | 'nep_only'
  | 'unchanged'
  | 'increased'
  | 'decreased'
  | 'scope_review';
type Version = 'nep' | 'hgab2' | 'hgab3';

interface Disclaimer {
  id: string;
  title: string;
  body: string;
  url: string;
  restrictions_url?: string;
  upstream_restrictions_url?: string;
}

interface ProjectRow {
  id: string;
  dataset: Dataset;
  title: string;
  program: string | null;
  region: string | null;
  region_key: string | null;
  office: string | null;
  trace: string;
  status_label: string;
  bridge_group: Group;
  group_label: string;
  held: boolean;
  nep_php: number | null;
  hgab2_php: number | null;
  hgab3_php: number | null;
  house_php: number | null;
  delta_php: number | null;
  nep_page: number | null;
  hgab2_page: number | null;
  hgab3_page: number | null;
  pdf_url: Partial<Record<Version, string>>;
  flags: string[];
  url: string;
  api_url: string;
  titleMatched?: boolean;
}

interface ProjectList {
  total: number;
  sums: {
    nep_php: number | null;
    hgab2_php: number | null;
    hgab3_php: number | null;
    not_additive_across_versions: true;
  };
  rows: ProjectRow[];
}

interface Envelope<T> {
  meta: {
    notice: string;
    built_at: string;
    source_commit: string;
    currency: string;
    scale: string;
  };
  disclaimers: Disclaimer[];
  data: T;
}

interface QueryResult {
  dataset: Dataset;
  term: string;
  total: number;
  matched: number;
  truncated: boolean;
}

interface LoadedBudget {
  rows: ProjectRow[];
  disclaimers: Disclaimer[];
  notice: string;
  builtAt: string;
  queries: QueryResult[];
  truncated: boolean;
}

const DATASET_LABEL: Record<Dataset, string> = {
  dpwh: 'DPWH infrastructure',
  fmr: 'Farm-to-market roads',
  hfep: 'Health facilities',
  nia: 'NIA irrigation',
};

const GROUP_ORDER: Group[] = [
  'house_only',
  'nep_only',
  'increased',
  'decreased',
  'unchanged',
  'scope_review',
];

const peso = (value: number | null) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        maximumFractionDigits: 0,
      }).format(value);

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sourceHref(url: string | undefined, page: number | null) {
  if (!url) return undefined;
  if (page == null || /#page=\d+/.test(url)) return url;
  return `${url}#page=${page}`;
}

function apiRecordHref(row: Pick<ProjectRow, 'dataset' | 'id'>) {
  return `${API}/datasets/${row.dataset}/projects/${encodeURIComponent(row.id)}`;
}

async function readEnvelope(
  dataset: Dataset,
  term: string,
  offset: number,
  signal: AbortSignal
) {
  const url = new URL(`${API}/datasets/${dataset}/projects`);
  url.searchParams.set('q', term);
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.set('offset', String(offset));
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal,
  });
  if (!response.ok)
    throw new Error(
      `Budget API returned ${response.status} for ${DATASET_LABEL[dataset]}.`
    );
  return (await response.json()) as Envelope<ProjectList>;
}

async function readQuery(dataset: Dataset, term: string, signal: AbortSignal) {
  const first = await readEnvelope(dataset, term, 0, signal);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const ceiling = Math.min(first.data.total, MAX_ROWS);
  const offsets: number[] = [];
  for (let offset = PAGE_SIZE; offset < ceiling; offset += PAGE_SIZE)
    offsets.push(offset);
  const pages: Envelope<ProjectList>[] = [];
  for (let i = 0; i < offsets.length; i += 4) {
    const batch = offsets
      .slice(i, i + 4)
      .map(offset => readEnvelope(dataset, term, offset, signal));
    pages.push(...(await Promise.all(batch)));
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  }
  const rows = [first, ...pages].flatMap(page => page.data.rows);
  return {
    rows,
    first,
    total: first.data.total,
    truncated: first.data.total > MAX_ROWS,
  };
}

async function loadBudget(signal: AbortSignal): Promise<LoadedBudget> {
  // The spelling variants catch titles published as either “Miagao” or “Miag-ao”.
  const jobs = DATASETS.flatMap(dataset =>
    ['Miagao', 'Miag-ao'].map(term => ({ dataset, term }))
  );
  const results = await Promise.all(
    jobs.map(({ dataset, term }) => readQuery(dataset, term, signal))
  );
  const rows = new Map<string, ProjectRow>();
  const disclaimers = new Map<string, Disclaimer>();
  const queries: QueryResult[] = [];
  let notice = '';
  let builtAt = '';
  let truncated = false;

  for (const [index, result] of results.entries()) {
    const { dataset, term } = jobs[index];
    notice ||= result.first.meta.notice;
    builtAt ||= result.first.meta.built_at;
    for (const item of result.first.disclaimers) disclaimers.set(item.id, item);
    // Keep every API result, including rows whose search match may come from
    // metadata rather than title or whose stated region needs human review.
    for (const row of result.rows) {
      const key = `${row.dataset}:${row.id}`;
      const existing = rows.get(key);
      rows.set(key, {
        ...existing,
        ...row,
        titleMatched: normalize(row.title).includes('miagao'),
      });
    }
    queries.push({
      dataset,
      term,
      total: result.total,
      matched: result.rows.length,
      truncated: result.truncated,
    });
    truncated ||= result.truncated;
  }

  return {
    rows: [...rows.values()].sort(
      (a, b) =>
        GROUP_ORDER.indexOf(a.bridge_group) -
          GROUP_ORDER.indexOf(b.bridge_group) || a.title.localeCompare(b.title)
    ),
    disclaimers: [...disclaimers.values()],
    notice,
    builtAt,
    queries,
    truncated,
  };
}

function ExportButton({ rows }: { rows: ProjectRow[] }) {
  function download() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: 'application/json',
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'miagao-fy2027-budget-projects.json';
    link.click();
    URL.revokeObjectURL(href);
  }
  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-800 px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50"
    >
      <ArrowDownToLine size={15} /> Download shown rows
    </button>
  );
}

export default function Budget() {
  const [loaded, setLoaded] = useState<LoadedBudget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [dataset, setDataset] = useState<'all' | Dataset>('all');
  const [group, setGroup] = useState<'all' | Group>('all');

  useEffect(() => {
    const controller = new AbortController();
    loadBudget(controller.signal)
      .then(setLoaded)
      .catch(reason => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load budget rows.'
          );
      });
    return () => controller.abort();
  }, []);

  const rows = useMemo(() => {
    if (!loaded) return [];
    const q = normalize(query);
    return loaded.rows.filter(
      row =>
        (dataset === 'all' || row.dataset === dataset) &&
        (group === 'all' || row.bridge_group === group) &&
        (!q ||
          normalize(
            `${row.title} ${row.program ?? ''} ${row.office ?? ''}`
          ).includes(q))
    );
  }, [dataset, group, loaded, query]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => {
          if (row.nep_php != null) {
            sum.nep += row.nep_php;
            sum.nepRows++;
          }
          if (row.house_php != null) {
            sum.house += row.house_php;
            sum.houseRows++;
          }
          return sum;
        },
        { nep: 0, house: 0, nepRows: 0, houseRows: 0 }
      ),
    [rows]
  );

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-9">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-200">
          Miagao · National budget
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          FY2027 projects in the NEP and House bill
        </h1>
        <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-300">
          Compare the National Expenditure Program (NEP) with the House of
          Representatives’ version of House Bill 10858 for project rows whose
          published titles name Miagao, Iloilo.
        </p>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
          These are proposed amounts, not spending. Rows found in one version or
          paired across versions are review candidates; the API’s matching
          labels do not prove that two differently named lines are the same
          project.
        </p>
        <div
          className="mt-7 grid gap-3 md:grid-cols-3"
          aria-label="Separate budget version totals"
        >
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-300">NEP · President’s proposal</p>
            <strong className="mt-2 block text-2xl sm:text-3xl">
              {loaded ? peso(totals.nep) : 'Loading…'}
            </strong>
            <p className="mt-1 text-sm text-slate-300">
              {totals.nepRows} rows with an NEP amount
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-300">
              House Bill 10858 · House version
            </p>
            <strong className="mt-2 block text-2xl sm:text-3xl">
              {loaded ? peso(totals.house) : 'Loading…'}
            </strong>
            <p className="mt-1 text-sm text-slate-300">
              {totals.houseRows} rows with a House amount
            </p>
          </article>
          <article className="rounded-2xl bg-blue-700 p-5">
            <p className="text-sm text-blue-100">Compared project rows</p>
            <strong className="mt-2 block text-3xl">
              {loaded ? rows.length.toLocaleString() : '…'}
            </strong>
            <p className="mt-1 text-sm text-blue-100">
              Filtered rows · compare versions, never add them
            </p>
          </article>
        </div>
      </header>

      <section
        className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"
        aria-labelledby="budget-scope-title"
      >
        <h2 id="budget-scope-title" className="font-bold">
          Coverage and location limits
        </h2>
        <p className="mt-2">
          This page searches the API’s four project-list programs: DPWH
          infrastructure, DA farm-to-market roads, DOH health facilities, and
          NIA irrigation. It keeps every result for “Miagao” and “Miag-ao”;
          nothing is dropped by region. Review each row’s title and region: some
          search matches may come from metadata, and a project named only for a
          barangay may be missed. A title match does not verify the project’s
          footprint. NIA rows do not publish a region, so they need particular
          location review.
        </p>
        <p className="mt-2">
          The API marks possible insertions, deletions, and amount changes as
          candidates. A line found on one side only is not proof of a confirmed
          addition or deletion. Missing amount is shown as a dash, never zero.
          No returned API rows are silently excluded; use the filters to inspect
          the complete returned set.
        </p>
      </section>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"
        >
          <strong>Could not load FY2027 project rows.</strong> {error}{' '}
          <a
            className="font-semibold underline"
            href="https://budget.bettergov.ph/api/v1/hgab/2027"
            target="_blank"
            rel="noreferrer"
          >
            Open the Budget API <ExternalLink size={12} className="inline" />
          </a>
        </div>
      )}

      {loaded?.truncated && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          At least one API query exceeded the page’s 4,000-row safety limit. The
          displayed results may be incomplete; query counts and the dataset
          filters below identify each search.
        </div>
      )}

      {loaded && (
        <>
          <section
            className="mb-8 rounded-2xl border border-gray-200 bg-white p-5"
            aria-labelledby="api-disclosure-title"
          >
            <h2
              id="api-disclosure-title"
              className="text-lg font-bold text-slate-950"
            >
              Source notice and API disclaimers
            </h2>
            {loaded.notice && (
              <p className="mt-2 text-sm leading-6 text-gray-700">
                {loaded.notice}
              </p>
            )}
            <ul className="mt-3 space-y-3">
              {loaded.disclaimers.map(item => (
                <li key={item.id} className="text-sm leading-6 text-gray-700">
                  <strong>{item.title}</strong> {item.body}{' '}
                  <a
                    className="font-semibold text-blue-800 underline"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Full disclaimer{' '}
                    <ExternalLink size={12} className="inline" />
                  </a>
                  {item.restrictions_url && (
                    <>
                      {' '}
                      ·{' '}
                      <a
                        className="font-semibold text-blue-800 underline"
                        href={item.restrictions_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Use restrictions
                      </a>
                    </>
                  )}
                  {item.upstream_restrictions_url && (
                    <>
                      {' '}
                      ·{' '}
                      <a
                        className="font-semibold text-blue-800 underline"
                        href={item.upstream_restrictions_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Upstream restrictions
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-gray-500">
              People’s Budget Coalition × BetterGov.ph · API snapshot{' '}
              {loaded.builtAt
                ? new Date(loaded.builtAt).toLocaleString('en-PH')
                : 'date unavailable'}{' '}
              ·{' '}
              <a
                className="font-semibold text-blue-800 underline"
                href="https://budget.bettergov.ph/docs"
                target="_blank"
                rel="noreferrer"
              >
                API documentation
              </a>
            </p>
          </section>

          <section
            className="mb-8 rounded-2xl border border-gray-200 bg-white p-5"
            aria-labelledby="budget-queries-title"
          >
            <h2
              id="budget-queries-title"
              className="text-lg font-bold text-slate-950"
            >
              Search coverage
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Searches are kept separate by program and spelling; duplicate rows
              are shown once.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {DATASETS.map(key => {
                const parts = loaded.queries.filter(
                  item => item.dataset === key
                );
                return (
                  <div key={key} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <strong>{DATASET_LABEL[key]}</strong>
                    <p className="mt-1 text-gray-600">
                      {loaded.rows.filter(row => row.dataset === key).length}{' '}
                      unique API results across both spellings
                    </p>
                    {parts.some(part => part.truncated) && (
                      <p className="mt-1 font-semibold text-amber-800">
                        Query capped; results incomplete
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="budget-rows-title">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="budget-rows-title"
                  className="text-2xl font-bold text-slate-950"
                >
                  Project-by-project comparison
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  The NEP and House totals above are separate versions of the
                  same budget.
                </p>
              </div>
              <ExportButton rows={rows} />
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <label className="relative">
                <span className="sr-only">Search project titles</span>
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <input
                  className="h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search titles, office or program"
                />
              </label>
              <label>
                <span className="sr-only">Filter program</span>
                <select
                  className="h-11 w-full rounded-lg border border-gray-300 px-3"
                  value={dataset}
                  onChange={event =>
                    setDataset(event.target.value as 'all' | Dataset)
                  }
                >
                  <option value="all">All programs</option>
                  {DATASETS.map(key => (
                    <option key={key} value={key}>
                      {DATASET_LABEL[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Filter comparison status</span>
                <select
                  className="h-11 w-full rounded-lg border border-gray-300 px-3"
                  value={group}
                  onChange={event =>
                    setGroup(event.target.value as 'all' | Group)
                  }
                >
                  <option value="all">All comparison labels</option>
                  {GROUP_ORDER.map(value => (
                    <option key={value} value={value}>
                      {value.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mb-3 text-sm text-gray-600" aria-live="polite">
              Showing {rows.length} of {loaded.rows.length} matched project
              rows.
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-3 py-3">Program / status</th>
                    <th className="px-3 py-3">Project title</th>
                    <th className="px-3 py-3 text-right">NEP</th>
                    <th className="px-3 py-3 text-right">House bill</th>
                    <th className="px-3 py-3">Source documents</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const nep = sourceHref(row.pdf_url.nep, row.nep_page);
                    const house = sourceHref(
                      row.pdf_url.hgab3 ?? row.pdf_url.hgab2,
                      row.hgab3_page ?? row.hgab2_page
                    );
                    return (
                      <tr
                        key={`${row.dataset}:${row.id}`}
                        className="border-t border-gray-200 align-top odd:bg-white even:bg-slate-50"
                      >
                        <td className="w-48 px-3 py-3">
                          <strong>{DATASET_LABEL[row.dataset]}</strong>
                          <span className="mt-1 block text-xs text-gray-600">
                            {row.status_label}
                          </span>
                          {row.held && (
                            <span className="mt-1 block text-xs font-semibold text-amber-800">
                              Pairing needs review
                            </span>
                          )}
                        </td>
                        <td className="min-w-80 px-3 py-3">
                          <a
                            className="font-semibold text-blue-900 underline decoration-blue-300 underline-offset-2"
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {row.title}{' '}
                            <ExternalLink size={12} className="inline" />
                          </a>
                          <span className="mt-1 block text-xs text-gray-600">
                            {row.region ?? 'Region not stated'}
                            {row.office ? ` · ${row.office}` : ''}
                          </span>
                          {!row.titleMatched && (
                            <span className="mt-1 block text-xs font-semibold text-amber-800">
                              Search hit outside title · location review
                            </span>
                          )}
                          {row.region_key != null &&
                            row.region_key !== 'VI' && (
                              <span className="mt-1 block text-xs font-semibold text-amber-800">
                                Region differs from Miagao · location review
                              </span>
                            )}
                          {row.flags.length > 0 && (
                            <span className="mt-1 block text-xs text-amber-800">
                              {row.flags.join(' · ')}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                          {peso(row.nep_php)}
                          {nep && row.nep_page != null && (
                            <a
                              className="mt-1 block text-xs font-semibold text-blue-800 underline"
                              href={nep}
                              target="_blank"
                              rel="noreferrer"
                            >
                              NEP p. {row.nep_page}
                            </a>
                          )}
                          {row.nep_php != null && !nep && (
                            <span className="mt-1 block text-xs text-gray-500">
                              NEP page link not supplied
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                          {peso(row.house_php)}
                          {house &&
                            (row.hgab3_page ?? row.hgab2_page) != null && (
                              <a
                                className="mt-1 block text-xs font-semibold text-blue-800 underline"
                                href={house}
                                target="_blank"
                                rel="noreferrer"
                              >
                                House p. {row.hgab3_page ?? row.hgab2_page}
                              </a>
                            )}
                          {row.house_php != null && !house && (
                            <span className="mt-1 block text-xs text-gray-500">
                              House page link not supplied
                            </span>
                          )}
                        </td>
                        <td className="w-52 px-3 py-3 text-xs leading-5 text-gray-700">
                          <span className="block">{row.group_label}</span>
                          <a
                            className="mt-1 inline-block font-semibold text-blue-800 underline"
                            href={apiRecordHref(row)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            API record{' '}
                            <ExternalLink size={11} className="inline" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-gray-600"
                      >
                        No rows match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
