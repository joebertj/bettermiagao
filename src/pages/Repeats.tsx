import { useState } from 'react';
import { Link } from 'react-router';
import records from '../data/miagao-repeats.json';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});
const categories = [
  ...new Set(records.projects.map(project => project.category)),
].sort();
const years = [
  ...new Set(records.projects.flatMap(project => project.years)),
].sort((a, b) => b - a);
const searchKey = (value: string) =>
  value.toLowerCase().replace(/miag-ao/g, 'miagao');

export default function Repeats() {
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [category, setCategory] = useState('');
  const query = searchKey(search.trim());
  const projects = records.projects.filter(
    project =>
      (!year || project.years.includes(Number(year))) &&
      (!category || project.category === category) &&
      searchKey(
        [project.method, ...project.lines.map(line => line.title)].join(' ')
      ).includes(query)
  );

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 rounded-3xl bg-slate-950 p-6 text-white sm:p-9">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Repeated national projects in Miagao
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
          Explore matching DPWH titles and identified bridge assets in two or
          more fiscal years. The records span enacted GAA lines from FY
          {records.firstYear} through FY{records.lastGaaYear} and linked FY2027
          proposals.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Each project shows the original title, amount and source for every
          match. Compare the funded scope before drawing conclusions about
          duplicate work. Multiple FY2027 proposal stages count as one fiscal
          year.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          type="search"
          aria-label="Search repeat projects"
          placeholder="Search project title or place"
          value={search}
          onChange={event => setSearch(event.target.value)}
          className="h-11 rounded-lg border border-gray-300 bg-white px-3"
        />
        <select
          aria-label="Filter repeat projects by year"
          value={year}
          onChange={event => setYear(event.target.value)}
          className="h-11 rounded-lg border border-gray-300 bg-white px-3"
        >
          <option value="">All fiscal years</option>
          {years.map(value => (
            <option key={value} value={value}>
              FY{value}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter repeat projects by category"
          value={category}
          onChange={event => setCategory(event.target.value)}
          className="h-11 rounded-lg border border-gray-300 bg-white px-3"
        >
          <option value="">All categories</option>
          {categories.map(value => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      <p className="my-4 text-sm text-slate-600" aria-live="polite">
        Showing {projects.length} of {records.projects.length} repeat project
        groups.
      </p>
      <div className="space-y-4">
        {projects.map(project => (
          <details
            key={project.id}
            className="rounded-xl border border-slate-200 bg-white"
          >
            <summary className="cursor-pointer p-4">
              <strong className="text-lg text-slate-950">
                {project.title}
              </strong>
              <span className="mt-1 block text-sm text-slate-600">
                {project.category} · {project.years.length} fiscal years ·{' '}
                {project.years.join(', ')} ·{' '}
                {peso.format(project.gaaTotalPesos)} in matched GAA lines
              </span>
            </summary>
            <div className="border-t border-slate-200 p-4">
              <p className="mb-3 text-sm text-slate-700">{project.method}</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-100 text-slate-950">
                    <tr>
                      <th scope="col" className="p-3">
                        Year and stage
                      </th>
                      <th scope="col" className="p-3">
                        Published title
                      </th>
                      <th scope="col" className="p-3 text-right">
                        Amount
                      </th>
                      <th scope="col" className="p-3">
                        Source
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.lines.map((line, index) => (
                      <tr
                        key={`${line.year}-${line.stage}-${index}`}
                        className="border-t border-slate-200 align-top"
                      >
                        <td className="whitespace-nowrap p-3">
                          FY{line.year} · {line.stage}
                        </td>
                        <td className="p-3">{line.title}</td>
                        <td className="whitespace-nowrap p-3 text-right tabular-nums">
                          {peso.format(line.amountPesos)}
                        </td>
                        <td className="p-3">
                          {line.url ? (
                            <a
                              href={line.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-800 underline"
                            >
                              {line.source}
                            </a>
                          ) : (
                            line.source
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        ))}
        {!projects.length && (
          <p className="rounded-xl border border-slate-200 bg-white p-4">
            No repeat projects match those filters.
          </p>
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-blue-800">
        <Link to="/projects" className="underline">
          Miagao project list
        </Link>
        <Link to="/budget" className="underline">
          Miagao FY2027 budget comparison
        </Link>
        <a
          href="https://research.bettergov.ph/static/nep-preview/repeats-historical.html"
          className="underline"
        >
          BetterGov historical repeats
        </a>
      </div>
    </main>
  );
}
