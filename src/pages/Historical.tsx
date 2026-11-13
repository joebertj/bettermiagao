import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';

type HistoricalRow = {
  id: string;
  documentSha256: string;
  sourceFileName: string;
  sourceTitle: string;
  publishedAt: string | null;
  documentUrl: string | null;
  sourcePageUrl: string | null;
  sourceReferences: {
    documentUrl?: string;
    sourcePageUrl?: string;
    sourceTitle?: string;
  }[];
  pageNumber: number | null;
  extractionMethod: string;
  parseStatus: string;
  ocrMeanConfidence: number | null;
  ocrTokenCount: number | null;
  extractedText: string;
};

type HistoricalIndex = {
  generatedAtUtc: string;
  parserStatus: string;
  parserUpdatedAtUtc: string | null;
  summary: {
    sourceDocuments: number;
    completedDocuments: number;
    ocrPageRows: number;
    nativeTextDocuments: number;
    errorDocuments: number;
    intentionallySkippedDocuments: number;
    pendingDocuments: number;
  };
  rows: HistoricalRow[];
};

const indexUrl = `${import.meta.env.BASE_URL}data/miagao-historical-index.json`;
const pageSize = 25;

function displayDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
}

function statusLabel(row: HistoricalRow) {
  if (row.parseStatus === 'native_text_sufficient') return 'Native text';
  if (row.parseStatus === 'ocr_text_found') return 'OCR text found';
  if (row.parseStatus === 'no_text_detected') return 'No text detected';
  return row.parseStatus.replaceAll('_', ' ');
}

function excerpt(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > 240 ? `${normalized.slice(0, 240)}…` : normalized;
}

export default function Historical() {
  const [data, setData] = useState<HistoricalIndex | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    fetch(indexUrl)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<HistoricalIndex>;
      })
      .then(value => {
        if (active) setData(value);
      })
      .catch(reason => {
        if (active)
          setError(
            `Historical records could not be loaded (${String(reason)}).`
          );
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (data?.rows ?? []).filter(row => {
      const statusMatches =
        statusFilter === 'all' || row.parseStatus === statusFilter;
      const queryMatches =
        !needle ||
        [
          row.sourceTitle,
          row.sourceFileName,
          row.extractedText,
          row.sourcePageUrl,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()
          .includes(needle);
      return statusMatches && queryMatches;
    });
  }, [data, query, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-9">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-200">
          Miagao · historical records
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Parsed transparency documents
        </h1>
        <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-300">
          Search the available extracted pages and open the original documents
          or the Miagao source pages. OCR text is a transcription aid and may
          need review against the source scan.
        </p>
      </header>

      {data && (
        <section
          className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
          aria-label="Parser coverage"
        >
          {[
            ['Source files', data.summary.sourceDocuments],
            ['Parsed files', data.summary.completedDocuments],
            ['OCR page records', data.summary.ocrPageRows],
            ['Pending', data.summary.pendingDocuments],
            [
              'Errors / skipped',
              data.summary.errorDocuments +
                data.summary.intentionallySkippedDocuments,
            ],
          ].map(([label, value]) => (
            <article
              key={label}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <span className="block text-sm text-gray-600">{label}</span>
              <strong className="mt-1 block text-2xl tabular-nums text-slate-950">
                {Number(value).toLocaleString('en-PH')}
              </strong>
            </article>
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1 text-sm font-semibold text-slate-800">
            Search title, filename, or extracted text
            <span className="mt-1 flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-3">
              <Search size={17} className="text-gray-500" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={event => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                className="w-full border-0 bg-transparent p-0 text-sm font-normal outline-none focus:ring-0"
                placeholder="Project name, bid, amount, filename…"
              />
            </span>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Extraction status
            <select
              value={statusFilter}
              onChange={event => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="mt-1 block min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal"
            >
              <option value="all">All statuses</option>
              <option value="ocr_text_found">OCR text found</option>
              <option value="no_text_detected">No text detected</option>
              <option value="native_text_sufficient">Native text</option>
            </select>
          </label>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
            {error}
          </p>
        )}
        {!data && !error && (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-gray-600">
            Loading parsed records…
          </p>
        )}
        {data && (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
              <p>
                {filtered.length.toLocaleString('en-PH')} records · parser
                status: {data.parserStatus.replaceAll('_', ' ')}
              </p>
              <p>Index generated {displayDate(data.generatedAtUtc)}</p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[950px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-3 py-3">Posted</th>
                    <th className="px-3 py-3">Document and page</th>
                    <th className="px-3 py-3">Extraction</th>
                    <th className="px-3 py-3">OCR confidence</th>
                    <th className="px-3 py-3">Text preview and sources</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visible.map(row => (
                    <tr key={row.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-4 text-gray-700">
                        {displayDate(row.publishedAt)}
                      </td>
                      <td className="max-w-xs px-3 py-4">
                        <strong className="block text-slate-900">
                          {row.sourceTitle}
                        </strong>
                        <span className="mt-1 block break-all text-xs text-gray-500">
                          {row.sourceFileName}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {row.pageNumber
                            ? `Page ${row.pageNumber}`
                            : 'Document record'}
                          {row.ocrTokenCount != null
                            ? ` · ${row.ocrTokenCount} text regions`
                            : ''}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">
                          {statusLabel(row)}
                        </span>
                        <span className="mt-2 block max-w-44 text-xs leading-5 text-gray-600">
                          {row.extractionMethod}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 tabular-nums text-gray-700">
                        {row.ocrMeanConfidence == null
                          ? '—'
                          : `${(row.ocrMeanConfidence * 100).toFixed(1)}%`}
                      </td>
                      <td className="px-3 py-4">
                        {row.extractedText ? (
                          <>
                            <p className="max-w-xl whitespace-normal text-gray-700">
                              {excerpt(row.extractedText)}
                            </p>
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-semibold text-blue-800">
                                Read full extracted text
                              </summary>
                              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-800">
                                {row.extractedText}
                              </pre>
                            </details>
                          </>
                        ) : (
                          <p className="text-gray-500">
                            Native text record; text is available from its
                            source file.
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {row.documentUrl && (
                            <a
                              className="inline-flex items-center gap-1 font-semibold text-blue-800 underline"
                              href={row.documentUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Original document <ExternalLink size={12} />
                            </a>
                          )}
                          {row.sourcePageUrl &&
                            row.sourcePageUrl !== row.documentUrl && (
                              <a
                                className="inline-flex items-center gap-1 font-semibold text-blue-800 underline"
                                href={row.sourcePageUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Source page <ExternalLink size={12} />
                              </a>
                            )}
                          {row.sourceReferences.length > 2 && (
                            <span className="text-gray-500">
                              +{row.sourceReferences.length - 2} more source
                              references
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-10 text-center text-gray-600"
                      >
                        No parsed records match those filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm text-gray-600">
                Page {page} of {pageCount}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-slate-800 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(pageCount, page + 1))}
                  disabled={page >= pageCount}
                  className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-slate-800 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
            <p className="mt-5 text-xs leading-5 text-gray-500">
              OCR confidence describes text-recognition confidence, not the
              accuracy of a project, amount, or procurement claim. Use the
              original document to verify transcribed details. Parser status was
              last updated {displayDate(data.parserUpdatedAtUtc)}.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
