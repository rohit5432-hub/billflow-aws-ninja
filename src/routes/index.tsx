import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth, useHydrated } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Login — Apoyphe Invoice Suite" },
      { name: "description", content: "Sign in to manage invoices, customers and revenue." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [u, setU] = useState("admin");
  const [p, setP] = useState("admin123");
  const login = useAuth((s) => s.login);
  const loggedIn = useAuth((s) => s.loggedIn);
  const hydrated = useHydrated();
  const navigate = useNavigate();

  useEffect(() => { if (hydrated && loggedIn) navigate({ to: "/dashboard" }); }, [hydrated, loggedIn, navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(u, p)) {
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
    } else {
      toast.error("Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,oklch(0.94_0.05_265),transparent_50%),radial-gradient(ellipse_at_bottom,oklch(0.95_0.04_290),transparent_50%)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="Apoyphe logo" className="mx-auto mb-4 h-14 w-14 object-contain" />
          <h1 className="text-3xl font-bold tracking-tight">Apoyphe</h1>
          <p className="text-sm text-muted-foreground mt-1">Invoice billing, beautifully simple</p>
        </div>

        <Card className="p-6 shadow-elegant border-border/50">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="u">Username</Label>
              <Input id="u" value={u} onChange={(e) => setU(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p">Password</Label>
              <Input id="p" type="password" value={p} onChange={(e) => setP(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary-glow hover:opacity-90">
              <Lock className="h-4 w-4 mr-2" /> Sign in
            </Button>
            <p className="text-xs text-muted-foreground text-center pt-2">
              Demo credentials: <span className="font-mono">admin / admin123</span>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
