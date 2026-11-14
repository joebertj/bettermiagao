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

type ParsedTableRow = {
  cells: string[];
  text: string;
  item?: string;
  value?: string;
};
type ParsedDocument = {
  documentUrl: string;
  sourcePageUrl: string | null;
  sourceTitle: string;
  sourceFileName: string;
  publishedAt: string | null;
  originalLabel: string;
  sourceReferences: HistoricalRow['sourceReferences'];
  documentSha256: string | null;
  parseStatus: string | null;
  extractionMethod: string | null;
  normalizedCategory: string;
  normalizedCategoryLabel: string;
  categoryBasis: 'document heading' | 'source filename';
  parsedTitle: string | null;
  reportingPeriod: string | null;
  extractionStatus: string;
  pageCount: number;
  tablePages: { pageNumber: number; rows: ParsedTableRow[] }[];
};

type HistoricalTables = {
  generatedAt: string;
  method: string;
  disclaimer: string;
  documents: ParsedDocument[];
};

type HistoricalIndex = {
  generatedAtUtc: string;
  parserStatus: string;
  parserUpdatedAtUtc: string | null;
  summary: {
    sourceDocuments: number;
    parserCandidateDocuments: number;
    completedDocuments: number;
    unsupportedDocuments: number;
    ocrPageRows: number;
    nativeTextDocuments: number;
    errorDocuments: number;
    intentionallySkippedDocuments: number;
    pendingDocuments: number;
  };
  rows: HistoricalRow[];
};

const indexUrl = `${import.meta.env.BASE_URL}data/miagao-historical-index.json`;
const tablesUrl = `${import.meta.env.BASE_URL}data/miagao-historical-tables.json`;
const pageSize = 25;

const disclosureTypes = [
  {
    id: 'bid-out',
    label: 'Bid-out: civil works, goods and services',
  },
  {
    id: 'human-resource-complement',
    label: 'Human resource complement',
  },
  {
    id: 'ldrrmf-utilization',
    label: 'Local disaster risk reduction and management fund utilization',
  },
  {
    id: 'cash-flows',
    label: 'Cash flow statement',
  },
  {
    id: 'sef-utilization',
    label: 'Report of SEF utilization',
  },
  {
    id: 'receipts-expenditures',
    label: 'Statement of receipts and expenditures',
  },
  {
    id: 'supplemental-procurement-plan',
    label: 'Supplemental procurement plan',
  },
  {
    id: 'quarterly-government-projects',
    label:
      'Consolidated quarterly report on government projects, programs or activities',
  },
  {
    id: 'debt-service',
    label: 'Statement of debt services',
  },
  {
    id: 'unliquidated-cash-advances',
    label: 'Unliquidated cash advances',
  },
  {
    id: 'trust-fund-utilization',
    label: 'Trust fund utilization',
  },
  {
    id: 'ira-utilization',
    label: '20% component of the IRA utilization',
  },
] as const;

type DisclosureType = (typeof disclosureTypes)[number]['id'];
type RecordCategory =
  'invitation-to-bid' | 'other' | 'full-disclosure' | DisclosureType;

function documentFilename(row: HistoricalRow) {
  const url =
    row.documentUrl ??
    row.sourceReferences.find(reference => reference.documentUrl)?.documentUrl;
  if (!url) return row.sourceFileName;
  try {
    return decodeURIComponent(
      new URL(url).pathname.split('/').at(-1) ?? row.sourceFileName
    );
  } catch {
    return row.sourceFileName;
  }
}

function isInvitationToBid(row: HistoricalRow) {
  const text =
    `${row.sourceTitle} ${documentFilename(row)} ${row.sourcePageUrl ?? ''}`.toLocaleLowerCase();
  return (
    text.includes('invitation to bid') || text.includes('invitation-to-bid')
  );
}

function isFullDisclosure(document: ParsedDocument) {
  return `${document.sourcePageUrl ?? ''} ${document.sourceTitle}`
    .toLocaleLowerCase()
    .includes('full disclosure');
}

