import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Search, X } from 'lucide-react';
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
  onClick,
}: {
  name: string;
  geometry?: BarangayGeometry;
  onClick: () => void;
}) {
  if (!geometry)
    return (
      <button
        type="button"
        disabled
        className="flex h-24 w-28 shrink-0 items-center justify-center rounded-lg bg-slate-100 px-2 text-center text-xs text-slate-500"
        aria-label={`${name} boundary unavailable`}
      >
        Boundary unavailable
      </button>
    );
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
    <button
      type="button"
      onClick={onClick}
      title={`Show ${name} within Miagao`}
      className="group flex w-28 shrink-0 flex-col items-center gap-1 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
      aria-label={`Show ${name} boundary within Miagao`}
    >
      <svg
        viewBox="0 0 100 70"
        role="img"
        aria-hidden="true"
        className="h-24 w-28 rounded-lg bg-blue-50 p-1 group-hover:bg-blue-100"
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
      <span className="text-center text-[11px] font-semibold leading-4 text-blue-800 underline decoration-blue-300 underline-offset-2 group-hover:text-blue-950">
        View in Miagao
      </span>
    </button>
  );
}

function geometryPolygons(geometry: BarangayGeometry) {
  return geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates;
}

function MiagaoBarangayMap({
  name,
  selectedPsgc,
  geometries,
}: {
  name: string;
  selectedPsgc: string;
  geometries: Map<string, BarangayGeometry>;
}) {
  const entries = [...geometries.entries()];
  const points = entries.flatMap(([, geometry]) =>
    geometryPolygons(geometry).flat(2)
  );
  if (!points.length)
    return (
      <p className="p-6 text-sm text-slate-600">
        Barangay boundaries are unavailable.
      </p>
    );

  const minLon = Math.min(...points.map(point => point[0]));
  const maxLon = Math.max(...points.map(point => point[0]));
  const minLat = Math.min(...points.map(point => point[1]));
  const maxLat = Math.max(...points.map(point => point[1]));
  const centerLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const cosLat = Math.cos(centerLat);
  const width = Math.max((maxLon - minLon) * cosLat, 0.00001);
  const height = Math.max(maxLat - minLat, 0.00001);
  const viewWidth = 900;
  const viewHeight = 660;
  const padding = 30;
  const scale = Math.min(
    (viewWidth - padding * 2) / width,
    (viewHeight - padding * 2) / height
  );
  const offsetX = (viewWidth - width * scale) / 2;
  const offsetY = (viewHeight - height * scale) / 2;
  const project = ([longitude, latitude]: Coordinate): Coordinate => [
    offsetX + (longitude - minLon) * cosLat * scale,
    offsetY + (maxLat - latitude) * scale,
  ];
  const pathFor = (geometry: BarangayGeometry) =>
    geometryPolygons(geometry)
      .map(polygon =>
        polygon
          .map(
            ring =>
              ring
                .map((point, index) => {
                  const [x, y] = project(point);
                  return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
                })
                .join(' ') + ' Z'
          )
          .join(' ')
      )
      .join(' ');
  const sorted = entries.sort(([a], [b]) =>
    a === selectedPsgc ? 1 : b === selectedPsgc ? -1 : a.localeCompare(b)
  );

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      role="img"
      aria-label={`${name} highlighted within the Miagao municipal boundary`}
      className="block max-h-[65vh] w-full rounded-xl bg-sky-50"
    >
      {sorted.map(([psgc, geometry]) => {
        const selected = psgc === selectedPsgc;
        return (
          <path
            key={psgc}
            d={pathFor(geometry)}
            fill={selected ? '#fbbf24' : '#dbeafe'}
            fillRule="evenodd"
            stroke={selected ? '#92400e' : '#1e40af'}
            strokeWidth={selected ? 2.2 : 0.8}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

type BarangayRecord = {
  psgc: string;
  name: string;
  population2024: number;
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
type LocalProjectRecord = {
  id: string;
  stage: string;
  year: number;
  quarter?: number;
  title: string;
  location?: string;
  sourceUrl?: string;
  sourceDocument?: string;
  sourceSheet?: string;
  sourceRow?: number;
  listedAmountPesos?: number;
  assignedAmountForBarangayPesos?: number;
  plannedProcurementAmountPesos?: number;
  plannedAmountShareForBarangayPesos?: number;
  approvedBudgetPesos?: number;
  bidAmountPesos?: number;
  reference?: string;
  remarks?: string;
};
type LocalBarangayRecord = {
  psgc: string;
  name: string;
  ntaProjectRows: number;
  ntaListedAmountPesos: number;
  directBarangayRows: number;
  directBarangayAmountPesos: number;
  releasedDirectRows: number;
  releasedDirectAmountPesos: number;
  otherNtaRows: number;
  appRows: number;
  appPlannedAmountPesos: number;
  civilWorksBidRows: number;
  ntaRecords: LocalProjectRecord[];
  appRecords: LocalProjectRecord[];
  bidRecords: LocalProjectRecord[];
};
type LocalAllocationData = {
  sources: { label: string; url: string; period: string; type: string }[];
  summary: {
    ntaListedAmountPesos: number;
    ntaLocatedRows: number;
    ntaLocatedAmountPesos: number;
    ntaUnlocatedRows: number;
    ntaUnlocatedAmountPesos: number;
    appBarangayProjectRows: number;
    appPlannedAmountPesos: number;
    civilWorksBidRows: number;
  };
  barangays: LocalBarangayRecord[];
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

function downloadLocalBarangayRows(
  rows: LocalBarangayRecord[],
  format: 'json' | 'csv'
) {
  const exportRows = rows.map(row => ({
    psgc: row.psgc,
    barangay: row.name,
    q3_2026_nta_listed_amount_pesos: row.ntaListedAmountPesos,
    q3_2026_nta_project_rows: row.ntaProjectRows,
    direct_barangay_assistance_pesos: row.directBarangayAmountPesos,
    direct_barangay_assistance_rows: row.directBarangayRows,
    released_direct_assistance_pesos: row.releasedDirectAmountPesos,
    released_direct_assistance_rows: row.releasedDirectRows,
    app_planned_amount_pesos: row.appPlannedAmountPesos,
    app_project_rows: row.appRows,
    civil_works_bid_records: row.civilWorksBidRows,
    nta_source_rows: row.ntaRecords
      .map(
        record =>
          `${record.title} [${record.sourceDocument}, row ${record.sourceRow}] ${record.sourceUrl}`
      )
      .join(' | '),
    app_source_rows: row.appRecords
      .map(
        record =>
          `${record.title} [${record.sourceDocument}, row ${record.sourceRow}] ${record.sourceUrl}`
      )
      .join(' | '),
    bid_source_rows: row.bidRecords
      .map(
        record =>
          `${record.title} [${record.reference}; ${record.sourceDocument}, row ${record.sourceRow}] ${record.sourceUrl}`
      )
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
  const href = URL.createObjectURL(
    new Blob([format === 'json' ? JSON.stringify(exportRows, null, 2) : csv], {
      type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
    })
  );
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `miagao-local-allocations-by-barangay.${format}`;
  anchor.click();
  URL.revokeObjectURL(href);
}

export default function Barangays() {
  const [query, setQuery] = useState('');
  const [historicalProfiles, setHistoricalProfiles] = useState<
    HistoricalProfile[]
  >([]);
  const [localAllocationData, setLocalAllocationData] =
    useState<LocalAllocationData | null>(null);
  const [localTablePage, setLocalTablePage] = useState(0);
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
    fetch(`${import.meta.env.BASE_URL}data/miagao-local-allocations.json`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<LocalAllocationData>;
      })
      .then(payload => {
        if (active) setLocalAllocationData(payload);
      })
      .catch(() => {
        if (active) setLocalAllocationData(null);
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
  const [mapBarangay, setMapBarangay] = useState<{
    psgc: string;
    name: string;
  } | null>(null);
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
  const localByPsgc = useMemo(
    () =>
      new Map(
        (localAllocationData?.barangays ?? []).map(row => [row.psgc, row])
      ),
    [localAllocationData]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return barangays;
    return barangays.filter(row =>
      [
        row.name,
        row.psgc,
        row.captain?.name ?? '',
        ...(localByPsgc.get(row.psgc)
          ? [
              ...localByPsgc.get(row.psgc)!.ntaRecords.map(item => item.title),
              ...localByPsgc.get(row.psgc)!.appRecords.map(item => item.title),
              ...localByPsgc.get(row.psgc)!.bidRecords.map(item => item.title),
            ]
          : []),
        profilesByBarangay.get(normalizePlace(row.name))?.contentText ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(q)
    );
  }, [query, profilesByBarangay, localByPsgc]);
  const visibleRows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const firstRow = filtered.length ? page * pageSize + 1 : 0;
  const lastRow = Math.min(filtered.length, (page + 1) * pageSize);
  const localNtaRanks = [...(localAllocationData?.barangays ?? [])]
    .filter(row => row.ntaListedAmountPesos > 0)
    .sort(
      (a, b) =>
        b.ntaListedAmountPesos - a.ntaListedAmountPesos ||
        a.name.localeCompare(b.name)
    )
    .slice(0, 8)
    .map(row => ({
      label: row.name,
      value: row.ntaListedAmountPesos,
      display: peso.format(row.ntaListedAmountPesos),
    }));
  const visibleLocalTableRows = [...(localAllocationData?.barangays ?? [])]
    .filter(row => filtered.some(barangay => barangay.psgc === row.psgc))
    .sort(
      (a, b) =>
        b.ntaListedAmountPesos - a.ntaListedAmountPesos ||
        a.name.localeCompare(b.name)
    );
  const localTablePageSize = 20;
  const localTablePageCount = Math.max(
    1,
    Math.ceil(visibleLocalTableRows.length / localTablePageSize)
  );
  const currentLocalTableRows = visibleLocalTableRows.slice(
    localTablePage * localTablePageSize,
    (localTablePage + 1) * localTablePageSize
  );
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
          Population, barangay officials, local budget records, and procurement
          entries published by the Municipality of Miagao.
        </p>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          The DILG Barangay Information System Region VI workbook provides a
          complete dated baseline: 119 Punong Barangay entries for Miagao’s 119
          barangays, in a snapshot dated 14 September 2025. It records the
          2023–2025 term and does not establish whether anyone changed office
          after that snapshot.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          <a
            className="font-semibold text-blue-800 underline"
            href={records.sources.psgcAndPopulation}
            target="_blank"
            rel="noreferrer"
          >
            PSA · PSGC and population reference{' '}
            <ExternalLink size={12} className="inline" />
          </a>
          <a
            className="font-semibold text-blue-800 underline"
            href={captainRoster.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            DILG · dated roster source{' '}
            <ExternalLink size={12} className="inline" />
          </a>
          <a
            className="font-semibold text-blue-800 underline"
            href={records.sources.historicalAndFy2027DpwhProjects}
            target="_blank"
            rel="noreferrer"
          >
            BetterGov · national project data{' '}
            <ExternalLink size={12} className="inline" />
          </a>
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2">
          <Search size={17} className="text-gray-500" />
          <input
            className="w-full border-0 bg-transparent text-sm outline-none"
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setPage(0);
              setLocalTablePage(0);
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
          const localStats = localByPsgc.get(row.psgc);
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
                <BarangayShape
                  name={row.name}
                  geometry={boundary}
                  onClick={() =>
                    setMapBarangay({ psgc: row.psgc, name: row.name })
                  }
                />
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
                      <dt className="text-xs text-gray-500">
                        2026 Q3 · 20% NTA
                      </dt>
                      <dd>
                        {localStats?.ntaProjectRows
                          ? `${peso.format(localStats.ntaListedAmountPesos)} · ${localStats.ntaProjectRows} rows`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">
                        APP plans · bid records
                      </dt>
                      <dd>
                        {localStats &&
                        (localStats.appRows || localStats.civilWorksBidRows)
                          ? `${localStats.appRows} · ${localStats.civilWorksBidRows}`
                          : '—'}
                      </dd>
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
                      Local NTA, procurement, and bid records · 2026
                    </h4>
                    {localStats &&
                    (localStats.ntaRecords.length ||
                      localStats.appRecords.length ||
                      localStats.bidRecords.length) ? (
                      <div className="mt-2 space-y-3">
                        {localStats.ntaRecords.map(record => (
                          <div
                            key={record.id}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                          >
                            <p className="font-semibold">{record.title}</p>
                            <p className="mt-1">
                              Q3 20% NTA schedule · listed project cost{' '}
                              {peso.format(
                                record.assignedAmountForBarangayPesos ??
                                  record.listedAmountPesos ??
                                  0
                              )}
                            </p>
                            {record.remarks && (
                              <p className="mt-1 text-xs text-gray-600">
                                Status / remarks: {record.remarks}
                              </p>
                            )}
                            {record.sourceUrl && (
                              <a
                                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-800 underline"
                                href={record.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Source · {record.sourceDocument}, row{' '}
                                {record.sourceRow} <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        ))}
                        {localStats.appRecords.map(record => (
                          <div
                            key={record.id}
                            className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
                          >
                            <p className="font-semibold">{record.title}</p>
                            <p className="mt-1">
                              Annual Procurement Plan · planned amount{' '}
                              {peso.format(
                                record.plannedProcurementAmountPesos ?? 0
                              )}
                            </p>
                            {record.sourceUrl && (
                              <a
                                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-800 underline"
                                href={record.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Source · {record.sourceDocument}, row{' '}
                                {record.sourceRow} <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        ))}
                        {localStats.bidRecords.map(record => (
                          <div
                            key={record.id}
                            className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm"
                          >
                            <p className="font-semibold">{record.title}</p>
                            <p className="mt-1">
                              Civil-works bid result · Ref{' '}
                              {record.reference || '—'}
                            </p>
                            <p className="mt-1 text-xs text-gray-700">
                              Approved budget{' '}
                              {peso.format(record.approvedBudgetPesos ?? 0)}
                              {record.bidAmountPesos != null &&
                                ` · Bid ${peso.format(record.bidAmountPesos)}`}
                            </p>
                            {record.sourceUrl && (
                              <a
                                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-800 underline"
                                href={record.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Source · {record.sourceDocument}, row{' '}
                                {record.sourceRow} <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-gray-600">
                        No barangay-named NTA, APP, or civil-works bid record in
                        the current 2026 source files.
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
      <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Local allocations and project records · by barangay
            </h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-gray-600">
              Q3 2026 20% NTA schedule amounts are listed project costs, not
              necessarily expenditures. Annual procurement-plan amounts and bid
              results are shown separately and are not added to NTA totals.
              Search above also filters this table by matching project title.
            </p>
          </div>
          {localAllocationData && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadLocalBarangayRows(visibleLocalTableRows, 'json')
                }
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-800 px-3 py-2 text-xs font-bold text-white hover:bg-blue-900"
              >
                <Download size={15} /> Export local JSON
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadLocalBarangayRows(visibleLocalTableRows, 'csv')
                }
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-800 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-50"
              >
                <Download size={15} /> Export local CSV
              </button>
            </div>
          )}
        </div>
        {!localAllocationData ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-gray-600">
            Local allocation data could not be loaded.
          </p>
        ) : (
          <>
            <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-lg bg-emerald-50 p-3">
                <span className="block text-xs text-emerald-900">
                  All Q3 20% NTA schedule entries
                </span>
                <strong className="mt-1 block text-lg tabular-nums text-slate-950">
                  {peso.format(
                    localAllocationData.summary.ntaListedAmountPesos
                  )}
                </strong>
              </article>
              <article className="rounded-lg bg-blue-50 p-3">
                <span className="block text-xs text-blue-900">
                  Barangay-named NTA entries
                </span>
                <strong className="mt-1 block text-lg tabular-nums text-slate-950">
                  {peso.format(
                    localAllocationData.summary.ntaLocatedAmountPesos
                  )}{' '}
                  · {localAllocationData.summary.ntaLocatedRows} rows
                </strong>
              </article>
              <article className="rounded-lg bg-amber-50 p-3">
                <span className="block text-xs text-amber-900">
                  APP planned projects naming barangays
                </span>
                <strong className="mt-1 block text-lg tabular-nums text-slate-950">
                  {peso.format(
                    localAllocationData.summary.appPlannedAmountPesos
                  )}{' '}
                  · {localAllocationData.summary.appBarangayProjectRows} rows
                </strong>
              </article>
              <article className="rounded-lg bg-green-50 p-3">
                <span className="block text-xs text-green-900">
                  Civil-works bid records
                </span>
                <strong className="mt-1 block text-lg tabular-nums text-slate-950">
                  {localAllocationData.summary.civilWorksBidRows} · Q1 and Q3
                </strong>
              </article>
            </div>
            <div className="w-full">
              <table className="w-full table-fixed border-collapse text-left text-[11px] leading-4 sm:text-xs">
                <colgroup>
                  <col className="w-[25%]" />
                  <col className="w-[23%]" />
                  <col className="w-[22%]" />
                  <col className="w-[19%]" />
                  <col className="w-[11%]" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="break-words p-2 font-semibold">Barangay</th>
                    <th className="break-words p-2 text-right font-semibold">
                      Q3 NTA listed amount · rows
                    </th>
                    <th className="break-words p-2 text-right font-semibold">
                      Direct assistance · rows
                    </th>
                    <th className="break-words p-2 text-right font-semibold">
                      APP planned amount · rows
                    </th>
                    <th className="break-words p-2 text-right font-semibold">
                      Bid records
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentLocalTableRows.map(row => (
                    <tr key={row.psgc} className="border-b border-slate-200">
                      <td className="break-words p-2 font-semibold">
                        <a
                          className="text-blue-800 underline underline-offset-2"
                          href={`#barangay-${row.psgc}`}
                        >
                          {row.name}
                        </a>
                      </td>
                      <td className="break-words p-2 text-right tabular-nums">
                        {row.ntaProjectRows
                          ? `${peso.format(row.ntaListedAmountPesos)} · ${row.ntaProjectRows}`
                          : '—'}
                      </td>
                      <td className="break-words p-2 text-right tabular-nums">
                        {row.directBarangayRows
                          ? `${peso.format(row.directBarangayAmountPesos)} · ${row.directBarangayRows} (${row.releasedDirectRows} released)`
                          : '—'}
                      </td>
                      <td className="break-words p-2 text-right tabular-nums">
                        {row.appRows
                          ? `${peso.format(row.appPlannedAmountPesos)} · ${row.appRows}`
                          : '—'}
                      </td>
                      <td className="break-words p-2 text-right tabular-nums">
                        {row.civilWorksBidRows || '—'}
                      </td>
                    </tr>
                  ))}
                  {!currentLocalTableRows.length && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-gray-600">
                        No barangay matches the current search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-gray-600">
                {visibleLocalTableRows.length} barangays · Page{' '}
                {localTablePage + 1} of {localTablePageCount} · 20 per page
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={localTablePage === 0}
                  onClick={() =>
                    setLocalTablePage(value => Math.max(0, value - 1))
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={localTablePage + 1 >= localTablePageCount}
                  onClick={() =>
                    setLocalTablePage(value =>
                      Math.min(localTablePageCount - 1, value + 1)
                    )
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
              {localAllocationData.sources.map(source => (
                <a
                  key={source.label}
                  className="font-semibold text-blue-800 underline"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.label} ↗
                </a>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-gray-500">
              The remaining {localAllocationData.summary.ntaUnlocatedRows} Q3
              NTA entries (
              {peso.format(localAllocationData.summary.ntaUnlocatedAmountPesos)}
              ) do not name a specific barangay and are excluded from barangay
              totals. Multi-barangay projects are equally split for this table;
              this is a display estimate, not an official barangay allocation.
              APP and bid rows are procurement-stage records, not additional
              funding.
            </p>
          </>
        )}
      </section>

      <section
        className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        aria-label="Local barangay statistics"
      >
        <div className="rounded-xl bg-slate-950 p-5 text-white">
          <strong className="block text-3xl">{barangays.length}</strong>
          <span className="text-sm text-slate-300">PSGC barangays</span>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <strong className="block text-3xl">
            {captainRoster.captainRows}
          </strong>
          <span className="text-sm text-gray-600">
            DILG captain entries · 2025 snapshot
          </span>
        </div>
        {localAllocationData && (
          <>
            <div className="rounded-xl bg-emerald-50 p-5">
              <strong className="block text-3xl">
                {localAllocationData.summary.ntaLocatedRows.toLocaleString()}
              </strong>
              <span className="text-sm text-emerald-950">
                barangay-named Q3 20% NTA rows
              </span>
            </div>
            <div className="rounded-xl bg-amber-50 p-5">
              <strong className="block text-3xl">
                {localAllocationData.summary.appBarangayProjectRows.toLocaleString()}
              </strong>
              <span className="text-sm text-amber-950">
                APP rows naming barangays
              </span>
            </div>
            <div className="rounded-xl bg-green-50 p-5">
              <strong className="block text-3xl">
                {localAllocationData.summary.civilWorksBidRows.toLocaleString()}
              </strong>
              <span className="text-sm text-green-950">
                local civil-works bid records
              </span>
            </div>
          </>
        )}
      </section>

      <section
        className="mb-8 grid gap-4 lg:grid-cols-2"
        aria-label="Local barangay charts"
      >
        <BarangayRankChart
          title="PSA 2024 population · largest barangays"
          rows={populationRanks}
        />
        <BarangayRankChart
          title="Positions listed in Miagao · DILG roster"
          rows={rosterRoleRanks}
        />
        {localAllocationData && (
          <BarangayRankChart
            title="2026 Q3 20% NTA · highest barangay-named amounts"
            rows={localNtaRanks}
          />
        )}
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

      {mapBarangay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setMapBarangay(null);
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') setMapBarangay(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="barangay-map-title"
            className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-800">
                  Miagao municipal boundary
                </p>
                <h2
                  id="barangay-map-title"
                  className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl"
                >
                  {mapBarangay.name}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Highlighted in gold within Miagao’s barangay boundary map.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMapBarangay(null)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                aria-label="Close barangay map"
              >
                <X size={20} />
              </button>
            </div>
            <MiagaoBarangayMap
              name={mapBarangay.name}
              selectedPsgc={mapBarangay.psgc}
              geometries={boundaryByPsgc}
            />
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Boundary lines are indicative. Source: PSGC 3Q 2026 boundaries,
              based on NAMRIA and PSA data through OCHA COD-AB.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
