import Shell from "@/components/Shell";
import PwaSetup from "@/components/PwaSetup";
import InstallCoach from "@/components/InstallCoach";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <PwaSetup />
      <InstallCoach />
      {children}
    </Shell>
  );
}
