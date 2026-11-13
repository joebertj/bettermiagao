import {
  useEffect,
  useMemo,
  useState,
  type FocusEvent,
  type PointerEvent,
} from 'react';
import records from '../data/miagao-projects.json';
import barangayInventory from '../data/miagao-barangay-inventory.json';

type Position = [number, number];
type Ring = Position[];
type Polygon = Ring[];
type Geometry =
  | { type: 'Polygon'; coordinates: Polygon }
  | { type: 'MultiPolygon'; coordinates: Polygon[] };
type Feature = {
  type: 'Feature';
  properties: { psgc?: string; brgy_name?: string };
  geometry: Geometry;
};
type TransportFeature = {
  type: 'Feature';
  properties: {
    kind: 'road' | 'bridge' | 'floodControl' | 'fmrProposal' | 'fmrEndpoint';
    name?: string | null;
    roadName?: string | null;
    roadId?: string | null;
    bridgeId?: string | null;
    projectId?: string | null;
    contractId?: string | null;
    fundingYear?: number | null;
    completionYear?: number | null;
    contractCost?: number | null;
    workType?: string | null;
    implementingOffice?: string | null;
    withinMunicipalBoundary?: boolean;
    roadClass?: string | null;
    condition?: string | null;
    lengthM?: number | null;
    amountPesos?: number | null;
    stage?: string | null;
    sourcePage?: number | null;
    sourceRowId?: string | null;
    displayNote?: string | null;
    endpointLabel?: string | null;
  };
  geometry:
    | { type: 'LineString'; coordinates: Position[] }
    | { type: 'MultiLineString'; coordinates: Position[][] }
    | { type: 'Point'; coordinates: Position };
};
type Project = (typeof records.projects)[number];
type LocalBarangay = {
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
};
type LocalRecord = {
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
  plannedProcurementAmountPesos?: number;
  approvedBudgetPesos?: number;
  bidAmountPesos?: number;
  reference?: string;
  barangays: { psgc: string; name: string }[];
};
type LocalAllocationData = {
  summary: {
    ntaRows: number;
    ntaListedAmountPesos: number;
    ntaLocatedRows: number;
    ntaLocatedAmountPesos: number;
    ntaUnlocatedRows: number;
    ntaUnlocatedAmountPesos: number;
    directBarangayRows: number;
    directBarangayAmountPesos: number;
    releasedDirectRows: number;
    releasedDirectAmountPesos: number;
    appBarangayProjectRows: number;
    appPlannedAmountPesos: number;
    civilWorksBidRows: number;
    unlocatedNtaRecords: LocalRecord[];
  };
  methodology: string[];
  ntaRecords: LocalRecord[];
  appRecords: LocalRecord[];
  bidRecords: LocalRecord[];
  barangays: LocalBarangay[];
};
type MapRow = {
  psgc: string;
  name: string;
  count: number;
  amount: number;
  mpbCount: number;
  mpbProposalCount: number;
  geometry: Geometry;
  label: Position;
};
type MapTooltip = { title: string; details: string[]; x: number; y: number };

const mpbCounts = new Map(
  barangayInventory.barangays.map(row => [
    row.psgc,
    row.mpb.records.filter(record => record.year < 2027).length,
  ])
);
const mpbProposalCounts = new Map(
  barangayInventory.barangays.map(row => [
    row.psgc,
    row.mpb.records.filter(
      record =>
        record.year === 2027 || record.stage.toLowerCase().includes('hgab')
    ).length,
  ])
);
const mpbRecordsByPsgc = new Map(
  barangayInventory.barangays.map(row => [row.psgc, row.mpb.records])
);

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/^brgy\.?\s*/, '')
    .replace(/^barangay\s*/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function polygons(geometry: Geometry): Polygon[] {
  return geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates;
}

function centroid(ring: Ring): { center: Position; area: number } {
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    x += (x1 + x2) * cross;
    y += (y1 + y2) * cross;
  }
  if (Math.abs(twiceArea) < 1e-12) {
    const mean = ring.reduce(
      ([sumX, sumY], [pointX, pointY]) => [sumX + pointX, sumY + pointY],
      [0, 0]
    );
    return {
      center: [mean[0] / ring.length, mean[1] / ring.length],
      area: 0,
    };
  }
  return {
    center: [x / (3 * twiceArea), y / (3 * twiceArea)],
    area: Math.abs(twiceArea / 2),
  };
}

function featureLabel(geometry: Geometry): Position {
  const parts = polygons(geometry)
    .map(polygon => centroid(polygon[0]))
    .sort((a, b) => b.area - a.area);
  return parts[0]?.center ?? [0, 0];
}

function projectTitleBarangays(title: string, names: string[]) {
  const text = ` ${normalize(title)} `;
  const matches = names.filter(name => {
    const phrase = normalize(name);
    return phrase && text.includes(` ${phrase} `);
  });
  return matches.filter(
    name =>
      !matches.some(
        other =>
          normalize(other).length > normalize(name).length &&
          normalize(other).includes(normalize(name)) &&
          text.includes(` ${normalize(other)} `)
      )
  );
}

function amountColor(amount: number, maximum: number) {
  if (amount <= 0) return '#f1f5f9';
  const ratio = amount / maximum;
  if (ratio >= 0.8) return '#172554';
  if (ratio >= 0.55) return '#1d4ed8';
  if (ratio >= 0.3) return '#3b82f6';
  if (ratio >= 0.12) return '#93c5fd';
  return '#dbeafe';
}

function conditionColor(condition?: string | null) {
  const value = condition?.trim().toLocaleLowerCase();
  if (value === 'good') return '#15803d';
  if (value === 'fair') return '#d97706';
  if (value === 'poor' || value === 'bad') return '#dc2626';
  return '#64748b';
}

