import type { ReactNode } from 'react';

export default function AnalysisDisclaimer({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <aside
      role="note"
      aria-label="Research analysis disclaimer"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
    >
      <strong className="font-bold">Research disclaimer.</strong> {children}
    </aside>
  );
}
