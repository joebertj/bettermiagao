import { useEffect, useMemo, useState } from 'react';
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
    kind: 'road' | 'bridge';
    name?: string | null;
    roadName?: string | null;
    roadId?: string | null;
    bridgeId?: string | null;
    roadClass?: string | null;
    condition?: string | null;
    lengthM?: number | null;
  };
  geometry:
    | { type: 'LineString'; coordinates: Position[] }
    | { type: 'MultiLineString'; coordinates: Position[][] }
    | { type: 'Point'; coordinates: Position };
};
type Project = (typeof records.projects)[number];
type MapRow = {
  psgc: string;
  name: string;
  count: number;
  amount: number;
  mpbCount: number;
  geometry: Geometry;
  label: Position;
};

const mpbCounts = new Map(
  barangayInventory.barangays.map(row => [
    row.psgc,
    row.mpb.buildingCountAllYears,
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

function colorText(amount: number, maximum: number) {
  return amount / maximum >= 0.55 ? '#ffffff' : '#0f172a';
}

function conditionColor(condition?: string | null) {
  const value = condition?.trim().toLocaleLowerCase();
  if (value === 'good') return '#15803d';
  if (value === 'fair') return '#d97706';
  if (value === 'poor' || value === 'bad') return '#dc2626';
  return '#64748b';
}

export default function Glance() {
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
    let active = true;
    fetch(
      `${import.meta.env.BASE_URL}data/miagao-dpwh-transport-network.geojson`
    )
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(payload => {
        const loaded = Array.isArray(payload.features)
          ? (payload.features as TransportFeature[])
          : [];
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
  }, []);

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
  const ranked = [...rows]
    .filter(row => row.count > 0)
    .sort(
      (a, b) =>
        b.amount - a.amount || b.count - a.count || a.name.localeCompare(b.name)
    );
  const representedRows = ranked.reduce((sum, row) => sum + row.count, 0);
  const assignedAmount = ranked.reduce((sum, row) => sum + row.amount, 0);
  const representedBarangays = ranked.length;
  const mpbBarangays = rows.filter(row => row.mpbCount > 0);
  const totalMpbRecords = mpbBarangays.reduce(
    (sum, row) => sum + row.mpbCount,
    0
  );
  const roadFeatures = transportFeatures.filter(
    feature => feature.properties.kind === 'road'
  );
  const bridgeFeatures = transportFeatures.filter(
    feature => feature.properties.kind === 'bridge'
  );
  const conditionCounts = transportFeatures.reduce<Record<string, number>>(
    (counts, feature) => {
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
    return Math.min(8, width / (row.mpbCount * 1.55), height / 1.6);
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
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 max-w-4xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-800">
          Miagao · In a Glance
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          National DPWH projects named in barangay titles
        </h1>
        <p className="mt-4 text-lg leading-8 text-gray-700">
          These are national DPWH project amounts in enacted GAA budgets and the
          FY2027 House proposal. Miagao’s LGU does not set or allocate these
          national amounts; they are separate from the municipality’s NTA/IRA.
          The map groups amounts by the barangays named in project titles.
        </p>
      </header>

      <section
        className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Map scope"
      >
        <label>
          <span className="mb-1 block text-sm font-semibold text-slate-700">
            Budget period
          </span>
          <select
            className="h-12 w-full rounded-lg border border-gray-300 bg-white px-3"
            value={period}
            onChange={event => setPeriod(event.target.value as typeof period)}
          >
            <option value="hgab">FY2027 HGAB proposal</option>
            <option value="gaa">FY2017–2026 GAA</option>
            <option value="all">GAA + FY2027 HGAB</option>
          </select>
        </label>
        <article className="rounded-xl border border-gray-200 bg-white p-4">
          <span className="block text-sm text-gray-600">
            National DPWH project rows matched by title
          </span>
          <strong className="mt-1 block text-2xl tabular-nums text-slate-950">
            {representedRows.toLocaleString('en-PH')}
          </strong>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4">
          <span className="block text-sm text-gray-600">Barangays named</span>
          <strong className="mt-1 block text-2xl tabular-nums text-slate-950">
            {representedBarangays.toLocaleString('en-PH')} /{' '}
            {features.length || 119}
          </strong>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4">
          <span className="block text-sm text-gray-600">
            Title-assigned national DPWH amount
          </span>
          <strong className="mt-1 block text-2xl tabular-nums text-slate-950">
            {peso.format(assignedAmount)}
          </strong>
        </article>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              National DPWH amounts by title-named barangay
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Darker blue means a larger title-assigned amount. Numbers show
              national project-row counts.
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
                  >
                    <title>
                      {row.name}: {row.count} project rows ·{' '}
                      {peso.format(row.amount)} national DPWH project amount ·{' '}
                      {row.mpbCount} mapped historical MPB project{' '}
                      {row.mpbCount === 1 ? 'record' : 'records'}
                    </title>
                  </path>
                  {row.count > 0 && (
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="19"
                      fontWeight="700"
                      fill={colorText(row.amount, maximumAmount)}
                      stroke={
                        row.amount / maximumAmount >= 0.55
                          ? '#172554'
                          : '#ffffff'
                      }
                      strokeWidth="3"
                      paintOrder="stroke"
                      aria-hidden="true"
                    >
                      {row.count}
                    </text>
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

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 sm:p-7">
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

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              MPB project records by barangay · GAA history + FY2027 proposal
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Each house marks one MPB project record. FY2027 House proposals
              are outlined; enacted GAA records are filled.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="block text-xs text-gray-600">
                Mapped MPB records
              </span>
              <strong className="mt-1 block text-xl tabular-nums text-slate-950">
                {totalMpbRecords.toLocaleString('en-PH')}
              </strong>
            </article>
            <article className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="block text-xs text-gray-600">
                Barangays with records
              </span>
              <strong className="mt-1 block text-xl tabular-nums text-slate-950">
                {mpbBarangays.length.toLocaleString('en-PH')} /{' '}
                {features.length || 119}
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
        </div>
        {boundaryState === 'ready' && (
          <svg
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            role="img"
            aria-label="Map of Miagao barangays with one house icon for each mapped historical multi-purpose building project record"
            className="block w-full rounded-xl bg-sky-50"
          >
            {rows.map(row => {
              const [labelX, labelY] = projectPoint(row.label);
              const iconSize = houseSizeFor(row);
              const step = iconSize * 1.25;
              return (
                <g key={row.psgc}>
                  <path
                    d={pathFor(row.geometry)}
                    fill={row.mpbCount ? '#dbeafe' : '#f1f5f9'}
                    fillRule="evenodd"
                    stroke="#1e3a8a"
                    strokeWidth="1.2"
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>
                      {row.name}:{' '}
                      {row.mpbCount
                        ? `${row.mpbCount} mapped historical MPB project ${row.mpbCount === 1 ? 'record' : 'records'}`
                        : 'No mapped historical MPB project records'}
                    </title>
                  </path>
                  {Array.from({ length: row.mpbCount }, (_, index) => {
                    const x = labelX + (index - (row.mpbCount - 1) / 2) * step;
                    const record = mpbRecordsByPsgc.get(row.psgc)?.[index];
                    const isFy2027Proposal =
                      record?.year === 2027 ||
                      record?.stage.toLocaleLowerCase().includes('hgab');
                    return (
                      <g
                        key={`${row.psgc}-mpb-${index}`}
                        transform={`translate(${x} ${labelY}) scale(${iconSize / 12}) translate(-6 -6)`}
                      >
                        <title>
                          {row.name} · {record?.year} {record?.stage} ·{' '}
                          {record?.title} ·{' '}
                          {peso.format(record?.amountPesos ?? 0)}
                        </title>
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
          </svg>
        )}
        <p className="mt-4 text-xs leading-5 text-gray-600">
          The count uses BetterGov’s Miagao MPB records for FY2015–FY2027 and
          the barangay assignments in the current inventory (
          {barangayInventory.generatedAt}). It includes FY2027 House Bill
          proposals. A marker represents a project record, not confirmation that
          a building was completed or still exists; mapped sites are based on a
          barangay named in the title or a source-listed coordinate. Icon size
          scales down to fit narrow barangay shapes.
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              DPWH roads and bridges by recorded condition
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
            aria-label="Map of Miagao national roads and bridges colored by DPWH recorded condition"
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
              >
                <title>
                  {row.name}: barangay boundary in the DPWH road and bridge
                  condition map
                </title>
              </path>
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
              >
                <title>
                  {feature.properties.name || 'DPWH road'} ·{' '}
                  {feature.properties.condition || 'No condition'}
                  {feature.properties.roadClass
                    ? ` · ${feature.properties.roadClass}`
                    : ''}
                  {feature.properties.roadId
                    ? ` · Road ID ${feature.properties.roadId}`
                    : ''}
                  {feature.properties.lengthM
                    ? ` · ${feature.properties.lengthM} m`
                    : ''}
                </title>
              </path>
            ))}
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
                >
                  <title>
                    {feature.properties.name || 'DPWH bridge'} ·{' '}
                    {feature.properties.condition || 'No condition'}
                    {feature.properties.lengthM
                      ? ` · ${feature.properties.lengthM} m`
                      : ''}
                    {feature.properties.bridgeId
                      ? ` · Bridge ID ${feature.properties.bridgeId}`
                      : ''}
                    {feature.properties.roadName
                      ? ` · ${feature.properties.roadName}`
                      : ''}
                    {feature.properties.roadClass
                      ? ` · ${feature.properties.roadClass}`
                      : ''}
                  </title>
                </circle>
              );
            })}
          </svg>
        )}
        <p className="mt-4 text-xs leading-5 text-gray-600">
          Uses offline DPWH ArcGIS snapshots: road condition as of January 2026
          and bridge inventory as of July 2026. Road segments are clipped to the
          Miagao barangay-boundary union; bridges are included when their
          recorded point falls within it. The recorded condition describes the
          source snapshot and is not a current field inspection. Roads marked
          “No Assessment” are gray.
        </p>
      </section>
    </main>
  );
}
