import { Award, ExternalLink } from 'lucide-react';
import AnalysisDisclaimer from '../components/ui/AnalysisDisclaimer';
import {
  appMaterialItems,
  cmpdMaterials,
  cmpdSource,
  type AppMaterialItem,
  type CmpdMaterialSeries,
} from '../data/cmpdMiagaoReview';

const reportUrl =
  'https://visualizations.bettergov.ph/static/nep-preview/cmpd-cost-per-unit.html';
const appUrl =
  'https://www.miagao.gov.ph/wp-content/uploads/2026/06/CONSOLIDATED-APP-2026.xlsx';
const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});
const axisMoney = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

function sortedPrices(series: CmpdMaterialSeries) {
  return series.officePrices.map(row => row.price).sort((a, b) => a - b);
}

function quantile(sorted: number[], fraction: number) {
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, sorted.length - 1);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function seriesStats(series: CmpdMaterialSeries) {
  const values = sortedPrices(series);
  const q1 = quantile(values, 0.25);
  const median = quantile(values, 0.5);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const inliers = values.filter(
    value => value >= lowerFence && value <= upperFence
  );
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const standardDeviation =
    values.length > 1
      ? Math.sqrt(
          values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
            (values.length - 1)
        )
      : 0;
  return {
    values,
    mean,
    standardDeviation,
    min: values[0],
    max: values[values.length - 1],
    q1,
    median,
    q3,
    lowWhisker: inliers[0],
    highWhisker: inliers[inliers.length - 1],
    outliers: values.filter(value => value < lowerFence || value > upperFence),
  };
}

function matchingSeries(item: AppMaterialItem) {
  return item.cmpdSeries
    .map(code => cmpdMaterials.find(series => series.code === code))
    .filter((series): series is CmpdMaterialSeries => Boolean(series));
}

function impliedUnitPrice(item: AppMaterialItem) {
  return item.totalPesos / item.quantity;
}

function rangeAssessment(item: AppMaterialItem) {
  const price = impliedUnitPrice(item);
  const comparisons = matchingSeries(item)
    .filter(series => item.appUnit === series.unit)
    .map(series => {
      const stats = seriesStats(series);
      return {
        within: price >= stats.min && price <= stats.max,
        standardDeviations: stats.standardDeviation
          ? Math.abs(price - stats.mean) / stats.standardDeviation
          : 0,
      };
    });
  const within = comparisons.some(comparison => comparison.within);
  const closest = comparisons.sort(
    (a, b) => a.standardDeviations - b.standardDeviations
  )[0];
  return {
    within,
    standardDeviations: closest?.standardDeviations ?? null,
    severity: within
      ? 'within'
      : (closest?.standardDeviations ?? 0) >= 2
        ? 'red'
        : 'amber',
  } as const;
}

function fallsWithinObservedRange(item: AppMaterialItem) {
  return rangeAssessment(item).within;
}

function referenceLabel(item: AppMaterialItem) {
  return matchingSeries(item)
    .map(series => {
      const { min, max, values } = seriesStats(series);
      return `${axisMoney.format(min)}–${axisMoney.format(max)} · ${values.length} offices`;
    })
    .join(' or ');
}

