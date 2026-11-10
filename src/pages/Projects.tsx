import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ExternalLink,
  Search,
} from 'lucide-react';
import records from '../data/miagao-projects.json';
import barangayInventory from '../data/miagao-barangay-inventory.json';
import { miagaoBarangays } from '../data/miagao-barangays';
import Glance from './Glance';

function titleMentions(title: string, place: string) {
  const text = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const phrase = place
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!phrase || !` ${text} `.includes(` ${phrase} `)) return false;
  // Do not count a short barangay name when it is only part of a longer PSGC name.
  return !miagaoBarangays.some(other => {
    const longer = other
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    return (
      longer.length > phrase.length &&
      longer.includes(phrase) &&
      ` ${text} `.includes(` ${longer} `)
    );
  });
}

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

function NationalBarangayBars({
  title,
  rows,
  formatter,
}: {
  title: string;
  rows: { name: string; value: number }[];
  formatter: (value: number) => string;
}) {
  const maximum = Math.max(1, ...rows.map(row => row.value));
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
      <h3 className="text-lg font-bold text-slate-950">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div
            key={row.name}
            className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 text-sm"
          >
            <span className="text-xs font-semibold text-slate-500">
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="mb-1 truncate font-medium text-slate-800">
                {row.name}
              </div>
              <div className="h-2.5 rounded-full bg-slate-100">
                <div
                  className="h-2.5 rounded-full bg-blue-700"
                  style={{
                    width: Math.max(2, (row.value / maximum) * 100) + '%',
                  }}
                />
              </div>
            </div>
            <strong className="pl-1 text-right text-xs tabular-nums text-slate-800">
              {formatter(row.value)}
            </strong>
          </div>
        ))}
        {!rows.length && (
          <p className="text-sm text-gray-600">No matching records.</p>
        )}
      </div>
    </article>
  );
}