export default function Glance({
  nationalOnly = false,
}: {
  nationalOnly?: boolean;
}) {
  const [period, setPeriod] = useState<'gaa' | 'hgab' | 'all'>('hgab');
  const [features, setFeatures] = useState<Feature[]>([]);
  const [boundaryState, setBoundaryState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [transportFeatures, setTransportFeatures] = useState<
    TransportFeature[]
  >([]);
  const [transportState, setTransportState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [mapTooltip, setMapTooltip] = useState<MapTooltip | null>(null);
  const [localData, setLocalData] = useState<LocalAllocationData | null>(null);
  const [localDataState, setLocalDataState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [localCategory, setLocalCategory] = useState<'nta' | 'app' | 'bids'>(
    'nta'
  );
  const [localPage, setLocalPage] = useState(1);

  const positionMapTooltip = (x: number, y: number) => ({
    x: Math.max(8, Math.min(x + 16, window.innerWidth - 348)),
    y: Math.max(8, Math.min(y + 16, window.innerHeight - 250)),
  });
  const showMapTooltip = (
    title: string,
    details: string[],
    event: PointerEvent<SVGElement> | FocusEvent<SVGElement>
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x =
      'clientX' in event && event.clientX
        ? event.clientX
        : bounds.left + bounds.width / 2;
    const y =
      'clientY' in event && event.clientY
        ? event.clientY
        : bounds.top + bounds.height / 2;
    setMapTooltip({ title, details, ...positionMapTooltip(x, y) });
  };
  const moveMapTooltip = (event: PointerEvent<SVGElement>) => {
    setMapTooltip(current =>
      current
        ? { ...current, ...positionMapTooltip(event.clientX, event.clientY) }
        : current
    );
  };

  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}data/miagao-barangay-boundaries.geojson`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(payload => {
        const loaded = Array.isArray(payload.features)
          ? (payload.features as Feature[])
          : [];
        if (active) {
          setFeatures(loaded);
          setBoundaryState(loaded.length ? 'ready' : 'error');
        }
      })
      .catch(() => {
        if (active) setBoundaryState('error');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (nationalOnly) return;
    let active = true;
    fetch(`${import.meta.env.BASE_URL}data/miagao-local-allocations.json`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<LocalAllocationData>;
      })
      .then(payload => {
        if (active) {
          setLocalData(payload);
          setLocalDataState('ready');
        }
      })
      .catch(() => {
        if (active) setLocalDataState('error');
      });
    return () => {
      active = false;
    };
  }, [nationalOnly]);

  useEffect(() => {
    if (!nationalOnly) return;
    let active = true;
    Promise.all([
      fetch(
        `${import.meta.env.BASE_URL}data/miagao-dpwh-transport-network.geojson`
      ),
      fetch(`${import.meta.env.BASE_URL}data/miagao-fmr-proposals.geojson`),
    ])
      .then(async ([transportResponse, fmrResponse]) => {
        if (!transportResponse.ok) {
          throw new Error(`DPWH map HTTP ${transportResponse.status}`);
        }
        if (!fmrResponse.ok)
          throw new Error(`FMR map HTTP ${fmrResponse.status}`);
        return Promise.all([transportResponse.json(), fmrResponse.json()]);
      })
      .then(([transportPayload, fmrPayload]) => {
        const transportRows = Array.isArray(transportPayload.features)
          ? (transportPayload.features as TransportFeature[])
          : [];
        const fmrRows = Array.isArray(fmrPayload.features)
          ? (fmrPayload.features as TransportFeature[])
          : [];
        const loaded = [...transportRows, ...fmrRows];
        if (active) {
          setTransportFeatures(loaded);
          setTransportState(loaded.length ? 'ready' : 'error');
        }
      })
      .catch(() => {
        if (active) setTransportState('error');
      });
    return () => {
      active = false;
    };
  }, [nationalOnly]);

  const selectedProjects = useMemo(() => {
    if (period === 'hgab')
      return records.projects.filter(row => row.year === 2027);
    if (period === 'gaa')
      return records.projects.filter(
        row => row.year >= 2017 && row.year <= 2026
      );
    return records.projects.filter(row => row.year >= 2017 && row.year <= 2027);
  }, [period]);

  const rows = useMemo<MapRow[]>(() => {
    const names = features.map(feature => feature.properties.brgy_name ?? '');
    const byPsgc = new Map<string, MapRow>();
    for (const feature of features) {
      const name = feature.properties.brgy_name ?? 'Unknown barangay';
      byPsgc.set(feature.properties.psgc ?? name, {
        psgc: feature.properties.psgc ?? name,
        name,
        count: 0,
        amount: 0,
        mpbCount: mpbCounts.get(feature.properties.psgc ?? '') ?? 0,
        mpbProposalCount:
          mpbProposalCounts.get(feature.properties.psgc ?? '') ?? 0,
        geometry: feature.geometry,
        label: featureLabel(feature.geometry),
      });
    }
    for (const project of selectedProjects as Project[]) {
      const matches = projectTitleBarangays(project.name, names);
      if (!matches.length) continue;
      const perBarangayShare = project.amountPesos / matches.length;
      for (const name of matches) {
        const match = [...byPsgc.values()].find(
          row => normalize(row.name) === normalize(name)
        );
        if (match) {
          match.count += 1;
          match.amount += perBarangayShare;
        }
      }
    }
    return [...byPsgc.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [features, selectedProjects]);

  const maximumAmount = Math.max(...rows.map(row => row.amount), 1);
  const localByPsgc = new Map(
    (localData?.barangays ?? []).map(row => [row.psgc, row])
  );
  const localMapRows = rows.map(row => ({
    ...row,
    local: localByPsgc.get(row.psgc),
  }));
  const localMaximum = Math.max(
    1,
    ...localMapRows.map(row => row.local?.ntaListedAmountPesos ?? 0)
  );
  const localRanking = localMapRows
    .filter(row => (row.local?.ntaProjectRows ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.local?.ntaListedAmountPesos ?? 0) -
          (a.local?.ntaListedAmountPesos ?? 0) || a.name.localeCompare(b.name)
    );
  const currentLocalRecords =
    localCategory === 'nta'
      ? (localData?.ntaRecords ?? [])
      : localCategory === 'app'
        ? (localData?.appRecords ?? [])
        : (localData?.bidRecords ?? []);
  const localPageSize = 10;
  const localPageCount = Math.max(
    1,
    Math.ceil(currentLocalRecords.length / localPageSize)
  );
  const visibleLocalRecords = currentLocalRecords.slice(
    (localPage - 1) * localPageSize,
    localPage * localPageSize
  );
  const ranked = [...rows]
    .filter(row => row.count > 0)
    .sort(
      (a, b) =>
        b.amount - a.amount || b.count - a.count || a.name.localeCompare(b.name)
    );
  const representedRows = ranked.reduce((sum, row) => sum + row.count, 0);
  const assignedAmount = ranked.reduce((sum, row) => sum + row.amount, 0);
  const representedBarangays = ranked.length;
  const mpbBarangays = rows.filter(
    row => row.mpbCount + row.mpbProposalCount > 0
  );
  const totalHistoricalMpbRecords = mpbBarangays.reduce(
    (sum, row) => sum + row.mpbCount,
    0
  );
  const totalProposalMpbRecords = mpbBarangays.reduce(
    (sum, row) => sum + row.mpbProposalCount,
    0
  );
  const roadFeatures = transportFeatures.filter(
    feature => feature.properties.kind === 'road'
  );
  const bridgeFeatures = transportFeatures.filter(
    feature => feature.properties.kind === 'bridge'
  );
  const floodControlFeatures = transportFeatures.filter(
    feature => feature.properties.kind === 'floodControl'
  );
  const fmrProposalFeatures = transportFeatures.filter(
    feature => feature.properties.kind === 'fmrProposal'
  );
  const fmrEndpointFeatures = transportFeatures.filter(
    feature => feature.properties.kind === 'fmrEndpoint'
  );
  const conditionCounts = transportFeatures.reduce<Record<string, number>>(
    (counts, feature) => {
      if (
        feature.properties.kind === 'floodControl' ||
        feature.properties.kind === 'fmrProposal' ||
        feature.properties.kind === 'fmrEndpoint'
      )
        return counts;
      const condition = feature.properties.condition?.trim() || 'No condition';
      counts[condition] = (counts[condition] ?? 0) + 1;
      return counts;
    },
    {}
  );

  const points = rows.flatMap(row => polygons(row.geometry).flat(2));
  const minLon = Math.min(...points.map(point => point[0]));
  const maxLon = Math.max(...points.map(point => point[0]));
  const minLat = Math.min(...points.map(point => point[1]));
  const maxLat = Math.max(...points.map(point => point[1]));
  const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const mapWidth = 1000;
  const mapHeight = 720;
  const padding = 24;
  const projectedWidth = (maxLon - minLon) * cosLat || 1;
  const projectedHeight = maxLat - minLat || 1;
  const scale = Math.min(
    (mapWidth - padding * 2) / projectedWidth,
    (mapHeight - padding * 2) / projectedHeight
  );
  const offsetX = (mapWidth - projectedWidth * scale) / 2;
  const offsetY = (mapHeight - projectedHeight * scale) / 2;
  const projectPoint = ([longitude, latitude]: Position): Position => [
    offsetX + (longitude - minLon) * cosLat * scale,
    offsetY + (maxLat - latitude) * scale,
  ];
  const pathFor = (geometry: Geometry) =>
    polygons(geometry)
      .map(polygon =>
        polygon
          .map(
            ring =>
              `${ring
                .map((point, index) => {
                  const [x, y] = projectPoint(point);
                  return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
                })
                .join(' ')} Z`
          )
          .join(' ')
      )
      .join(' ');
  const houseSizeFor = (row: MapRow) => {
    const projected = polygons(row.geometry)
      .flat(2)
      .map(point => projectPoint(point));
    const width =
      Math.max(...projected.map(point => point[0])) -
      Math.min(...projected.map(point => point[0]));
    const height =
      Math.max(...projected.map(point => point[1])) -
      Math.min(...projected.map(point => point[1]));
    const iconCount = row.mpbCount + row.mpbProposalCount;
    return Math.min(14, width / (iconCount * 1.3), height / 1.35);
  };
  const transportLines = (feature: TransportFeature) => {
    if (feature.geometry.type === 'LineString')
      return [feature.geometry.coordinates];
    if (feature.geometry.type === 'MultiLineString')
      return feature.geometry.coordinates;
    return [];
  };
  const transportPath = (feature: TransportFeature) =>
    transportLines(feature)
      .map(line =>
        line
          .map((point, index) => {
            const [x, y] = projectPoint(point);
            return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
          })
          .join(' ')
      )
      .join(' ');

  return (
    <div
      className={
        nationalOnly
          ? 'w-full'
          : 'mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8'
      }
    >
      <header hidden={nationalOnly} className="mb-8 max-w-4xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-800">
          Miagao · In a Glance
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Local projects and funding across barangays
        </h1>
        <p className="mt-4 text-lg leading-8 text-gray-700">
          Explore Miagao’s 20% NTA projects and local procurement records. NTA
          entries, procurement plans, and bid results are shown as distinct
          records and are not added together.
        </p>
      </header>

      <section
        hidden={nationalOnly}
        className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6"
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
              Local funds · 2026 records
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              Local allocations and barangay-named projects
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-700">
              The first map shades projects in Miagao’s Q3 20% National Tax
              Allotment (NTA) utilization schedule. Amber circles show separate
              2026 procurement-plan entries; green squares show civil-works bid
              records. Procurement and bid amounts are not added to the NTA map.
              Each page icon represents one NTA row. A marker means the source
              names the barangay, not that it gives surveyed project
              coordinates.
            </p>
          </div>
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900"
            href={`${import.meta.env.BASE_URL}data/miagao-local-allocations.json`}
            download
          >
            Export local records JSON
          </a>
        </div>
        {localDataState === 'loading' && (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-gray-600">
            Loading local allocation records…
          </p>
        )}
        {localDataState === 'error' && (
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            Local allocation records could not be loaded.
          </p>
        )}
        {localData && (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                [
                  'Q3 20% NTA listed amount',
                  peso.format(localData.summary.ntaListedAmountPesos),
                ],
                [
                  'NTA rows naming barangays',
                  `${localData.summary.ntaLocatedRows} · ${peso.format(localData.summary.ntaLocatedAmountPesos)}`,
                ],
                [
                  'Not assigned to a barangay',
                  `${localData.summary.ntaUnlocatedRows} · ${peso.format(localData.summary.ntaUnlocatedAmountPesos)}`,
                ],
                [
                  'Direct barangay assistance',
                  `${localData.summary.directBarangayRows} · ${peso.format(localData.summary.directBarangayAmountPesos)}`,
                ],
                [
                  'Released direct-assistance entries',
                  `${localData.summary.releasedDirectRows} · ${peso.format(localData.summary.releasedDirectAmountPesos)}`,
                ],
              ].map(([label, value]) => (
                <article
                  key={label}
                  className="rounded-xl border border-gray-200 p-3"
                >
                  <span className="block text-xs leading-5 text-gray-600">
                    {label}
                  </span>
                  <strong className="mt-1 block text-lg tabular-nums text-slate-950">
                    {value}
                  </strong>
                </article>
              ))}
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-700">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-3 w-3 rounded-sm bg-emerald-700" /> Q3 NTA
                    amount
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-3 w-3 rounded-full border-2 border-amber-600" />{' '}
                    APP planned work
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-3 w-3 bg-green-700" /> Civil-works bid
                    record
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 12 14"
                      className="h-3.5 w-3"
                    >
                      <path d="M2 1.5h5l3 3v8H2z" fill="#0f172a" />
                      <path
                        d="M7 1.5v3h3M4 7h4M4 9h4"
                        fill="none"
                        stroke="white"
                        strokeWidth=".8"
                      />
                    </svg>
                    NTA project row
                  </span>
                </div>
                {boundaryState === 'ready' && (
                  <svg
                    viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                    role="img"
                    aria-label="Miagao map shaded by Q3 2026 20 percent NTA listed amount per named barangay; page icons represent NTA rows; separate symbols mark procurement-plan entries and civil-works bid records"
                    className="block w-full rounded-xl bg-sky-50"
                  >
                    {localMapRows.map(row => {
                      const local = row.local;
                      const [x, y] = projectPoint(row.label);
                      const appCount = local?.appRows ?? 0;
                      const bidCount = local?.civilWorksBidRows ?? 0;
                      return (
                        <g key={`local-${row.psgc}`}>
                          <path
                            d={pathFor(row.geometry)}
                            fill={amountColor(
                              local?.ntaListedAmountPesos ?? 0,
                              localMaximum
                            )}
                            fillRule="evenodd"
                            stroke="#334155"
                            strokeWidth="1"
                            vectorEffect="non-scaling-stroke"
                            tabIndex={0}
                            aria-label={`${row.name}, ${local?.ntaProjectRows ?? 0} Q3 NTA rows, ${peso.format(local?.ntaListedAmountPesos ?? 0)}, ${appCount} APP rows, ${bidCount} bid rows`}
                            onPointerEnter={event =>
                              showMapTooltip(
                                row.name,
                                [
                                  `Q3 20% NTA listed amount: ${peso.format(local?.ntaListedAmountPesos ?? 0)}`,
                                  `${local?.ntaProjectRows ?? 0} NTA project rows`,
                                  `${appCount} separate APP procurement-plan rows`,
                                  `${bidCount} separate civil-works bid records`,
                                ],
                                event
                              )
                            }
                            onPointerMove={moveMapTooltip}
                            onPointerLeave={() => setMapTooltip(null)}
                            onFocus={event =>
                              showMapTooltip(
                                row.name,
                                [
                                  `Q3 20% NTA listed amount: ${peso.format(local?.ntaListedAmountPesos ?? 0)}`,
                                  `${local?.ntaProjectRows ?? 0} NTA project rows`,
                                  `${appCount} separate APP procurement-plan rows`,
                                  `${bidCount} separate civil-works bid records`,
                                ],
                                event
                              )
                            }
                            onBlur={() => setMapTooltip(null)}
                          />
                          {(appCount > 0 || bidCount > 0) && (
                            <g pointerEvents="none">
                              {appCount > 0 && (
                                <circle
                                  cx={x - (bidCount ? 5 : 0)}
                                  cy={y}
                                  r="5"
                                  fill="#fff"
                                  stroke="#b45309"
                                  strokeWidth="2.5"
                                  vectorEffect="non-scaling-stroke"
                                />
                              )}
                              {bidCount > 0 && (
                                <rect
                                  x={x + (appCount ? 1 : -3.5)}
                                  y={y - 3.5}
                                  width="7"
                                  height="7"
                                  fill="#15803d"
                                  stroke="#fff"
                                  strokeWidth="1"
                                  vectorEffect="non-scaling-stroke"
                                />
                              )}
                            </g>
                          )}
                          {Array.from(
                            { length: local?.ntaProjectRows ?? 0 },
                            (_, index) => {
                              const count = local?.ntaProjectRows ?? 0;
                              const iconX = x + (index - (count - 1) / 2) * 9;
                              return (
                                <g
                                  key={`nta-row-${row.psgc}-${index}`}
                                  transform={`translate(${iconX},${y + 11})`}
                                  pointerEvents="none"
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M-3.5 -5h4l3 3v7h-7z"
                                    fill="#0f172a"
                                    stroke="white"
                                    strokeWidth="1"
                                  />
                                  <path
                                    d="M.5 -5v3h3M-1.5 0h4M-1.5 2h4"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth=".7"
                                  />
                                </g>
                              );
                            }
                          )}
                        </g>
                      );
                    })}
                  </svg>
                )}
                {boundaryState !== 'ready' && (
                  <p className="py-12 text-center text-sm text-gray-600">
                    Loading barangay boundaries…
                  </p>
                )}
              </div>
              <div>
                <h3 className="mb-3 text-base font-bold text-slate-900">
                  Barangays with the largest listed NTA amounts
                </h3>
                <div className="space-y-3">
                  {localRanking.slice(0, 10).map(row => {
                    const amount = row.local?.ntaListedAmountPesos ?? 0;
                    return (
                      <div key={`rank-${row.psgc}`}>
                        <div className="mb-1 flex justify-between gap-2 text-xs">
                          <span className="font-medium text-slate-800">
                            {row.name}
                          </span>
                          <span className="tabular-nums text-slate-700">
                            {peso.format(amount)}
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100">
                          <div
                            className="h-2.5 rounded-full bg-emerald-700"
                            style={{
                              width: `${Math.max(2, (amount / localMaximum) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                  <article className="rounded-lg bg-amber-50 p-3">
                    <span className="block text-amber-900">
                      APP planned project rows
                    </span>
                    <strong className="mt-1 block text-base text-slate-950">
                      {localData.summary.appBarangayProjectRows} ·{' '}
                      {peso.format(localData.summary.appPlannedAmountPesos)}
                    </strong>
                  </article>
                  <article className="rounded-lg bg-green-50 p-3">
                    <span className="block text-green-900">
                      Civil-works bid records
                    </span>
                    <strong className="mt-1 block text-base text-slate-950">
                      {localData.summary.civilWorksBidRows} · Q1 + Q3
                    </strong>
                  </article>
                </div>
              </div>
            </div>
            <div className="mt-6 border-t border-gray-200 pt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Choose local project record type"
                >
                  {(
                    [
                      ['nta', 'NTA utilization'],
                      ['app', 'Procurement plan'],
                      ['bids', 'Bid results'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${localCategory === key ? 'border-blue-800 bg-blue-800 text-white' : 'border-gray-300 bg-white text-slate-800'}`}
                      onClick={() => {
                        setLocalCategory(key);
                        setLocalPage(1);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-600">
                  {currentLocalRecords.length.toLocaleString('en-PH')} records ·
                  10 per page
                </span>
              </div>
              <div className="space-y-2">
                {visibleLocalRecords.map(record => (
                  <article
                    key={record.id}
                    className="grid gap-2 rounded-lg border border-gray-200 p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <h4 className="break-words font-semibold leading-5 text-slate-900">
                        {record.title}
                      </h4>
                      <p className="mt-1 break-words text-xs leading-5 text-gray-600">
                        {record.stage} ·{' '}
                        {record.quarter
                          ? `2026 Q${record.quarter}`
                          : record.year}{' '}
                        ·{' '}
                        {record.barangays.map(item => item.name).join(', ') ||
                          'No barangay match'}
                        {record.reference ? ` · Ref ${record.reference}` : ''}
                      </p>
                      {record.location && (
                        <p className="break-words text-xs text-gray-600">
                          Listed location: {record.location}
                        </p>
                      )}
                    </div>
                    <div className="flex items-end justify-between gap-3 sm:flex-col sm:items-end">
                      <strong className="whitespace-nowrap tabular-nums text-slate-900">
                        {peso.format(
                          record.listedAmountPesos ??
                            record.plannedProcurementAmountPesos ??
                            record.approvedBudgetPesos ??
                            record.bidAmountPesos ??
                            0
                        )}
                      </strong>
                      {record.sourceUrl && (
                        <a
                          className="text-xs font-semibold text-blue-800 underline"
                          href={record.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Source · row {record.sourceRow ?? '—'} ↗
                        </a>
                      )}
                    </div>
                  </article>
                ))}
                {!visibleLocalRecords.length && (
                  <p className="rounded-lg bg-slate-50 p-4 text-sm text-gray-600">
                    No rows in this record group.
                  </p>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold disabled:opacity-40"
                  type="button"
                  disabled={localPage <= 1}
                  onClick={() => setLocalPage(page => Math.max(1, page - 1))}
                >
                  Previous
                </button>
                <span className="text-sm tabular-nums text-gray-700">
                  Page {localPage} of {localPageCount}
                </span>
                <button
                  className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold disabled:opacity-40"
                  type="button"
                  disabled={localPage >= localPageCount}
                  onClick={() =>
                    setLocalPage(page => Math.min(localPageCount, page + 1))
                  }
                >
                  Next
                </button>
              </div>
            </div>
            <p className="mt-5 text-xs leading-5 text-gray-600">
              {localData.methodology.join(' ')} The published annual budget
              workbook is account/office-level rather than a project-by-project
              barangay schedule, so it is not used to shade the map.
            </p>
          </>
        )}
      </section>
      <section
        hidden={!nationalOnly}
        className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6"
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-800">
              National funds · GAA history + FY2027 proposal
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              National DPWH projects named in barangays
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-700">
              These are national appropriations, not funds allocated or
              controlled by Miagao’s LGU. Barangay assignment is inferred from
              project titles; shared titles are divided evenly for display.
              FY2027 amounts are House proposals, not enacted GAA.
            </p>
          </div>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="rounded-xl border border-gray-200 p-3">
            <span className="mb-1 block text-xs font-semibold text-slate-700">
              Budget period
            </span>
            <select
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
              value={period}
              onChange={event => setPeriod(event.target.value as typeof period)}
            >
              <option value="hgab">FY2027 HGAB proposal</option>
              <option value="gaa">FY2017–2026 GAA</option>
              <option value="all">GAA + FY2027 HGAB</option>
            </select>
          </label>
          <article className="rounded-xl border border-gray-200 p-3">
            <span className="block text-xs leading-5 text-gray-600">
              DPWH project rows matched by title
            </span>
            <strong className="mt-1 block text-lg tabular-nums text-slate-950">
              {representedRows.toLocaleString('en-PH')}
            </strong>
          </article>
          <article className="rounded-xl border border-gray-200 p-3">
            <span className="block text-xs leading-5 text-gray-600">
              Barangays with named projects
            </span>
            <strong className="mt-1 block text-lg tabular-nums text-slate-950">
              {representedBarangays.toLocaleString('en-PH')} /{' '}
              {features.length || 119}
            </strong>
          </article>
          <article className="rounded-xl border border-gray-200 p-3">
            <span className="block text-xs leading-5 text-gray-600">
              Title-assigned national DPWH amount
            </span>
            <strong className="mt-1 block text-lg tabular-nums text-slate-950">
              {peso.format(assignedAmount)}
            </strong>
          </article>
        </div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-950">
              Barangay map · title-matched project amounts
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Darker blue means a larger title-assigned amount. Each project
              icon represents one national project row.
            </p>
          </div>
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-700"
            aria-label="Map legend"
          >
            <span>Lower</span>
            {['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#172554'].map(
              color => (
                <span
                  key={color}
                  className="h-4 w-7 rounded-sm border border-slate-300"
                  style={{ backgroundColor: color }}
                />
              )
            )}
            <span>Higher</span>
            <span className="ml-2 inline-flex items-center gap-1.5">
              <svg aria-hidden="true" viewBox="0 0 12 14" className="h-3.5 w-3">
                <path d="M2 1.5h5l3 3v8H2z" fill="#0f172a" />
                <path
                  d="M7 1.5v3h3M4 7h4M4 9h4"
                  fill="none"
                  stroke="white"
                  strokeWidth=".8"
                />
              </svg>
              One project row
            </span>
          </div>
        </div>
        {boundaryState === 'loading' && (
          <p className="py-16 text-center text-sm text-gray-600">
            Loading Miagao barangay boundaries…
          </p>
        )}
        {boundaryState === 'error' && (
          <p className="py-16 text-center text-sm text-red-700">
            Barangay boundaries could not be loaded.
          </p>
        )}
        {boundaryState === 'ready' && (
          <svg
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            role="img"
            aria-label="Map of Miagao barangays shaded by title-matched GAA or HGAB allocations and labeled with project counts"
            className="block w-full rounded-xl bg-sky-50"
          >
            {rows.map(row => {
              const [labelX, labelY] = projectPoint(row.label);
              const fill = amountColor(row.amount, maximumAmount);
              return (
                <g key={row.psgc}>
                  <path
                    d={pathFor(row.geometry)}
                    fill={fill}
                    fillRule="evenodd"
                    stroke="#1e3a8a"
                    strokeWidth="1.2"
                    vectorEffect="non-scaling-stroke"
                    tabIndex={0}
                    aria-label={`${row.name}, ${row.count} national project rows, title-assigned amount ${peso.format(row.amount)}, ${row.mpbCount} historical MPB records`}
                    onPointerEnter={event =>
                      showMapTooltip(
                        row.name,
                        [
                          `${row.count.toLocaleString('en-PH')} national project rows`,
                          `Title-assigned amount: ${peso.format(row.amount)}`,
                          `${row.mpbCount.toLocaleString('en-PH')} mapped historical MPB ${row.mpbCount === 1 ? 'record' : 'records'}`,
                        ],
                        event
                      )
                    }
                    onPointerMove={moveMapTooltip}
                    onPointerLeave={() => setMapTooltip(null)}
                    onFocus={event =>
                      showMapTooltip(
                        row.name,
                        [
                          `${row.count.toLocaleString('en-PH')} national project rows`,
                          `Title-assigned amount: ${peso.format(row.amount)}`,
                          `${row.mpbCount.toLocaleString('en-PH')} mapped historical MPB ${row.mpbCount === 1 ? 'record' : 'records'}`,
                        ],
                        event
                      )
                    }
                    onBlur={() => setMapTooltip(null)}
                  ></path>
                  {row.count > 0 && (
                    <g
                      aria-hidden="true"
                      pointerEvents="none"
                      transform={`translate(${labelX},${labelY})`}
                    >
                      {Array.from({ length: row.count }, (_, index) => {
                        const x = (index - (row.count - 1) / 2) * 10;
                        return (
                          <g
                            key={`project-row-${row.psgc}-${index}`}
                            transform={`translate(${x},0)`}
                          >
                            <path
                              d="M-4 -6h5l3 3v9h-8z"
                              fill="#0f172a"
                              stroke="white"
                              strokeWidth="1"
                              vectorEffect="non-scaling-stroke"
                            />
                            <path
                              d="M1 -6v3h3M-2 0h4M-2 2h4"
                              fill="none"
                              stroke="white"
                              strokeWidth=".8"
                              vectorEffect="non-scaling-stroke"
                            />
                          </g>
                        );
                      })}
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        <p className="mt-4 text-xs leading-5 text-gray-600">
          Rows are assigned only when the project title explicitly names one or
          more of the 119 barangays. For titles naming several barangays, the
          listed national project amount is split evenly among those named; this
          is a display estimate, not an official barangay allocation. These
          national appropriations are not allocated or controlled by Miagao’s
          municipal LGU and are separate from its NTA/IRA. FY2027 figures are a
          House proposal, not an enacted GAA. Projects naming Miagao without a
          barangay are not mapped. Counts are project rows, not unique sites or
          completed projects.
        </p>
      </section>

      <section
        hidden={!nationalOnly}
        className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 sm:p-7"
      >
        <h2 className="text-xl font-bold text-slate-950">
          Largest title-matched shares
        </h2>
        <p className="mb-4 mt-1 text-sm text-gray-600">
          National DPWH amounts are summed after splitting multi-barangay titles
          evenly; they are not municipal LGU funds.
        </p>
        <div className="divide-y divide-slate-100">
          {ranked.slice(0, 10).map((row, index) => (
            <div
              key={row.psgc}
              className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3 text-sm"
            >
              <span className="font-semibold text-slate-500">{index + 1}</span>
              <span className="font-medium text-slate-900">{row.name}</span>
              <span className="text-right tabular-nums text-slate-700">
                <strong className="block">{peso.format(row.amount)}</strong>
                <span className="text-xs text-gray-500">
                  {row.count} project {row.count === 1 ? 'row' : 'rows'}
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-500">
          Dataset snapshot: {records.generatedAt}.{' '}
          <a
            className="font-medium text-blue-700 underline"
            href={records.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Project source data
          </a>
        </p>
      </section>

      <section
        hidden={!nationalOnly}
        className="mt-8 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-800">
              National projects · MPB + flood control
            </p>
            <h2 className="text-xl font-bold text-slate-950">
              MPBs, irrigation, and flood-control sites by barangay
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              MPBs lead the map: each house marks one project record. Filled
              houses are enacted GAA records; outlined houses are FY2027
              proposals. Purple diamonds mark geolocated DPWH flood-control
              records.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="block text-xs text-gray-600">
                Historical GAA MPB records
              </span>
              <strong className="mt-1 block text-xl tabular-nums text-slate-950">
                {totalHistoricalMpbRecords.toLocaleString('en-PH')}
              </strong>
            </article>
            <article className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="block text-xs text-gray-600">
                FY2027 HGAB MPB proposals
              </span>
              <strong className="mt-1 block text-xl tabular-nums text-slate-950">
                {totalProposalMpbRecords.toLocaleString('en-PH')}
              </strong>
            </article>
            <article className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="block text-xs text-gray-600">
                Barangays with MPB records
              </span>
              <strong className="mt-1 block text-xl tabular-nums text-slate-950">
                {mpbBarangays.length.toLocaleString('en-PH')} /{' '}
                {features.length || 119}
              </strong>
            </article>
            <article className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="block text-xs text-gray-600">
                Mapped DPWH flood-control records
              </span>
              <strong className="mt-1 block text-xl tabular-nums text-slate-950">
                {floodControlFeatures.length}
              </strong>
            </article>
            <article className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="block text-xs text-gray-600">
                Miagao NIA sites in available FY2027 location data
              </span>
              <strong className="mt-1 block text-xl tabular-nums text-slate-950">
                0
              </strong>
            </article>
          </div>
        </div>
        <div
          className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-700"
          aria-label="MPB map legend"
        >
          <span className="inline-flex items-center gap-2">
            <svg viewBox="0 0 12 12" aria-hidden="true" className="h-4 w-4">
              <path
                d="M1 5.5 6 1l5 4.5V11H7.5V7.5h-3V11H1Z"
                fill="#c2410c"
                stroke="#fff"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </svg>
            Filled · enacted GAA
          </span>
          <span className="inline-flex items-center gap-2">
            <svg viewBox="0 0 12 12" aria-hidden="true" className="h-4 w-4">
              <path
                d="M1 5.5 6 1l5 4.5V11H7.5V7.5h-3V11H1Z"
                fill="none"
                stroke="#c2410c"
                strokeWidth="1.25"
                strokeLinejoin="round"
              />
            </svg>
            Outline · FY2027 House proposal
          </span>
          <span className="inline-flex items-center gap-2">
            <svg viewBox="0 0 12 12" aria-hidden="true" className="h-4 w-4">
              <path d="M6 0.8 11.2 6 6 11.2 0.8 6Z" fill="#7c3aed" />
            </svg>
            Filled purple · completed DPWH flood-control contract
          </span>
          <span className="inline-flex items-center gap-2">
            <svg viewBox="0 0 12 12" aria-hidden="true" className="h-4 w-4">
              <path
                d="M6 0.8 11.2 6 6 11.2 0.8 6Z"
                fill="white"
                stroke="#7c3aed"
                strokeWidth="1.5"
              />
            </svg>
            Outlined purple · FY2027 proposal location
          </span>
        </div>
        {boundaryState === 'ready' && (
          <svg
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            role="img"
            aria-label="Map of Miagao with GAA and FY2027 MPB project records by barangay and geolocated DPWH flood-control sites"
            className="block w-full rounded-xl bg-sky-50"
          >
            {rows.map(row => {
              const [labelX, labelY] = projectPoint(row.label);
              const iconCount = row.mpbCount + row.mpbProposalCount;
              const iconSize = houseSizeFor(row);
              const step = iconSize * 1.25;
              return (
                <g key={row.psgc}>
                  <path
                    d={pathFor(row.geometry)}
                    fill={iconCount ? '#dbeafe' : '#f1f5f9'}
                    fillRule="evenodd"
                    stroke="#1e3a8a"
                    strokeWidth="1.2"
                    vectorEffect="non-scaling-stroke"
                    tabIndex={0}
                    aria-label={`${row.name}: ${row.mpbCount} historical GAA MPB records, ${row.mpbProposalCount} FY2027 HGAB MPB proposals`}
                    onPointerEnter={event =>
                      showMapTooltip(
                        row.name,
                        [
                          `${row.mpbCount.toLocaleString('en-PH')} historical GAA MPB ${row.mpbCount === 1 ? 'record' : 'records'}`,
                          `${row.mpbProposalCount.toLocaleString('en-PH')} FY2027 HGAB MPB ${row.mpbProposalCount === 1 ? 'proposal' : 'proposals'}`,
                        ],
                        event
                      )
                    }
                    onPointerMove={moveMapTooltip}
                    onPointerLeave={() => setMapTooltip(null)}
                    onFocus={event =>
                      showMapTooltip(
                        row.name,
                        [
                          `${row.mpbCount.toLocaleString('en-PH')} historical GAA MPB ${row.mpbCount === 1 ? 'record' : 'records'}`,
                          `${row.mpbProposalCount.toLocaleString('en-PH')} FY2027 HGAB MPB ${row.mpbProposalCount === 1 ? 'proposal' : 'proposals'}`,
                        ],
                        event
                      )
                    }
                    onBlur={() => setMapTooltip(null)}
                  ></path>
                  {Array.from({ length: iconCount }, (_, index) => {
                    const x = labelX + (index - (iconCount - 1) / 2) * step;
                    const allRecords = mpbRecordsByPsgc.get(row.psgc) ?? [];
                    const record = [
                      ...allRecords.filter(item => item.year < 2027),
                      ...allRecords.filter(
                        item =>
                          item.year === 2027 ||
                          item.stage.toLowerCase().includes('hgab')
                      ),
                    ][index];
                    const isFy2027Proposal =
                      record?.year === 2027 ||
                      record?.stage.toLocaleLowerCase().includes('hgab');
                    return (
                      <g
                        key={`${row.psgc}-mpb-${index}`}
                        transform={`translate(${x} ${labelY}) scale(${iconSize / 12}) translate(-6 -6)`}
                        tabIndex={0}
                        aria-label={`${row.name}, FY${record?.year ?? 'unknown'} ${record?.stage ?? ''}, ${record?.title ?? 'MPB project'}, ${peso.format(record?.amountPesos ?? 0)}`}
                        onPointerEnter={event =>
                          showMapTooltip(
                            row.name,
                            [
                              `FY${record?.year ?? '—'} · ${record?.stage ?? 'MPB'}`,
                              record?.title ?? 'Project title unavailable',
                              `Listed amount: ${peso.format(record?.amountPesos ?? 0)}`,
                            ],
                            event
                          )
                        }
                        onPointerMove={moveMapTooltip}
                        onPointerLeave={() => setMapTooltip(null)}
                        onFocus={event =>
                          showMapTooltip(
                            row.name,
                            [
                              `FY${record?.year ?? '—'} · ${record?.stage ?? 'MPB'}`,
                              record?.title ?? 'Project title unavailable',
                              `Listed amount: ${peso.format(record?.amountPesos ?? 0)}`,
                            ],
                            event
                          )
                        }
                        onBlur={() => setMapTooltip(null)}
                      >
                        <path
                          d="M1 5.5 6 1l5 4.5V11H7.5V7.5h-3V11H1Z"
                          fill={isFy2027Proposal ? 'none' : '#c2410c'}
                          stroke={isFy2027Proposal ? '#c2410c' : '#fff'}
                          strokeWidth={isFy2027Proposal ? '1.25' : '1.1'}
                          strokeLinejoin="round"
                        />
                      </g>
                    );
                  })}
                </g>
              );
            })}
            {floodControlFeatures.map((feature, index) => {
              if (feature.geometry.type !== 'Point') return null;
              const [x, y] = projectPoint(feature.geometry.coordinates);
              const isFy2027Proposal = feature.properties.fundingYear === 2027;
              const details = [
                ...(feature.properties.fundingYear
                  ? [`Funding year: ${feature.properties.fundingYear}`]
                  : []),
                ...(feature.properties.completionYear
                  ? [`Completed: ${feature.properties.completionYear}`]
                  : []),
                ...(feature.properties.contractCost
                  ? [
                      `Contract cost: ${peso.format(feature.properties.contractCost)}`,
                    ]
                  : []),
                ...(feature.properties.contractId
                  ? [`Contract: ${feature.properties.contractId}`]
                  : []),
                ...(feature.properties.workType
                  ? [`Work type: ${feature.properties.workType}`]
                  : []),
                ...(feature.properties.withinMunicipalBoundary === false
                  ? ['Recorded point is outside mapped Miagao boundaries']
                  : []),
              ];
              return (
                <path
                  key={`flood-control-${feature.properties.projectId ?? index}`}
                  d={`M${x} ${y - 6} L${x + 6} ${y} L${x} ${y + 6} L${x - 6} ${y} Z`}
                  fill={isFy2027Proposal ? 'white' : '#7c3aed'}
                  stroke={
                    feature.properties.withinMunicipalBoundary === false
                      ? '#dc2626'
                      : '#7c3aed'
                  }
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  tabIndex={0}
                  aria-label={`${feature.properties.name || 'DPWH flood-control project'}, ${details.join(', ')}`}
                  onPointerEnter={event =>
                    showMapTooltip(
                      feature.properties.name || 'DPWH flood-control project',
                      details,
                      event
                    )
                  }
                  onPointerMove={moveMapTooltip}
                  onPointerLeave={() => setMapTooltip(null)}
                  onFocus={event =>
                    showMapTooltip(
                      feature.properties.name || 'DPWH flood-control project',
                      details,
                      event
                    )
                  }
                  onBlur={() => setMapTooltip(null)}
                />
              );
            })}
          </svg>
        )}
        <p className="mt-4 text-xs leading-5 text-gray-600">
          The MPB figures separate enacted GAA records through 2026 from FY2027
          House proposal records. A house marks one project record, not
          confirmation that a building was completed or still exists; mapped
          sites use a barangay named in the title or a source-listed coordinate.
          House icons are enlarged and scaled to fit the barangay shape. Purple
          diamonds mark DPWH flood-control points; red outlines indicate
          recorded points outside the barangay-boundary union. Available FY2027
          NIA geolocation data has no Miagao-matched project row.
        </p>
      </section>

      <section
        hidden={!nationalOnly}
        className="mt-8 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              DPWH roads, bridges, and FY2027 FMR proposals
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Good is green, fair is amber, poor or bad is red, and no
              assessment is gray.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-700">
            {[
              ['Good', '#15803d'],
              ['Fair', '#d97706'],
              ['Poor / bad', '#dc2626'],
              ['No assessment', '#64748b'],
            ].map(([label, color]) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 34 12" aria-hidden="true" className="h-3 w-9">
                <path
                  d="M2 6H32"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <path
                  d="M2 6H32"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="4"
                  strokeDasharray="5 3"
                  strokeLinecap="round"
                />
              </svg>
              FY2027 proposed FMR · dashed connector; amber dots are printed
              endpoints
            </span>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-3">
          <article className="rounded-xl border border-gray-200 px-4 py-3">
            <span className="block text-xs text-gray-600">Road sections</span>
            <strong className="mt-1 block text-xl tabular-nums text-slate-950">
              {roadFeatures.length}
            </strong>
          </article>
          <article className="rounded-xl border border-gray-200 px-4 py-3">
            <span className="block text-xs text-gray-600">Bridges</span>
            <strong className="mt-1 block text-xl tabular-nums text-slate-950">
              {bridgeFeatures.length}
            </strong>
          </article>
          <article className="rounded-xl border border-gray-200 px-4 py-3">
            <span className="block text-xs text-gray-600">
              FY2027 FMR with endpoint coordinates
            </span>
            <strong className="mt-1 block text-xl tabular-nums text-slate-950">
              {fmrProposalFeatures.length}
            </strong>
          </article>
          {Object.entries(conditionCounts).map(([condition, count]) => (
            <article
              key={condition}
              className="rounded-xl border border-gray-200 px-4 py-3"
            >
              <span className="block text-xs text-gray-600">{condition}</span>
              <strong className="mt-1 block text-xl tabular-nums text-slate-950">
                {count}
              </strong>
            </article>
          ))}
        </div>
        {transportState === 'loading' && (
          <p className="py-16 text-center text-sm text-gray-600">
            Loading DPWH road and bridge conditions…
          </p>
        )}
        {transportState === 'error' && (
          <p className="py-16 text-center text-sm text-red-700">
            DPWH road and bridge features could not be loaded.
          </p>
        )}
        {transportState === 'ready' && boundaryState === 'ready' && (
          <svg
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            role="img"
            aria-label="Map of Miagao DPWH roads and bridges colored by recorded condition, with outlined FY2027 FMR proposal endpoint connectors"
            className="block w-full rounded-xl bg-sky-50"
          >
            {rows.map(row => (
              <path
                key={row.psgc}
                d={pathFor(row.geometry)}
                fill="#f8fafc"
                fillRule="evenodd"
                stroke="#94a3b8"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                tabIndex={0}
                aria-label={`${row.name} barangay boundary`}
                onPointerEnter={event =>
                  showMapTooltip(row.name, ['Barangay boundary'], event)
                }
                onPointerMove={moveMapTooltip}
                onPointerLeave={() => setMapTooltip(null)}
                onFocus={event =>
                  showMapTooltip(row.name, ['Barangay boundary'], event)
                }
                onBlur={() => setMapTooltip(null)}
              ></path>
            ))}
            {roadFeatures.map((feature, index) => (
              <path
                key={`road-${feature.properties.roadId ?? index}`}
                d={transportPath(feature)}
                fill="none"
                stroke={conditionColor(feature.properties.condition)}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                tabIndex={0}
                aria-label={`${feature.properties.name || 'DPWH road'}, ${feature.properties.condition || 'No condition'}${feature.properties.roadClass ? `, ${feature.properties.roadClass}` : ''}${feature.properties.lengthM ? `, ${feature.properties.lengthM} metres` : ''}`}
                onPointerEnter={event =>
                  showMapTooltip(
                    feature.properties.name || 'DPWH road',
                    [
                      `Recorded condition: ${feature.properties.condition || 'No condition'}`,
                      ...(feature.properties.roadClass
                        ? [`Road class: ${feature.properties.roadClass}`]
                        : []),
                      ...(feature.properties.roadId
                        ? [`Road ID: ${feature.properties.roadId}`]
                        : []),
                      ...(feature.properties.lengthM
                        ? [
                            `Recorded length: ${feature.properties.lengthM.toLocaleString('en-PH')} m`,
                          ]
                        : []),
                    ],
                    event
                  )
                }
                onPointerMove={moveMapTooltip}
                onPointerLeave={() => setMapTooltip(null)}
                onFocus={event =>
                  showMapTooltip(
                    feature.properties.name || 'DPWH road',
                    [
                      `Recorded condition: ${feature.properties.condition || 'No condition'}`,
                      ...(feature.properties.roadClass
                        ? [`Road class: ${feature.properties.roadClass}`]
                        : []),
                      ...(feature.properties.roadId
                        ? [`Road ID: ${feature.properties.roadId}`]
                        : []),
                      ...(feature.properties.lengthM
                        ? [
                            `Recorded length: ${feature.properties.lengthM.toLocaleString('en-PH')} m`,
                          ]
                        : []),
                    ],
                    event
                  )
                }
                onBlur={() => setMapTooltip(null)}
              ></path>
            ))}
            {fmrProposalFeatures.map((feature, index) => (
              <g
                key={`fmr-proposal-${feature.properties.projectId ?? index}`}
                tabIndex={0}
                role="img"
                aria-label={`${feature.properties.name || 'FY2027 FMR proposal'}, ${peso.format(feature.properties.amountPesos ?? 0)}, ${feature.properties.displayNote || ''}`}
                onPointerEnter={event =>
                  showMapTooltip(
                    feature.properties.name || 'FY2027 FMR proposal',
                    [
                      `FY2027 House proposal · ${peso.format(feature.properties.amountPesos ?? 0)}`,
                      ...(feature.properties.sourcePage
                        ? [`Source PDF page: ${feature.properties.sourcePage}`]
                        : []),
                      feature.properties.displayNote ||
                        'Straight connector between printed endpoints; not a surveyed alignment.',
                    ],
                    event
                  )
                }
                onPointerMove={moveMapTooltip}
                onPointerLeave={() => setMapTooltip(null)}
                onFocus={event =>
                  showMapTooltip(
                    feature.properties.name || 'FY2027 FMR proposal',
                    [
                      `FY2027 House proposal · ${peso.format(feature.properties.amountPesos ?? 0)}`,
                      ...(feature.properties.sourcePage
                        ? [`Source PDF page: ${feature.properties.sourcePage}`]
                        : []),
                      feature.properties.displayNote ||
                        'Straight connector between printed endpoints; not a surveyed alignment.',
                    ],
                    event
                  )
                }
                onBlur={() => setMapTooltip(null)}
              >
                <path
                  d={transportPath(feature)}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={transportPath(feature)}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="4"
                  strokeDasharray="7 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
            {fmrEndpointFeatures.map((feature, index) => {
              if (feature.geometry.type !== 'Point') return null;
              const [x, y] = projectPoint(feature.geometry.coordinates);
              const label = `${feature.properties.endpointLabel || 'Printed endpoint'} · ${feature.properties.name || 'FY2027 FMR proposal'}`;
              return (
                <circle
                  key={`fmr-endpoint-${feature.properties.projectId ?? index}-${feature.properties.endpointLabel ?? index}`}
                  cx={x}
                  cy={y}
                  r="4.5"
                  fill="#f59e0b"
                  stroke="#fff"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  tabIndex={0}
                  role="img"
                  aria-label={`${label}. ${feature.properties.displayNote || ''}`}
                >
                  <title>{label}</title>
                </circle>
              );
            })}
            {bridgeFeatures.map((feature, index) => {
              if (feature.geometry.type !== 'Point') return null;
              const [x, y] = projectPoint(feature.geometry.coordinates);
              return (
                <circle
                  key={`bridge-${feature.properties.bridgeId ?? index}`}
                  cx={x}
                  cy={y}
                  r="4.5"
                  fill={conditionColor(feature.properties.condition)}
                  stroke="#fff"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  tabIndex={0}
                  aria-label={`${feature.properties.name || 'DPWH bridge'}, ${feature.properties.condition || 'No condition'}${feature.properties.lengthM ? `, ${feature.properties.lengthM} metres` : ''}`}
                  onPointerEnter={event =>
                    showMapTooltip(
                      feature.properties.name || 'DPWH bridge',
                      [
                        `Recorded condition: ${feature.properties.condition || 'No condition'}`,
                        ...(feature.properties.lengthM
                          ? [
                              `Recorded length: ${feature.properties.lengthM.toLocaleString('en-PH')} m`,
                            ]
                          : []),
                        ...(feature.properties.bridgeId
                          ? [`Bridge ID: ${feature.properties.bridgeId}`]
                          : []),
                        ...(feature.properties.roadName
                          ? [`Road: ${feature.properties.roadName}`]
                          : []),
                        ...(feature.properties.roadClass
                          ? [`Road class: ${feature.properties.roadClass}`]
                          : []),
                      ],
                      event
                    )
                  }
                  onPointerMove={moveMapTooltip}
                  onPointerLeave={() => setMapTooltip(null)}
                  onFocus={event =>
                    showMapTooltip(
                      feature.properties.name || 'DPWH bridge',
                      [
                        `Recorded condition: ${feature.properties.condition || 'No condition'}`,
                        ...(feature.properties.lengthM
                          ? [
                              `Recorded length: ${feature.properties.lengthM.toLocaleString('en-PH')} m`,
                            ]
                          : []),
                        ...(feature.properties.bridgeId
                          ? [`Bridge ID: ${feature.properties.bridgeId}`]
                          : []),
                        ...(feature.properties.roadName
                          ? [`Road: ${feature.properties.roadName}`]
                          : []),
                        ...(feature.properties.roadClass
                          ? [`Road class: ${feature.properties.roadClass}`]
                          : []),
                      ],
                      event
                    )
                  }
                  onBlur={() => setMapTooltip(null)}
                ></circle>
              );
            })}
          </svg>
        )}
        <p className="mt-4 text-xs leading-5 text-gray-600">
          Uses offline DPWH ArcGIS snapshots: road condition as of January 2026,
          bridge inventory as of July 2026. Road segments are clipped to the
          boundary union; bridges are included when their recorded point falls
          within it. Conditions describe source snapshots, not current field
          inspections. Roads marked “No Assessment” are gray. FY2027 FMR marks
          use printed endpoints and a straight connector, clipped to Miagao
          boundaries for display; amber dots mark the printed coordinates.
          Neither is a surveyed project alignment. One Miagao FMR proposal
          without an endpoint pair is not plotted. Budget title matches do not
          provide surveyed coordinates for individual DPWH road or bridge
          allocations.
        </p>
      </section>
      {mapTooltip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 w-[min(340px,calc(100vw-16px))] rounded-xl border border-slate-300 bg-white p-4 text-[15px] leading-6 text-slate-800 shadow-xl"
          style={{ left: mapTooltip.x, top: mapTooltip.y }}
        >
          <strong className="block text-base leading-6 text-slate-950">
            {mapTooltip.title}
          </strong>
          <ul className="mt-1 space-y-0.5">
            {mapTooltip.details.map((detail, index) => (
              <li key={`${index}-${detail}`}>{detail}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
