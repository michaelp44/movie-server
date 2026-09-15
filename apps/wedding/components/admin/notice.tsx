export function AdminNotice({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <div role="status" className="mb-6 rounded-2xl border border-[#b08a50]/30 bg-[#fffaf0] px-4 py-3 text-sm">
      {children}
    </div>
  );
}
