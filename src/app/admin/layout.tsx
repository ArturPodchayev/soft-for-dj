export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full flex-1 flex-col bg-brand-bg">{children}</div>;
}
