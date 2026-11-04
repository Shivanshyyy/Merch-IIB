import { DesignerNav } from "@/components/designer/DesignerNav";

export default function DesignerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page">
      <div className="shell">
        <DesignerNav />
        {children}
      </div>
    </div>
  );
}
