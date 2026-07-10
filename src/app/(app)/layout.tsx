import Shell from "@/components/Shell";
import PwaSetup from "@/components/PwaSetup";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <PwaSetup />
      {children}
    </Shell>
  );
}
