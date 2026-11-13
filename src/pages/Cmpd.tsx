import { ExternalLink } from 'lucide-react';
import AnalysisDisclaimer from '../components/ui/AnalysisDisclaimer';

const reportUrl =
  'https://visualizations.bettergov.ph/static/nep-preview/cmpd-cost-per-unit.html';
const appUrl =
  'https://www.miagao.gov.ph/wp-content/uploads/2026/06/CONSOLIDATED-APP-2026.xlsx';

const comparisons = [
  {
    material: 'Portland cement, 40 kg bag',
    app: 'APP row 111 · ₱83,000 / 300 bags = ₱276.67 per bag',
    cmpd: '₱225–₱280 · Region VI mean ₱245.59',
    note: 'The APP does not state the bag weight.',
  },
  {
    material: 'Latex paint',
    app: 'Rows 55–56 · ₱1,265 per gallon; row 2468 · ₱990 per gallon',
    cmpd: '₱686.80–₱822.51 · Region VI gloss and semi-gloss references',
    note: 'Paint finish, brand and specifications are not stated consistently.',
  },
  {
    material: 'PVC pipe · 1/2 inch',
    app: 'Row 3855 · ₱127 per piece',
    cmpd: '₱68.60–₱89.04 · Region VI range',
    note: 'Pipe length, pressure class and brand are not specified.',
  },
  {
    material: 'PVC pipe · 3/4 inch',
    app: 'Rows 3275, 3326 and 3856 · ₱150, ₱185 and ₱195 per piece',
    cmpd: '₱89.60–₱119.17 · Region VI range',
    note: 'Pipe length, pressure class and brand are not specified.',
  },
  {
    material: 'PVC pipe · 1 inch',
    app: 'Row 3857 · ₱239 per piece',
    cmpd: '₱147.50–₱226.24 · Region VI range',
    note: 'Pipe length, pressure class and brand are not specified.',
  },
  {
    material: 'PVC pipe · 1 1/2 inch',
    app: 'Rows 3799 and 3858 · ₱500 per piece',
    cmpd: '₱265–₱369.40 · Region VI range',
    note: 'Pipe length, pressure class and brand are not specified.',
  },
];

export default function Cmpd() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 max-w-4xl">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-800">
          Miagao · FY2026
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">
          CMPD reference prices
        </h1>
        <p className="mt-3 text-lg leading-7 text-slate-700">
          A screening comparison between selected Miagao Annual Procurement Plan
          (APP) supply lines and DPWH Construction Materials Price Data for the
          first semester of 2026.
        </p>
      </header>

      <div className="mb-7">
        <AnalysisDisclaimer>
          These are reference-price comparisons, not findings of overpricing.
          Product specifications, quality, delivery, taxes, timing and package
          scope can change prices. Review the original APP and comparable
          quotations before drawing conclusions.
        </AnalysisDisclaimer>
      </div>

      <section
        className="mb-8 grid gap-4 sm:grid-cols-3"
        aria-label="Dataset coverage"
      >
        {[
          ['63,040', 'CMPD price rows'],
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              APP item comparisons
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              APP unit amounts are calculated from the stated line budget and
              quantity. CMPD values are Region VI office references; they are
              not Miagao municipal quotations.
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
          <table className="w-full min-w-[850px] border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="p-3">Material</th>
                <th className="p-3">Miagao APP amount</th>
                <th className="p-3">Region VI CMPD reference</th>
                <th className="p-3">Limits to the comparison</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((row, index) => (
                <tr
                  key={row.material}
                  className={index % 2 ? 'bg-slate-50' : 'bg-white'}
                >
                  <th
                    scope="row"
                    className="p-3 align-top font-semibold text-slate-900"
                  >
                    {row.material}
                  </th>
                  <td className="p-3 align-top text-slate-700">{row.app}</td>
                  <td className="p-3 align-top text-slate-700">{row.cmpd}</td>
                  <td className="p-3 align-top text-slate-600">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">
          Rows come from the official{' '}
          <a
            className="font-semibold text-blue-800 underline"
            href={appUrl}
            target="_blank"
            rel="noreferrer"
          >
            FY2026 Consolidated APP
          </a>{' '}
          and the CMPD first-semester 2026 extract. A material name and unit
          match is a lead for checking specifications and procurement records;
          it does not establish that the products are equivalent.
        </p>
      </section>

      <p className="mt-4 text-xs text-slate-500">
        Amounts shown in Philippine pesos. APP quantities and totals are taken
        from the displayed source rows; unit amounts are derived by division.
      </p>
    </main>
  );
}