function BoxPlot({
  series,
  appItems,
}: {
  series: CmpdMaterialSeries;
  appItems: AppMaterialItem[];
}) {
  const stats = seriesStats(series);
  const markers = appItems.map(item => {
    const price = impliedUnitPrice(item);
    const within =
      item.appUnit === series.unit && price >= stats.min && price <= stats.max;
    const standardDeviations = stats.standardDeviation
      ? Math.abs(price - stats.mean) / stats.standardDeviation
      : 0;
    return { item, price, within, standardDeviations };
  });
  const axisMax =
    Math.max(stats.max, ...markers.map(marker => marker.price), 1) * 1.06;
  const logMax = Math.log1p(axisMax);
  const x = (value: number) =>
    58 + (Math.log1p(Math.max(0, value)) / logMax) * 602;
  const boxLeft = x(stats.q1);
  const boxRight = x(stats.q3);
  const outlierDots = stats.outliers.map((value, index) => {
    const officesAtValue = series.officePrices
      .filter(row => row.price === value)
      .map(row => row.office);
    const label = `${money.format(value)} per ${series.unit} · ${officesAtValue.join(', ')}`;
    return (
      <circle
        key={`${value}-${index}`}
        cx={x(value)}
        cy={54 + (index % 4) * 3}
        r="4"
        fill="#b7791f"
        stroke="white"
        strokeWidth="1"
        tabIndex={0}
        aria-label={label}
      >
        <title>{label}</title>
      </circle>
    );
  });
  const ticks = [0, 10, 100, 1000, 10000].filter(value => value <= axisMax);
  if (axisMax / (ticks[ticks.length - 1] || 1) > 2) ticks.push(axisMax);

  return (
    <figure className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <figcaption className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <span>
          <strong className="block text-sm font-bold text-slate-950">
            {series.name}
          </strong>
          <span className="text-xs text-slate-600">
            {series.code} · PHP per {series.unit} · n={stats.values.length}{' '}
            Region VI offices
          </span>
        </span>
        <span className="text-right text-xs text-slate-600">
          Median {money.format(stats.median)} · IQR {money.format(stats.q1)}–
          {money.format(stats.q3)}
        </span>
      </figcaption>
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 700 118"
          role="img"
          aria-label={`${series.name}: office price distribution and Miagao APP item amounts`}
          className="block h-auto w-full min-w-[520px]"
        >
          {ticks.map(tick => (
            <g key={tick}>
              <line
                x1={x(tick)}
                y1="42"
                x2={x(tick)}
                y2="83"
                stroke="#d7e0e8"
                strokeWidth="1"
              />
              <line
                x1={x(tick)}
                y1="83"
                x2={x(tick)}
                y2="88"
                stroke="#9aabb6"
                strokeWidth="1"
              />
              <text
                x={x(tick)}
                y="105"
                textAnchor="middle"
                fill="#526c78"
                fontSize="11"
              >
                {axisMoney.format(tick)}
              </text>
            </g>
          ))}
          {markers.map((marker, index) => {
            const y = 17 + (index % 3) * 10;
            const color = marker.within
              ? '#15803d'
              : marker.standardDeviations >= 2
                ? '#b42318'
                : '#b7791f';
            return (
              <g key={marker.item.id}>
                <path
                  d={`M ${x(marker.price)} ${y - 5} L ${x(marker.price) + 5} ${y} L ${x(marker.price)} ${y + 5} L ${x(marker.price) - 5} ${y} Z`}
                  fill={color}
                  stroke="white"
                  strokeWidth="1"
                  tabIndex={0}
                  aria-label={`APP row ${marker.item.appRow}: ${money.format(marker.price)} per ${marker.item.appUnit}; ${marker.within ? 'within' : `outside observed CMPD range by ${marker.standardDeviations.toFixed(1)} standard deviations`}`}
                >
                  <title>{`APP row ${marker.item.appRow}: ${money.format(marker.price)} per ${marker.item.appUnit}`}</title>
                </path>
              </g>
            );
          })}
          <line
            x1={x(stats.lowWhisker)}
            y1="63"
            x2={x(stats.highWhisker)}
            y2="63"
            stroke="#0038a8"
            strokeWidth="2"
          />
          <line
            x1={x(stats.lowWhisker)}
            y1="56"
            x2={x(stats.lowWhisker)}
            y2="70"
            stroke="#0038a8"
            strokeWidth="2"
          />
          <line
            x1={x(stats.highWhisker)}
            y1="56"
            x2={x(stats.highWhisker)}
            y2="70"
            stroke="#0038a8"
            strokeWidth="2"
          />
          <rect
            x={boxLeft}
            y="51"
            width={Math.max(2, boxRight - boxLeft)}
            height="24"
            rx="3"
            fill="#dce8ff"
            stroke="#0038a8"
            strokeWidth="2"
          />
          <line
            x1={x(stats.median)}
            y1="51"
            x2={x(stats.median)}
            y2="75"
            stroke="#00246a"
            strokeWidth="3"
          />
          {outlierDots}
        </svg>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Blue box: middle half of office prices; center line: median; whiskers:
        1.5×IQR. Amber dots: office-price outliers. Green diamonds: Miagao APP
        amounts inside the observed range; amber/red diamonds: outside the range
        by less than 2 SD / at least 2 SD.
      </p>
    </figure>
  );
}

