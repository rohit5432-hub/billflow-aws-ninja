import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/store";
import { formatINR, numberToWordsINR } from "@/lib/fx";
import { Download, ArrowLeft } from "lucide-react";
import jsPDF from "jspdf";

export const Route = createFileRoute("/invoices/$id")({
  head: () => ({ meta: [{ title: "Invoice Preview — Billwise" }] }),
  component: InvoicePreview,
});

function InvoicePreview() {
  const { id } = Route.useParams();
  const invoice = useData((s) => s.invoices.find((i) => i.id === id));
  const customer = useData((s) => s.customers.find((c) => c.id === invoice?.customerId));
  const company = useData((s) => s.company);

  if (!invoice || !company || !customer) {
    return (
      <AppLayout title="Invoice">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Invoice, company or customer not found.</p>
          <Link to="/invoices"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        </Card>
      </AppLayout>
    );
  }

  const downloadPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 50;

    doc.setFillColor(82, 80, 200);
    doc.rect(0, 0, W, 8, "F");

    doc.setFont("helvetica", "bold"); doc.setFontSize(24);
    doc.text("INVOICE", 40, y);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`#${invoice.number}`, 40, y + 18);

    doc.setFontSize(10); doc.setTextColor(80);
    doc.text(`Date: ${invoice.invoiceDate}`, W - 40, y, { align: "right" });
    doc.text(`Due: ${invoice.dueDate}`, W - 40, y + 14, { align: "right" });
    doc.text(`Status: ${invoice.status.toUpperCase()}`, W - 40, y + 28, { align: "right" });

    y += 60;
    doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("FROM", 40, y);
    doc.text("BILL TO", W / 2 + 20, y);
    y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const fromLines = [company.name, company.address, `Email: ${company.email}`, `Phone: ${company.phone}`, `GSTIN: ${company.gstin}`];
    const toLines = [customer.name, customer.address, customer.email && `Email: ${customer.email}`, customer.gstin && `GSTIN: ${customer.gstin}`].filter(Boolean) as string[];
    fromLines.forEach((l, i) => doc.text(String(l), 40, y + i * 14));
    toLines.forEach((l, i) => doc.text(String(l), W / 2 + 20, y + i * 14));

    y += Math.max(fromLines.length, toLines.length) * 14 + 30;

    doc.setFillColor(245, 245, 250); doc.rect(40, y, W - 80, 24, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Description", 50, y + 16);
    doc.text("Amount", W - 50, y + 16, { align: "right" });
    y += 36;

    doc.setFont("helvetica", "normal");
    const desc = invoice.currency === "USD"
      ? `Services rendered (${invoice.currency} ${invoice.originalAmount.toFixed(2)} @ ₹${invoice.fxRate.toFixed(2)})`
      : "Services rendered";
    doc.text(desc, 50, y);
    doc.text(formatINR(invoice.amount), W - 50, y, { align: "right" });
    y += 30;

    doc.line(40, y, W - 40, y); y += 18;
    const row = (label: string, val: string, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(bold ? 12 : 10);
      doc.text(label, W - 200, y);
      doc.text(val, W - 50, y, { align: "right" });
      y += bold ? 22 : 16;
    };
    row("Subtotal", formatINR(invoice.amount));
    row(`GST (${invoice.gstRate}%)`, formatINR(invoice.gstAmount));
    doc.line(W - 200, y - 8, W - 40, y - 8);
    row("Total", formatINR(invoice.total), true);

    y += 10;
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(80);
    const words = doc.splitTextToSize(`Amount in words: ${numberToWordsINR(invoice.total)}`, W - 80);
    doc.text(words, 40, y);

    doc.setFontSize(8); doc.setTextColor(120);
    doc.text("Thank you for your business.", W / 2, doc.internal.pageSize.getHeight() - 30, { align: "center" });

    doc.save(`${invoice.number}.pdf`);
  };

  return (
    <AppLayout title={`Invoice ${invoice.number}`}>
      <div className="flex items-center justify-between mb-4">
        <Link to="/invoices"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <Button onClick={downloadPDF} className="bg-gradient-to-r from-primary to-primary-glow"><Download className="h-4 w-4 mr-2" />Download PDF</Button>
      </div>

      <Card className="p-10 max-w-4xl mx-auto shadow-elegant">
        <div className="flex justify-between items-start pb-6 border-b">
          <div>
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">INVOICE</h2>
            <p className="text-sm font-mono text-muted-foreground mt-1">#{invoice.number}</p>
          </div>
          <div className="text-right text-sm space-y-1">
            <p><span className="text-muted-foreground">Date:</span> <span className="font-medium">{invoice.invoiceDate}</span></p>
            <p><span className="text-muted-foreground">Due:</span> <span className="font-medium">{invoice.dueDate}</span></p>
            <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${invoice.status === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>{invoice.status.toUpperCase()}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 py-6 border-b">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">From</p>
            <p className="font-semibold">{company.name}</p>
            <p className="text-sm whitespace-pre-line text-muted-foreground">{company.address}</p>
            <p className="text-sm text-muted-foreground mt-1">{company.email} · {company.phone}</p>
            {company.gstin && <p className="text-sm font-mono mt-1">GSTIN: {company.gstin}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Bill To</p>
            <p className="font-semibold">{customer.name}</p>
            <p className="text-sm whitespace-pre-line text-muted-foreground">{customer.address}</p>
            {customer.email && <p className="text-sm text-muted-foreground mt-1">{customer.email}</p>}
            {customer.gstin && <p className="text-sm font-mono mt-1">GSTIN: {customer.gstin}</p>}
          </div>
        </div>

        <table className="w-full my-6">
          <thead><tr className="border-b text-left text-sm">
            <th className="py-2">Description</th><th className="py-2 text-right">Amount</th>
          </tr></thead>
          <tbody>
            <tr className="border-b">
              <td className="py-3">
                Services rendered
                {invoice.currency === "USD" && <p className="text-xs text-muted-foreground">${invoice.originalAmount.toFixed(2)} @ ₹{invoice.fxRate.toFixed(2)}/USD</p>}
              </td>
              <td className="py-3 text-right font-medium">{formatINR(invoice.amount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(invoice.amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GST ({invoice.gstRate}%)</span><span>{formatINR(invoice.gstAmount)}</span></div>
            <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="text-primary">{formatINR(invoice.total)}</span></div>
          </div>
        </div>

        <p className="text-xs italic text-muted-foreground mt-8 pt-4 border-t">
          Amount in words: {numberToWordsINR(invoice.total)}
        </p>
      </Card>
    </AppLayout>
  );
}
