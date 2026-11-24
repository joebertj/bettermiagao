import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import snapshot from '../../data/miagao-scr.json';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const stages = [
  ['nep', 'NEP'],
  ['house', 'House bill'],
  ['scr', 'Senate Committee Report'],
] as const;

const statuses = [...new Set(snapshot.rows.map(row => row.status))].sort();
const programs = Object.entries(snapshot.programs);

export default function ScrComparison() {
  const [program, setProgram] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const query = search
    .trim()
    .toLowerCase()
    .replace(/miag-ao/g, 'miagao');
  const rows = snapshot.rows.filter(
    row =>
      (!program || row.program === program) &&
      (!status || row.status === status) &&
      `${row.title} ${row.houseTitle ?? ''} ${row.office ?? ''} ${row.locationBasis}`
        .toLowerCase()
        .replace(/miag-ao/g, 'miagao')
        .includes(query)
  );

  return (
    <section className="mb-10" aria-labelledby="scr-comparison-title">
      <h2
        id="scr-comparison-title"
        className="text-2xl font-bold text-slate-950"
      >
        FY2027 Senate Committee Report comparison
      </h2>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-700">
        Compare the same Miagao-linked rows across the NEP, House bill and
        Senate Committee Report (SCR). A dash indicates a missing stage amount.
        A zero marks a recorded removal. The columns are separate proposals.
      </p>
      <div className="my-4 grid gap-3 sm:grid-cols-3">
        {stages.map(([key, label]) => {
          const amounts = rows.flatMap(row => row[key]?.amountPesos ?? []);
          return (
            <article
              key={key}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <p className="text-sm text-slate-600">{label}</p>
              <strong className="mt-1 block text-2xl text-slate-950">
                {amounts.length
                  ? peso.format(
                      amounts.reduce((sum, amount) => sum + amount, 0)
                    )
                  : '—'}
              </strong>
              <p className="text-sm text-slate-600">
                {amounts.length} rows with a listed amount
              </p>
            </article>
          );
        })}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <input
          type="search"
          aria-label="Search SCR comparison rows"
          placeholder="Search title or place"
          value={search}
          onChange={event => setSearch(event.target.value)}
          className="h-11 rounded-lg border border-gray-300 px-3"
        />
        <select
          aria-label="Filter SCR program"
          value={program}
          onChange={event => setProgram(event.target.value)}
          className="h-11 rounded-lg border border-gray-300 px-3"
        >
          <option value="">All programs</option>
          {programs.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter SCR status"
          value={status}
          onChange={event => setStatus(event.target.value)}
          className="h-11 rounded-lg border border-gray-300 px-3"
        >
          <option value="">All SCR statuses</option>
          {statuses.map(label => (
            <option key={label}>{label}</option>
          ))}
        </select>
      </div>
      <p className="mb-3 text-sm text-gray-600" aria-live="polite">
        Showing {rows.length} of {snapshot.rows.length} comparison rows.
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-950 text-white">
            <tr>
              <th scope="col" className="px-4 py-3">
                Project
              </th>
              <th scope="col" className="px-4 py-3">
                SCR status
              </th>
              {stages.map(([key, label]) => (
                <th key={key} scope="col" className="px-4 py-3 text-right">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.id}
                className="border-t border-slate-200 align-top even:bg-slate-50"
              >
                <td className="px-4 py-3">
                  {row.title}
                  {row.houseTitle && row.houseTitle !== row.title && (
                    <p className="mt-1 text-xs text-gray-600">
                      House title · {row.houseTitle}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-600">
                    {row.locationBasis}
                  </p>
                </td>
                <td className="px-4 py-3">{row.status}</td>
                {stages.map(([key]) => {
                  const value = row[key];
                  return (
                    <td key={key} className="px-4 py-3 text-right tabular-nums">
                      <span className="whitespace-nowrap">
                        {value ? peso.format(value.amountPesos) : '—'}
                      </span>
                      {value?.url && (
                        <a
                          className="mt-1 block text-xs font-semibold text-blue-800 underline"
                          href={value.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {value.source}
                        </a>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-600">
                  No rows match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <a
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-800 underline"
        href={snapshot.sourceUrl}
      >
        BetterGov SCR source and methodology <ExternalLink size={13} />
      </a>
    </section>
  );
}
