import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useData } from "@/lib/store";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

export const Route = createFileRoute("/customers")({
  head: () => ({ meta: [{ title: "Customers — Billwise" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const customers = useData((s) => s.customers);
  const addCustomer = useData((s) => s.addCustomer);
  const [form, setForm] = useState({ name: "", gstin: "", email: "", address: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    addCustomer(form);
    setForm({ name: "", gstin: "", email: "", address: "" });
    toast.success("Customer added");
  };

  return (
    <AppLayout title="Customers">
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Add Customer</h3>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>GSTIN</Label><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} maxLength={15} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Address</Label><Textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary-glow"><UserPlus className="h-4 w-4 mr-2" />Add</Button>
          </form>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">All Customers ({customers.length})</h3>
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customers yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>GSTIN</TableHead><TableHead>Email</TableHead><TableHead>Address</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.gstin || "—"}</TableCell>
                    <TableCell>{c.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.address || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
