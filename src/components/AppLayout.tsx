import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth, useHydrated } from "@/lib/store";

export function AppLayout({ children, title }: { children: ReactNode; title: string }) {
  const loggedIn = useAuth((s) => s.loggedIn);
  const hydrated = useHydrated();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && !loggedIn) navigate({ to: "/" });
  }, [hydrated, loggedIn, navigate]);

  // While persisted auth is rehydrating, render the shell (avoids redirect flash).
  if (hydrated && !loggedIn) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center gap-3 border-b bg-card/50 backdrop-blur px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <h1 className="text-base font-semibold">{title}</h1>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