export default function Cmpd() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-7 max-w-4xl">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-800">
          Miagao · FY2026
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">
          CMPD reference prices
        </h1>
        <p className="mt-3 text-lg leading-7 text-slate-700">
          Compare specified supply items in Miagao’s Annual Procurement Plan
          with the first-semester 2026 Construction Materials Price Data (CMPD)
          office prices for Region VI.
        </p>
      </header>

      <div className="mb-7">
        <AnalysisDisclaimer>
          This is a screening comparison, not a finding of overpricing. The
          APP’s product specifications may differ from CMPD, and prices can vary
          with quality, delivery, taxes, timing and package scope. Green rows
          mean only that the implied APP amount falls inside the observed Region
          VI price range for a selected same-unit CMPD item; verify
          specifications before comparing. Outside-range amounts are amber when
          less than 2 sample standard deviations from the CMPD office-price mean
          and red at 2 SD or more. This is a review-priority screen, not a
          statistical finding.
        </AnalysisDisclaimer>
      </div>

      <section
        className="mb-8 grid gap-4 sm:grid-cols-3"
        aria-label="CMPD coverage"
      >
        {[
          ['63,040', 'CMPD material-office rows'],
          ['62,602', 'priced rows'],
          ['17 regions', '197 implementing offices'],
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

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Miagao APP item screen
            </h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
              Unit amounts are derived as APP line budget ÷ stated quantity.
              Green rows are within the observed minimum–maximum. Outside-range
              rows are amber when less than 2 sample standard deviations from
              the comparator mean and red at 2 SD or more.
            </p>
          </div>
          <a
            href={reportUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900"
          >
            Full CMPD report <ExternalLink size={15} />
          </a>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1060px] border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="p-3">APP item</th>
                <th className="p-3">APP line budget / quantity</th>
                <th className="p-3">Implied APP amount per unit</th>
                <th className="p-3">Region VI CMPD range</th>
                <th className="p-3">Specification note</th>
                <th className="p-3">Range screen</th>
              </tr>
            </thead>
            <tbody>
              {appMaterialItems.map(item => {
                const assessment = rangeAssessment(item);
                const within = assessment.within;
                const rowTone =
                  assessment.severity === 'within'
                    ? 'bg-emerald-50'
                    : assessment.severity === 'red'
                      ? 'bg-red-50'
                      : 'bg-amber-50';
                return (
                  <tr key={item.id} className={rowTone}>
                    <th
                      scope="row"
                      className="p-3 align-top font-semibold text-slate-900"
                    >
                      {item.description}
                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        APP row {item.appRow}
                      </span>
                    </th>
                    <td className="p-3 align-top tabular-nums">
                      {money.format(item.totalPesos)} / {item.quantity}{' '}
                      {item.appUnit}
                      {item.quantity === 1 ? '' : 's'}
                    </td>
                    <td className="p-3 align-top font-semibold tabular-nums">
                      {money.format(impliedUnitPrice(item))} / {item.appUnit}
                    </td>
                    <td className="p-3 align-top">
                      {referenceLabel(item)}
                      <span className="mt-1 block text-xs text-slate-500">
                        {matchingSeries(item)
                          .map(series => series.name)
                          .join(' / ')}
                      </span>
                    </td>
                    <td className="p-3 align-top text-slate-600">
                      {item.note}
                    </td>
                    <td className="p-3 align-top">
                      {within ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900"
                          aria-label="Within observed CMPD range"
                        >
                          <Award size={16} aria-hidden="true" /> Within range
                        </span>
                      ) : (
                        <span
                          className={`text-xs font-bold ${assessment.severity === 'red' ? 'text-red-800' : 'text-amber-900'}`}
                        >
                          Outside range ·{' '}
                          {assessment.standardDeviations?.toFixed(1)} SD
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {appMaterialItems.filter(fallsWithinObservedRange).length} of{' '}
          {appMaterialItems.length} APP lines fall inside a selected Region VI
          observed range. Cement is conditionally in range: the APP says “bag”
          but does not confirm the CMPD comparator’s 40 kg specification.
        </p>
      </section>

      <section
        className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        aria-labelledby="cmpd-boxplots-title"
      >
        <div className="mb-5 max-w-4xl">
          <h2
            id="cmpd-boxplots-title"
            className="text-xl font-bold text-slate-950"
          >
            Region VI office-price distributions
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Each box shows the 11 available implementing-office prices for one
            CMPD code and unit. APP prices use diamonds on the same per-material
            logarithmic scale, following the ODV CMPD box-plot convention.
          </p>
          <div
            className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600"
            aria-label="Chart legend"
          >
            <span>
              <i className="mr-1 inline-block h-3 w-3 rounded-sm border border-blue-800 bg-blue-100 align-[-2px]" />
              CMPD middle half and median
            </span>
            <span>
              <i className="mr-1 inline-block h-3 w-3 rotate-45 bg-emerald-700 align-[-2px]" />
              APP amount within observed range
            </span>
            <span>
              <i className="mr-1 inline-block h-3 w-3 rotate-45 bg-amber-700 align-[-2px]" />
              Outside range, &lt;2 SD
            </span>
            <span>
              <i className="mr-1 inline-block h-3 w-3 rotate-45 bg-red-700 align-[-2px]" />
              Outside range, ≥2 SD
            </span>
            <span>
              <i className="mr-1 inline-block h-3 w-3 rounded-full bg-amber-700 align-[-2px]" />
              CMPD office outlier
            </span>
          </div>
        </div>
        <div className="space-y-4">
          {cmpdMaterials.map(series => {
            const matchingItems = appMaterialItems.filter(item =>
              item.cmpdSeries.includes(series.code)
            );
            return (
              <BoxPlot
                key={series.code}
                series={series}
                appItems={matchingItems}
              />
            );
          })}
        </div>
      </section>

      <footer className="text-sm leading-6 text-slate-600">
        <p>
          Sources: the official{' '}
          <a
            className="font-semibold text-blue-800 underline"
            href={appUrl}
            target="_blank"
            rel="noreferrer"
          >
            FY2026 Consolidated APP
          </a>{' '}
          (row numbers shown above), and{' '}
          <a
            className="font-semibold text-blue-800 underline"
            href={reportUrl}
            target="_blank"
            rel="noreferrer"
          >
            CMPD first-semester 2026
          </a>
          .
        </p>
        <p className="mt-1 text-xs text-slate-500">
          CMPD source file: {cmpdSource.file} · {cmpdSource.period} ·{' '}
          {cmpdSource.region} · SHA-256 {cmpdSource.sha256}
        </p>
      </footer>
    </main>
  );
}
