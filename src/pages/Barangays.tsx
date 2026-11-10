import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Search } from 'lucide-react';
import records from '../data/miagao-barangay-inventory.json';

type HistoricalProfile = {
  title: string;
  publishedAt: string;
  sourceUrl: string;
  contentText: string;
  historicalNote: string;
};
type Coordinate = [number, number];
type PolygonRings = Coordinate[][];
type BarangayGeometry =
  | { type: 'Polygon'; coordinates: PolygonRings }
  | { type: 'MultiPolygon'; coordinates: PolygonRings[] };
type BoundaryFeature = {
  type: 'Feature';
  properties: { brgy_name?: string; psgc?: string };
  geometry: BarangayGeometry;
};

function BarangayShape({
  name,
  geometry,
}: {
  name: string;
  geometry?: BarangayGeometry;
}) {
  if (!geometry) {
    return (
      <div className="flex h-24 w-28 items-center justify-center rounded-lg bg-slate-100 text-center text-xs text-slate-500">
        Boundary unavailable
      </div>
    );
  }
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const positions = polygons.flat(2);
  const xs = positions.map(point => point[0]);
  const ys = positions.map(point => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const paths = polygons.map(polygon =>
    polygon
      .map(
        ring =>
          ring
            .map(([longitude, latitude], index) => {
              const x = 4 + ((longitude - minX) / width) * 92;
              const y = 4 + ((maxY - latitude) / height) * 62;
              return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .join(' ') + ' Z'
      )
      .join(' ')
  );
  return (
    <svg
      viewBox="0 0 100 70"
      role="img"
      aria-label={`${name} barangay boundary`}
      className="h-24 w-28 rounded-lg bg-blue-50 p-1"
    >
      {paths.map((path, index) => (
        <path
          key={index}
          d={path}
          fill="#dbeafe"
          fillRule="evenodd"
          stroke="#1e40af"
          strokeWidth="1.1"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

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
    rosterTerm?: string;
    dilgRosterAsOf?: string;
  };
};

const barangays = records.barangays as BarangayRecord[];
const captainRoster = records.captainRoster as {
  snapshotDate: string;
  sourceUrl: string;
  barangayRows: number;
  captainRows: number;
  officialPositionRows: number;
  roleCounts: { role: string; count: number }[];
  termNote: string;
};
function normalizePlace(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/^brgy\.?\s*/, '')
    .replace(/^barangay\s*/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

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

function downloadRows(
  rows: BarangayRecord[],
  format: 'json' | 'csv',
  historicalProfiles: HistoricalProfile[]
) {
  const exportRows = rows.map(row => ({
    psgc: row.psgc,
    barangay: row.name,
    population2024: row.population2024,
    captain: row.captain?.name ?? '',
    captainRosterTerm: row.captain?.rosterTerm ?? '',
    captainRosterAsOf: row.captain?.asOf ?? '',
    captainStatusNote: row.captain?.status ?? '',
    captainSourceLabel: row.captain?.sourceLabel ?? '',
    captainSource: row.captain?.source ?? '',
    archived2018Profile:
      historicalProfiles.find(
        profile => normalizePlace(profile.title) === normalizePlace(row.name)
      )?.title ?? '',
    archived2018ProfilePublishedAt:
      historicalProfiles.find(
        profile => normalizePlace(profile.title) === normalizePlace(row.name)
      )?.publishedAt ?? '',
    archived2018ProfileSource:
      historicalProfiles.find(
        profile => normalizePlace(profile.title) === normalizePlace(row.name)
      )?.sourceUrl ?? '',
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
  const [historicalProfiles, setHistoricalProfiles] = useState<
    HistoricalProfile[]
  >([]);
  const [boundaryByPsgc, setBoundaryByPsgc] = useState<
    Map<string, BarangayGeometry>
  >(new Map());
  const [boundaryLoadState, setBoundaryLoadState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  useEffect(() => {
    let active = true;
    fetch(
      `${import.meta.env.BASE_URL}data/miagao-disclosure/barangay-history.json`
    )
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(payload => {
        if (active && Array.isArray(payload.barangayProfiles2018)) {
          setHistoricalProfiles(payload.barangayProfiles2018);
        }
      })
      .catch(() => {
        if (active) setHistoricalProfiles([]);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}data/miagao-barangay-boundaries.geojson`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload: { features?: BoundaryFeature[] }) => {
        const features = Array.isArray(payload.features)
          ? payload.features
          : [];
        if (active) {
          setBoundaryByPsgc(
            new Map(
              features.map(feature => [
                feature.properties.psgc ?? '',
                feature.geometry,
              ])
            )
          );
          setBoundaryLoadState(features.length ? 'ready' : 'error');
        }
      })
      .catch(() => {
        if (active) setBoundaryLoadState('error');
      });
    return () => {
      active = false;
    };
  }, []);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const profilesByBarangay = useMemo(
    () =>
      new Map(
        historicalProfiles.map(profile => [
          normalizePlace(profile.title),
          profile,
        ])
      ),
    [historicalProfiles]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return barangays;
    return barangays.filter(row =>
      [
        row.name,
        row.psgc,
        row.captain?.name ?? '',
        ...row.titleMatchedProjects.map(p => p.title),
        profilesByBarangay.get(normalizePlace(row.name))?.contentText ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(q)
    );
  }, [query, profilesByBarangay]);
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
  const rosterRoleRanks = captainRoster.roleCounts.map(row => ({
    label: row.role,
    value: row.count,
    display: row.count.toLocaleString(),
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
          The DILG Barangay Information System Region VI workbook provides a
          complete dated baseline: 119 Punong Barangay entries for Miagao’s 119
          barangays, in a snapshot dated 14 September 2025. It records the
          2023–2025 term and does not establish whether anyone changed office
          after that snapshot.
        </p>
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            {captainRoster.captainRows}
          </strong>
          <span className="text-sm text-gray-600">
            DILG captain entries · {captainRoster.barangayRows} barangays
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
        <BarangayRankChart
          title="Positions listed in Miagao · DILG roster"
          rows={rosterRoleRanks}
        />
      </section>

      <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <strong>Barangay captain roster:</strong> the DILG workbook lists{' '}
        {captainRoster.captainRows} Punong Barangay entries across all{' '}
        {captainRoster.barangayRows} Miagao barangays, within{' '}
        {captainRoster.officialPositionRows.toLocaleString()} total position
        records. This is a complete dated baseline from 14 September 2025 for
        the stated 2023–2025 term; it does not establish whether anyone changed
        office after the snapshot. Republic Act 12326 moved the next barangay
        election to November 2028.
        <div className="mt-2 flex flex-wrap gap-4">
          <a
            className="inline-flex items-center gap-1 font-semibold underline"
            href={captainRoster.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            DILG BIS Region VI workbook · 14 Sep 2025 <ExternalLink size={13} />
          </a>
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
            onClick={() => downloadRows(filtered, 'json', historicalProfiles)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900"
          >
            <Download size={16} /> Export JSON
          </button>
          <button
            type="button"
            onClick={() => downloadRows(filtered, 'csv', historicalProfiles)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-800 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
        <span className="text-sm text-gray-600">
          {filtered.length} of {barangays.length}
        </span>
      </div>

      <section className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">
            Barangays · map and archive profiles
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
            Each card shows the barangay boundary. Where the municipal 2018
            archive has a matching profile, it is linked here; missing archive
            profiles do not remove the map or barangay record.
          </p>
        </div>
        <span className="text-xs text-gray-500">
          {boundaryLoadState === 'ready'
            ? `${boundaryByPsgc.size} mapped shapes`
            : boundaryLoadState === 'loading'
              ? 'Loading barangay shapes…'
              : 'Barangay shapes unavailable'}
        </span>
      </section>
      <p className="mb-4 text-xs text-gray-500">
        Boundary source:{' '}
        <a
          className="underline"
          href="https://github.com/faeldon/philippines-json-maps"
          target="_blank"
          rel="noreferrer"
        >
          PSGC 3Q 2026 barangay boundaries
        </a>
        . Underlying source: NAMRIA and PSA through OCHA's COD-AB (CC BY-IGO).
        Boundary lines are indicative; barangay codes join the shapes to this
        page's records.
      </p>
      {pagination}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleRows.map(row => {
          const currentMpb = row.mpb.records.filter(
            project => project.year === 2027
          );
          const currentMpbAmount = currentMpb.reduce(
            (sum, project) => sum + (project.amountPesos || 0),
            0
          );
          const profile = profilesByBarangay.get(normalizePlace(row.name));
          const isOpen = expanded === row.psgc;
          const boundary = boundaryByPsgc.get(row.psgc);
          const profileSummary =
            profile?.contentText
              .replace(/^Brief History\s*/i, '')
              .slice(0, 360) ?? '';
          return (
            <article
              key={row.psgc}
              id={`barangay-${row.psgc}`}
              className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex gap-4">
                <BarangayShape name={row.name} geometry={boundary} />
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-lg font-bold text-slate-950">
                    {row.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">PSGC {row.psgc}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-gray-500">
                        Population · 2024
                      </dt>
                      <dd className="font-semibold">
                        {row.population2024.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">
                        Captain · DILG 2025
                      </dt>
                      <dd className="break-words font-semibold">
                        {row.captain?.name ?? 'Not listed'}
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
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                {profile ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                        2018 archive profile
                      </span>
                      <time
                        className="text-xs text-slate-500"
                        dateTime={profile.publishedAt}
                      >
                        {profile.publishedAt.slice(0, 10)}
                      </time>
                    </div>
                    <p className="mt-2 text-sm leading-5 text-slate-700">
                      {profileSummary}
                      {profile.contentText.length > 360 ? '…' : ''}
                    </p>
                    <a
                      className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-800 underline"
                      href={profile.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open full archived profile <ExternalLink size={13} />
                    </a>
                  </>
                ) : (
                  <p className="text-sm text-slate-600">
                    No matching profile page was found in the current 2018
                    archive import. Barangay boundary is shown above.
                  </p>
                )}
              </div>
              <button
                type="button"
                className="mt-4 min-h-10 rounded-lg border border-blue-800 px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50"
                onClick={() => setExpanded(isOpen ? null : row.psgc)}
              >
                {isOpen ? 'Hide linked records' : 'Show linked records'}
              </button>
              {isOpen && (
                <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                  <section>
                    <h4 className="font-bold text-slate-950">
                      FY2027 MPB records
                    </h4>
                    {currentMpb.length ? (
                      currentMpb.map((project, index) => (
                        <div
                          key={`${project.source}-${index}`}
                          className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                        >
                          <p className="font-semibold">{project.title}</p>
                          <p className="mt-1">
                            {peso.format(project.amountPesos)} · {project.stage}
                          </p>
                          <p className="mt-1 text-xs text-gray-600">
                            {project.locationBasis};{' '}
                            {project.identityConfidence}
                          </p>
                          <p className="mt-1 break-words text-xs text-gray-500">
                            {project.source}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="mt-1 text-sm text-gray-600">
                        No FY2027 MPB record linked by the current source data.
                      </p>
                    )}
                  </section>
                  <section>
                    <h4 className="font-bold text-slate-950">
                      Historical and proposed DPWH title matches
                    </h4>
                    {row.titleMatchedProjects.length ? (
                      row.titleMatchedProjects.map((project, index) => (
                        <div
                          key={`${project.source}-${index}`}
                          className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                        >
                          <p className="font-semibold">{project.title}</p>
                          <p className="mt-1">
                            {project.year} · {project.category} ·{' '}
                            {peso.format(project.amountPesos)}
                          </p>
                          <p className="mt-1 break-words text-xs text-gray-500">
                            {project.source}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="mt-1 text-sm text-gray-600">
                        No current title match. Municipality-level or corridor
                        projects may not appear under a barangay.
                      </p>
                    )}
                  </section>
                  {row.captain && (
                    <p className="break-words text-xs leading-5 text-gray-600">
                      {row.captain.status}{' '}
                      <a
                        className="font-semibold underline"
                        href={row.captain.source}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {row.captain.sourceLabel}
                      </a>
                      .
                    </p>
                  )}
                </div>
              )}
            </article>
          );
        })}
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