export default function Projects() {
  const [year, setYear] = useState('all');
  const [category, setCategory] = useState('all');
  const [barangay, setBarangay] = useState('all');
  const [query, setQuery] = useState('');
  const [amountOrder, setAmountOrder] = useState<'desc' | 'asc'>('desc');
  const [language, setLanguage] = useState<'en' | 'krj'>('en');
  const karayA = language === 'krj';
  const years = [
    ...new Set(records.projects.map(project => project.year)),
  ].sort((a, b) => b - a);
  const categories = [
    ...new Set(records.projects.map(project => project.category)),
  ].sort();
  const q = query.trim().toLowerCase();
  const filtered = records.projects
    .filter(
      project =>
        (year === 'all' || project.year === Number(year)) &&
        (category === 'all' || project.category === category) &&
        (barangay === 'all' || titleMentions(project.name, barangay)) &&
        (!q ||
          `${project.name} ${project.source} ${project.category}`
            .toLowerCase()
            .includes(q))
    )
    .sort((a, b) =>
      amountOrder === 'desc'
        ? b.amountPesos - a.amountPesos || a.name.localeCompare(b.name)
        : a.amountPesos - b.amountPesos || a.name.localeCompare(b.name)
    );
  const recent = records.projects.filter(
    project => project.year >= 2017 && project.year <= 2026
  );
  const proposed = records.projects.filter(project => project.year === 2027);
  const annual = years
    .filter(value => value !== 2027)
    .map(value => ({
      year: value,
      amount: recent
        .filter(project => project.year === value)
        .reduce((sum, project) => sum + project.amountPesos, 0),
    }));
  const maxAnnual = Math.max(...annual.map(item => item.amount), 1);
  const proposedTypes = categories
    .map(name => ({
      name,
      amount: proposed
        .filter(project => project.category === name)
        .reduce((sum, project) => sum + project.amountPesos, 0),
      count: proposed.filter(project => project.category === name).length,
    }))
    .filter(item => item.count)
    .sort((a, b) => b.amount - a.amount);
  const proposedBarangays = miagaoBarangays
    .map(name => ({
      name,
      count: proposed.filter(project => titleMentions(project.name, name))
        .length,
    }))
    .filter(item => item.count)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const hgabMpbByBarangay = barangayInventory.barangays
    .map(row => ({
      name: row.name,
      value: row.mpb.records
        .filter(project => project.year === 2027)
        .reduce((sum, project) => sum + (project.amountPesos || 0), 0),
    }))
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, 8);
  const hgabDpwhByBarangay = barangayInventory.barangays
    .map(row => ({
      name: row.name,
      value: row.titleMatchedProjects.filter(project => project.year === 2027)
        .length,
    }))
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, 8);
  const barangaysWithNationalDpwh = barangayInventory.barangays.filter(
    row => row.titleMatchedProjects.length > 0
  ).length;
  const barangaysWithHgabMpb = barangayInventory.barangays.filter(row =>
    row.mpb.records.some(project => project.year === 2027)
  ).length;

  const exportRows = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: 'application/json',
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'miagao-project-title-matches.json';
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-9">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-200">
            Miagao · National funding
          </p>
          <button
            type="button"
            onClick={() => setLanguage(karayA ? 'en' : 'krj')}
            className="rounded-full border border-white/30 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            aria-label="Switch page language"
          >
            {karayA ? 'English' : 'Kinaray-a'}
          </button>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          {karayA
            ? 'Pambansa nga mga proyekto sa Miagao'
            : 'National projects named in Miagao'}
        </h1>
        <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-300">
          {karayA
            ? 'Mga rekord kang DPWH GAA kag FY2027 House proposal nga ang titulo nagngaran kang Miagao, Iloilo.'
            : 'Explore historical DPWH GAA lines and the FY2027 House proposal records whose published titles mention Miagao, Iloilo.'}
        </p>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
          This is a title-matched list. It can miss projects named only for a
          barangay or another locality, and some corridor works may extend
          beyond Miagao. Amounts are budget figures, not proof of spending or
          completion.
        </p>
        <div
          className="mt-8 grid gap-3 md:grid-cols-3"
          aria-label="National project totals"
        >
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-300">
              Historic GAA lines · 2017–2026
            </p>
            <strong className="mt-2 block text-3xl">
              {recent.length.toLocaleString()}
            </strong>
            <p className="mt-1 text-sm text-slate-300">listed project rows</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-300">FY2027 House proposal</p>
            <strong className="mt-2 block text-3xl">
              {proposed.length.toLocaleString()}
            </strong>
            <p className="mt-1 text-sm text-slate-300">project rows</p>
          </article>
          <article className="rounded-2xl bg-blue-700 p-5">
            <p className="text-sm text-blue-100">FY2027 proposed allocation</p>
            <strong className="mt-2 block text-3xl">
              {money.format(
                proposed.reduce((sum, project) => sum + project.amountPesos, 0)
              )}
            </strong>
            <p className="mt-1 text-sm text-blue-100">
              House 3rd-reading extract · proposal, not enacted GAA
            </p>
          </article>
        </div>
      </header>

      <section className="mb-12 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-bold text-gray-950">
            Past listed allocations
          </h2>
          <p className="mb-5 mt-1 text-sm text-gray-600">
            GAA lines, grouped by fiscal year. 2027 is shown separately as a
            House proposal.
          </p>
          <div className="space-y-3">
            {annual.map(item => (
              <div
                key={item.year}
                className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 text-sm"
              >
                <span className="font-semibold">{item.year}</span>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-700"
                    style={{
                      width: `${Math.max((item.amount / maxAnnual) * 100, item.amount ? 1 : 0)}%`,
                    }}
                  />
                </div>
                <span className="min-w-24 text-right tabular-nums">
                  {money.format(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-bold text-gray-950">
            What appears in the 2027 proposal?
          </h2>
          <p className="mb-5 mt-1 text-sm text-gray-600">
            Current House 3rd-reading extract, grouped by BetterGov project
            category.
          </p>
          <div className="space-y-5">
            {proposedTypes.map(item => (
              <div key={item.name}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-gray-900">
                    {item.name}{' '}
                    <span className="font-normal text-gray-500">
                      · {item.count} rows
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {money.format(item.amount)}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{
                      width: `${(item.amount / Math.max(...proposedTypes.map(x => x.amount), 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-gray-500">
            The FY2027 values are proposed allocations in the House bill and may
            change during the legislative process.
          </p>
        </div>
      </section>

      <section className="mb-12" aria-labelledby="national-barangay-title">
        <div className="rounded-2xl bg-slate-950 px-6 py-5 text-white sm:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-200">
            National records · separate from Miagao local funds
          </p>
          <h2 id="national-barangay-title" className="mt-2 text-2xl font-bold">
            National project matches by barangay
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            These DPWH GAA and FY2027 House proposal records are linked by
            project titles or source-listed locations. They are national
            appropriations, not allocations controlled by the municipal LGU; a
            title match does not establish the exact project footprint.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl bg-blue-800 p-5 text-white">
            <strong className="block text-3xl">
              {barangaysWithNationalDpwh}
            </strong>
            <span className="text-sm text-blue-100">
              barangays with a national DPWH match
            </span>
          </article>
          <article className="rounded-xl bg-amber-400 p-5 text-slate-950">
            <strong className="block text-3xl">{barangaysWithHgabMpb}</strong>
            <span className="text-sm">barangays with an FY2027 MPB record</span>
          </article>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <NationalBarangayBars
            title="FY2027 MPB allocations · by named barangay"
            rows={hgabMpbByBarangay}
            formatter={value => money.format(value)}
          />
          <NationalBarangayBars
            title="FY2027 DPWH project-title matches · by barangay"
            rows={hgabDpwhByBarangay}
            formatter={value => value + ' rows'}
          />
        </div>
      </section>
      <Glance nationalOnly />

      <section
        className="mb-12 rounded-2xl border border-blue-200 bg-blue-50 p-6 sm:p-7"
        aria-labelledby="barangay-title"
      >
        <p className="text-sm font-bold uppercase tracking-widest text-blue-800">
          FY2027 · Barangay title mentions
        </p>
        <h2
          id="barangay-title"
          className="mt-2 text-2xl font-bold text-slate-950"
        >
          {karayA
            ? 'Ano nga mga barangay ang ara sa mga titulo?'
            : 'Which barangays appear in project titles?'}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-700">
          {karayA
            ? 'Mga ngaran kang barangay nga ara sa titulo lamang ang gin-ihap. Isa ka proyekto mahimo magngaran kang madamo nga barangay, gani indi ginbahin-bahin ang kantidad.'
            : 'Counts are exact name mentions matched against Miagao’s PSGC barangay list. One road may name several barangays, so these are title mentions, not unique project sites; allocations are not split across barangays.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {proposedBarangays.map(item => (
            <button
              key={item.name}
              type="button"
              onClick={() => {
                setYear('2027');
                setBarangay(item.name);
                document
                  .getElementById('project-rows')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="rounded-full border border-blue-200 bg-white px-3 py-2 text-sm text-slate-800 hover:border-blue-500 hover:bg-blue-100"
            >
              <span className="font-semibold">{item.name}</span>
              <span className="ml-2 text-blue-800">{item.count}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-gray-600">
          {proposedBarangays.length} of 119 barangay names appear in at least
          one FY2027 title. PSGC spelling is used for matching; a differently
          spelled source title may not match.
        </p>
      </section>

      <section
        id="project-rows"
        className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-7"
      >
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-950">Project rows</h2>
            <p className="mt-1 text-sm text-gray-600">
              {filtered.length} matching rows
            </p>
          </div>
          <button
            onClick={exportRows}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <ArrowDownToLine size={16} /> Export filtered JSON
          </button>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="relative">
            <span className="sr-only">Search projects</span>
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <input
              className="h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={
                karayA ? 'Pangita proyekto' : 'Search title or source'
              }
            />
          </label>
          <label>
            <span className="sr-only">Filter year</span>
            <select
              className="h-11 w-full rounded-lg border border-gray-300 px-3"
              value={year}
              onChange={event => setYear(event.target.value)}
            >
              <option value="all">All years</option>
              {years.map(value => (
                <option key={value} value={value}>
                  {value}
                  {value === 2027 ? ' · House proposal' : ' · GAA'}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter category</span>
            <select
              className="h-11 w-full rounded-lg border border-gray-300 px-3"
              value={category}
              onChange={event => setCategory(event.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter barangay named in title</span>
            <select
              className="h-11 w-full rounded-lg border border-gray-300 px-3"
              value={barangay}
              onChange={event => setBarangay(event.target.value)}
            >
              <option value="all">All barangay title mentions</option>
              {miagaoBarangays.map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Sort by listed amount</span>
            <select
              className="h-11 w-full rounded-lg border border-gray-300 px-3"
              value={amountOrder}
              onChange={event =>
                setAmountOrder(event.target.value as 'desc' | 'asc')
              }
            >
              <option value="desc">Listed amount · highest first</option>
              <option value="asc">Listed amount · lowest first</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[850px] border-collapse text-left text-sm">
            <thead className="bg-slate-950 text-white">
              <tr>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Project title</th>
                <th
                  aria-sort={
                    amountOrder === 'desc' ? 'descending' : 'ascending'
                  }
                  className="px-4 py-3 text-right"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setAmountOrder(current =>
                        current === 'desc' ? 'asc' : 'desc'
                      )
                    }
                    className="inline-flex items-center justify-end gap-2 text-right font-bold hover:underline"
                    aria-label={`Sort by listed amount, currently ${amountOrder === 'desc' ? 'highest first' : 'lowest first'}`}
                    title="Toggle amount order"
                  >
                    Listed Amount
                    {amountOrder === 'desc' ? (
                      <ArrowDownWideNarrow size={16} aria-hidden="true" />
                    ) : (
                      <ArrowUpNarrowWide size={16} aria-hidden="true" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">Source reference</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((project, index) => (
                <tr
                  key={`${project.year}-${project.name}-${index}`}
                  className="border-t border-gray-200 align-top odd:bg-white even:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">
                    {project.year}
                    <div className="text-xs font-normal text-gray-500">
                      {project.stage}
                    </div>
                  </td>
                  <td className="px-4 py-3">{project.category}</td>
                  <td className="min-w-80 px-4 py-3 font-medium text-gray-900">
                    {project.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {money.format(project.amountPesos)}
                  </td>
                  <td className="min-w-56 px-4 py-3 text-xs leading-5 text-gray-600">
                    {project.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-gray-500">
          Dataset snapshot: {records.generatedAt}.{' '}
          <a
            className="inline-flex items-center gap-1 font-medium text-blue-700 underline"
            href={records.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            BetterGov project data <ExternalLink size={12} />
          </a>
        </p>
      </section>
    </main>
  );
}