function documentMatchesCategory(
  document: ParsedDocument,
  category: RecordCategory
) {
  if (category === 'invitation-to-bid') return false;
  if (category === 'full-disclosure')
    return (
      isFullDisclosure(document) || document.normalizedCategory !== 'other'
    );
  if (category === 'other') return document.normalizedCategory === 'other';
  return document.normalizedCategory === category;
}

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
  const [tables, setTables] = useState<HistoricalTables | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [category, setCategory] = useState<RecordCategory>('invitation-to-bid');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(indexUrl, { cache: 'no-store' }),
      fetch(tablesUrl, { cache: 'no-store' }),
    ])
      .then(async ([indexResponse, tablesResponse]) => {
        if (!indexResponse.ok)
          throw new Error(`Index HTTP ${indexResponse.status}`);
        if (!tablesResponse.ok)
          throw new Error(`Tables HTTP ${tablesResponse.status}`);
        return Promise.all([
          indexResponse.json() as Promise<HistoricalIndex>,
          tablesResponse.json() as Promise<HistoricalTables>,
        ]);
      })
      .then(([index, parsedTables]) => {
        if (active) {
          setData(index);
          setTables(parsedTables);
        }
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

  useEffect(() => {
    let active = true;
    const refreshInterval = window.setInterval(async () => {
      try {
        const response = await fetch(`${indexUrl}?refresh=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!response.ok) return;
        const index = (await response.json()) as HistoricalIndex;
        if (active) {
          setData(index);
          setError('');
        }
      } catch {
        // Keep the latest successful snapshot visible if a refresh is missed.
      }
    }, 15_000);

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
    };
  }, []);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (data?.rows ?? []).filter(row => {
      const matchesCategory =
        category === 'invitation-to-bid' && isInvitationToBid(row);
      const statusMatches =
        statusFilter === 'all' || row.parseStatus === statusFilter;
      const queryMatches =
        !needle ||
        [
          row.sourceTitle,
          row.sourceFileName,
          documentFilename(row),
          row.extractedText,
          row.sourcePageUrl,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()
          .includes(needle);
      return matchesCategory && statusMatches && queryMatches;
    });
  }, [category, data, query, statusFilter]);

  const filteredDocuments = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (tables?.documents ?? []).filter(document => {
      const matchesCategory = documentMatchesCategory(document, category);
      const statusMatches =
        statusFilter === 'all' || document.parseStatus === statusFilter;
      const extractedRows = document.tablePages
        .flatMap(page => page.rows.map(row => row.text))
        .join(' ');
      const queryMatches =
        !needle ||
        [
          document.originalLabel,
          document.sourceTitle,
          document.normalizedCategoryLabel,
          document.parsedTitle,
          document.reportingPeriod,
          extractedRows,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()
          .includes(needle);
      return matchesCategory && statusMatches && queryMatches;
    });
  }, [category, query, statusFilter, tables]);

  const categoryCounts = useMemo(() => {
    const docs = tables?.documents ?? [];
    const invitationDocuments = new Set(
      (data?.rows ?? [])
        .filter(isInvitationToBid)
        .map(row => row.documentSha256)
    );
    return Object.fromEntries(
      (
        [
          'invitation-to-bid',
          'full-disclosure',
          'other',
          ...disclosureTypes.map(type => type.id),
        ] as RecordCategory[]
      ).map(id => [
        id,
        id === 'invitation-to-bid'
          ? invitationDocuments.size
          : docs.filter(document => documentMatchesCategory(document, id))
              .length,
      ])
    );
  }, [data, tables]);
  const usingParsedTables = category !== 'invitation-to-bid';
  const filteredCount = usingParsedTables
    ? filteredDocuments.length
    : filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(filteredCount / pageSize));
  const visibleRows = filteredRows.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const visibleDocuments = filteredDocuments.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

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
        <p className="mt-3 text-sm text-slate-400">
          Parsed records refresh automatically while new documents are being
          processed.
        </p>
      </header>

      {data && (
        <section
          className="mb-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-7"
          aria-label="Parser coverage"
        >
          {[
            ['Source files', data.summary.sourceDocuments],
            ['PDF/JPEG candidates', data.summary.parserCandidateDocuments],
            ['Parsed files', data.summary.completedDocuments],
            ['OCR page records', data.summary.ocrPageRows],
            ['Pending', data.summary.pendingDocuments],
            ['Other file types', data.summary.unsupportedDocuments],
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
      {data && tables && (
        <p className="mb-6 text-sm text-slate-600">
          Structured tables are extracted from {tables.documents.length} parsed
          files. They are included in “Parsed files”; OCR page records count
          pages, so these figures overlap and should not be added together.
        </p>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
        <div
          className="mb-5 flex flex-wrap items-end gap-2"
          aria-label="Record category"
        >
          {[
            { id: 'invitation-to-bid' as const, label: 'Invitation to bid' },
            { id: 'other' as const, label: 'Other / unclassified' },
          ].map(item => (
            <button
              key={item.id}
              type="button"
              aria-pressed={category === item.id}
              onClick={() => {
                setCategory(item.id);
                setPage(1);
              }}
              className={`min-h-10 rounded-lg border px-4 text-sm font-semibold ${
                category === item.id
                  ? 'border-slate-950 bg-slate-950 text-white'
                  : 'border-gray-300 bg-white text-slate-800'
              }`}
            >
              {item.label} ({categoryCounts[item.id] ?? 0})
            </button>
          ))}
          <label className="text-sm font-semibold text-slate-800">
            Full disclosure documents
            <select
              value={
                category === 'full-disclosure' ||
                disclosureTypes.some(type => type.id === category)
                  ? category
                  : ''
              }
              onChange={event => {
                if (event.target.value)
                  setCategory(event.target.value as RecordCategory);
                setPage(1);
              }}
              className="ml-2 min-h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal"
            >
              <option value="">Choose a document type…</option>
              <option value="full-disclosure">
                All document types ({categoryCounts['full-disclosure'] ?? 0})
              </option>
              {disclosureTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.label} ({categoryCounts[type.id] ?? 0})
                </option>
              ))}
            </select>
          </label>
        </div>
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
        {(!data || !tables) && !error && (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-gray-600">
            Loading parsed records and document tables…
          </p>
        )}
        {data && tables && (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
              <p>
                {filteredCount.toLocaleString('en-PH')}{' '}
                {usingParsedTables ? 'documents' : 'records'} · parser status:{' '}
                {data.parserStatus.replaceAll('_', ' ')}
              </p>
              <p>Index generated {displayDate(data.generatedAtUtc)}</p>
            </div>
            {usingParsedTables && (
              <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                Normalized categories use the document heading when extractable,
                otherwise the source filename. Original filenames are retained.
                Spacing-based table cells are comparison aids; check the linked
                original before relying on a value. {tables.disclaimer}
              </p>
            )}
            {usingParsedTables ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[1150px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="px-3 py-3">Reporting period</th>
                      <th className="px-3 py-3">Original label</th>
                      <th className="px-3 py-3">
                        Normalized category and heading
                      </th>
                      <th className="px-3 py-3">Parsed table</th>
                      <th className="px-3 py-3">Sources</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleDocuments.map(document => {
                      const parsedRowCount = document.tablePages.reduce(
                        (total, page) => total + page.rows.length,
                        0
                      );
                      return (
                        <tr key={document.documentUrl} className="align-top">
                          <td className="whitespace-nowrap px-3 py-4 text-gray-700">
                            {document.reportingPeriod ??
                              displayDate(document.publishedAt)}
                          </td>
                          <td className="max-w-xs px-3 py-4">
                            <strong className="block break-words text-slate-900">
                              {document.originalLabel}
                            </strong>
                            <span className="mt-1 block text-xs text-gray-500">
                              {document.sourceTitle}
                            </span>
                          </td>
                          <td className="max-w-sm px-3 py-4">
                            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">
                              {document.normalizedCategoryLabel}
                            </span>
                            <p className="mt-2 break-words text-gray-800">
                              {document.parsedTitle ?? 'Heading not extracted'}
                            </p>
                            <span className="mt-1 block text-xs text-gray-500">
                              Classified from {document.categoryBasis}
                            </span>
                          </td>
                          <td className="max-w-xl px-3 py-4">
                            {parsedRowCount ? (
                              <details>
                                <summary className="cursor-pointer font-semibold text-blue-800">
                                  View {parsedRowCount.toLocaleString('en-PH')}{' '}
                                  parsed rows
                                </summary>
                                <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-gray-200">
                                  <table className="w-full border-collapse text-xs">
                                    <thead className="sticky top-0 bg-slate-100 text-left text-gray-600">
                                      <tr>
                                        <th className="px-2 py-1.5">Page</th>
                                        <th className="px-2 py-1.5">
                                          Item / extracted cells
                                        </th>
                                        <th className="px-2 py-1.5">Value</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {document.tablePages.flatMap(page =>
                                        page.rows.map((row, rowIndex) => (
                                          <tr
                                            key={`${page.pageNumber}-${rowIndex}`}
                                            className="border-t border-gray-100"
                                          >
                                            <td className="whitespace-nowrap px-2 py-1.5 text-gray-500">
                                              {page.pageNumber}
                                            </td>
                                            <td className="px-2 py-1.5 font-mono text-gray-800">
                                              {row.item ??
                                                row.cells.join('  |  ')}
                                            </td>
                                            <td className="px-2 py-1.5 font-mono text-gray-800">
                                              {row.value ?? ''}
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </details>
                            ) : (
                              <span className="text-gray-500">
                                No text rows extracted
                              </span>
                            )}
                            <span className="mt-2 block text-xs text-gray-500">
                              {document.extractionStatus.replaceAll('_', ' ')} ·{' '}
                              {document.pageCount} pages with text
                            </span>
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex flex-col items-start gap-2 text-xs">
                              <a
                                className="inline-flex items-center gap-1 font-semibold text-blue-800 underline"
                                href={document.documentUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Original document <ExternalLink size={12} />
                              </a>
                              {document.sourcePageUrl && (
                                <a
                                  className="inline-flex items-center gap-1 font-semibold text-blue-800 underline"
                                  href={document.sourcePageUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Source page <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {visibleDocuments.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-10 text-center text-gray-600"
                        >
                          No documents match those filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
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
                    {visibleRows.map(row => (
                      <tr key={row.id} className="align-top">
                        <td className="whitespace-nowrap px-3 py-4 text-gray-700">
                          {displayDate(row.publishedAt)}
                        </td>
                        <td className="max-w-xs px-3 py-4">
                          <strong className="block break-words text-slate-900">
                            {documentFilename(row)}
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
                    {visibleRows.length === 0 && (
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
            )}
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
