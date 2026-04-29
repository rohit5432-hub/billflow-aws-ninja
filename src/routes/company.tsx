import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/store";
import { toast } from "sonner";
import { Save } from "lucide-react";

export const Route = createFileRoute("/company")({
  head: () => ({ meta: [{ title: "Company — Apoyphe" }] }),
  component: CompanyPage,
});

function CompanyPage() {
  const company = useData((s) => s.company);
  const setCompany = useData((s) => s.setCompany);
  const defaults = {
    name: "Apoyphe Software Services Private Limited",
    email: "",
    phone: "+91 99489 03222",
    gstin: "36ABCDE1234F1Z5",
    address: "4th Floor, Ayyappa Society, 467, Gouri Shankara Nilayam,\nMadhapur, Telangana 500081",
  };
  const [form, setForm] = useState(defaults);

  useEffect(() => { if (company) setForm(company); }, [company]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setCompany(form);
    toast.success("Company details saved");
  };

  return (
    <AppLayout title="Company Details">
      <Card className="p-6 max-w-2xl">
        <p className="text-sm text-muted-foreground mb-6">Saved once, used on every invoice.</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label>Company Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
          </div>
          <div className="space-y-2"><Label>GSTIN</Label><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} maxLength={15} /></div>
          <div className="space-y-2"><Label>Address</Label><Textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <Button type="submit" className="bg-gradient-to-r from-primary to-primary-glow"><Save className="h-4 w-4 mr-2" />Save Company</Button>
        </form>
      </Card>
    </AppLayout>
  );
}
