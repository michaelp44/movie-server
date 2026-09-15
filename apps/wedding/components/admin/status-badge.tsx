const labels: Record<string, string> = {
  pending: "ממתינים",
  confirmed: "אישרו",
  declined: "לא מגיעים",
  maybe: "אולי",
  completed: "הושלם",
  completed_with_errors: "הושלם עם שגיאות",
  failed: "נכשל",
  running: "בתהליך",
};

export function StatusBadge({ status }: { status: string }) {
  const color =
    status === "confirmed" || status === "completed"
      ? "bg-emerald-100 text-emerald-800"
      : status === "declined" || status === "failed"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-900";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{labels[status] ?? status}</span>;
}
