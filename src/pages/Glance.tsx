import { useEffect, useMemo, useState } from 'react';
import records from '../data/miagao-projects.json';

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
type Project = (typeof records.projects)[number];
type MapRow = {
  psgc: string;
  name: string;
  count: number;
  amount: number;
  geometry: Geometry;
  label: Position;
};

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

export default function Glance() {
  const [period, setPeriod] = useState<'gaa' | 'hgab' | 'all'>('hgab');
  const [features, setFeatures] = useState<Feature[]>([]);
  const [boundaryState, setBoundaryState] = useState<
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

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 max-w-4xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-800">
          Miagao · In a Glance
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Where national project budgets name a barangay
        </h1>
        <p className="mt-4 text-lg leading-8 text-gray-700">
          The map shades barangays by their title-matched share of listed DPWH
          GAA or HGAB project allocations. The number on each shaded barangay is
          the count of project rows naming it.
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
            Title-matched project rows
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
            Assigned allocation
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
              Allocation by title-named barangay
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Darker blue means a larger assigned allocation. Numbers show
              project-row counts.
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
                      {peso.format(row.amount)} assigned allocation
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
          listed amount is split evenly among those named; this is a display
          estimate, not an official barangay allocation. Projects naming Miagao
          without a barangay are not mapped. Counts are project rows, not unique
          sites or completed projects.
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 sm:p-7">
        <h2 className="text-xl font-bold text-slate-950">
          Largest title-matched shares
        </h2>
        <p className="mb-4 mt-1 text-sm text-gray-600">
          Amounts are summed after splitting multi-barangay titles evenly.
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
    </main>
  );
}
