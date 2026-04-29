import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { useData } from "@/lib/store";
import { formatINR } from "@/lib/fx";
import { FileText, CheckCircle2, Clock, IndianRupee, ArrowUpRight, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Apoyphe" }] }),
  component: Dashboard,
});

function Dashboard() {
  const invoices = useData((s) => s.invoices);
  const loadSampleData = useData((s) => s.loadSampleData);
  const resetAll = useData((s) => s.resetAll);
  const paid = invoices.filter((i) => i.status === "paid");
  const pending = invoices.filter((i) => i.status === "pending");
  const revenue = paid.reduce((sum, i) => sum + i.total, 0);
  const outstanding = pending.reduce((sum, i) => sum + i.total, 0);

  const stats = [
    { label: "Total Invoices", value: invoices.length, icon: FileText, tint: "from-primary to-primary-glow" },
    { label: "Paid", value: paid.length, icon: CheckCircle2, tint: "from-success to-success" },
    { label: "Pending", value: pending.length, icon: Clock, tint: "from-warning to-warning" },
    { label: "Revenue", value: formatINR(revenue), icon: IndianRupee, tint: "from-primary-glow to-primary" },
  ];

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Test the app quickly with seeded sample data.</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { loadSampleData(); toast.success("Sample data loaded"); }}
            >
              <Sparkles className="h-4 w-4 mr-2" />Load sample data
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Clear company, customers and invoices?")) {
                  resetAll();
                  toast.success("Data cleared");
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />Reset
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="p-5 bg-[image:var(--gradient-card)] border-border/60 shadow-soft hover:shadow-elegant transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${s.tint} flex items-center justify-center text-white shadow-soft`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight">{s.value}</p>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Outstanding</h3>
              <Link to="/invoices"><Button variant="ghost" size="sm">View all <ArrowUpRight className="h-3 w-3 ml-1" /></Button></Link>
            </div>
            <p className="text-3xl font-bold text-warning">{formatINR(outstanding)}</p>
            <p className="text-sm text-muted-foreground mt-1">{pending.length} pending invoice{pending.length !== 1 && "s"}</p>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Recent Invoices</h3>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet. <Link to="/invoices/new" className="text-primary underline">Create one</Link>.</p>
            ) : (
              <div className="space-y-2">
                {invoices.slice(0, 5).map((i) => (
                  <div key={i.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-mono">{i.number}</span>
                    <span className="text-sm font-medium">{formatINR(i.total)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${i.status === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                      {i.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
