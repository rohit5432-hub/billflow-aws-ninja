import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/store";
import { numberToWordsINR } from "@/lib/fx";
import { SELLER, BANK, TERMS, JURISDICTION } from "@/lib/seller";
import { Download, ArrowLeft } from "lucide-react";
import logoUrl from "@/assets/apoyphe-logo.jpg";


export const Route = createFileRoute("/invoices/$id")({
  head: () => ({ meta: [{ title: "Tax Invoice — Apoyphe" }] }),
  component: InvoicePreview,
});

/** ₹ formatter without the leading symbol — for table cells. */
const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

/** Format invoice date as "07-Feb-26". */
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleString("en-US", { month: "short" });
  const yr = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${yr}`;
};

function tinyAmountInWords(n: number, currency = "INR") {
  // Re-use existing util; tweak prefix.
  const words = numberToWordsINR(Math.abs(n))
    .replace(" Rupees", " Rupee")
    .replace(" Paise", " Paisa");
  return `${currency} ${words}.`;
}

function InvoicePreview() {
  const { id } = Route.useParams();
  const invoice = useData((s) => s.invoices.find((i) => i.id === id));
  const customer = useData((s) => s.customers.find((c) => c.id === invoice?.customerId));

  if (!invoice || !customer) {
    return (
      <AppLayout title="Invoice">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Invoice or customer not found.</p>
          <Link to="/invoices">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </Card>
      </AppLayout>
    );
  }

  const subtotal = invoice.amount;
  const halfRate = invoice.gstRate / 2;
  const halfTax = invoice.gstAmount / 2;
  const isIgst = invoice.gstType === "IGST";
  const utLabel = invoice.gstType === "CGST_UTGST" ? "UTGST" : "SGST";
  const roundOff = invoice.roundOff ?? 0;
  const grandTotal = invoice.total + roundOff;
  const consigneeSame = invoice.consigneeSameAsBuyer ?? true;

  // ---------------------------- PDF generation ---------------------------- //
  const downloadPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 30; // page margin
    const innerW = W - M * 2;
    let y = M;

    // Outer border
    doc.setDrawColor(0);
    doc.setLineWidth(0.8);

    // Helper: draw text within a cell with optional alignment & bold
    const cell = (
      text: string | string[],
      x: number,
      yy: number,
      w: number,
      opts: { align?: "left" | "right" | "center"; bold?: boolean; size?: number; italic?: boolean; pad?: number } = {}
    ) => {
      const { align = "left", bold = false, size = 9, italic = false, pad = 4 } = opts;
      doc.setFont("helvetica", bold ? (italic ? "bolditalic" : "bold") : italic ? "italic" : "normal");
      doc.setFontSize(size);
      const lines = Array.isArray(text) ? text : doc.splitTextToSize(text, w - pad * 2);
      const tx = align === "right" ? x + w - pad : align === "center" ? x + w / 2 : x + pad;
      doc.text(lines, tx, yy + size, { align });
      return lines.length * (size + 2);
    };

    // ====== Title bar ======
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("TAX INVOICE", W / 2, y + 14, { align: "center" });
    y += 22;

    // ====== Header grid: Seller (left, spans 2 rows) | Invoice meta (right, 3 rows of 2) ======
    const headerLeftW = innerW * 0.55;
    const headerRightW = innerW - headerLeftW;
    const metaColW = headerRightW / 2;
    const metaRowH = 28;
    const headerH = metaRowH * 3;

    // Outer header rectangle
    doc.rect(M, y, innerW, headerH);
    // Vertical split between seller and meta
    doc.line(M + headerLeftW, y, M + headerLeftW, y + headerH);
    // Horizontal lines for meta rows
    for (let i = 1; i < 3; i++) {
      doc.line(M + headerLeftW, y + i * metaRowH, M + innerW, y + i * metaRowH);
    }
    // Vertical split inside meta
    doc.line(M + headerLeftW + metaColW, y, M + headerLeftW + metaColW, y + headerH);

    // Seller block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(SELLER.name, M + 6, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const sellerLines = [
      SELLER.address,
      `GSTIN: ${SELLER.gstin}`,
      `State Name: ${SELLER.stateName}, Code: ${SELLER.stateCode}`,
      `Email: ${SELLER.email}   Phone: ${SELLER.phone}`,
    ];
    sellerLines.forEach((l, i) => {
      const wrapped = doc.splitTextToSize(l, headerLeftW - 12);
      doc.text(wrapped, M + 6, y + 28 + i * 12);
    });

    // Meta cells
    const metaCell = (label: string, value: string, col: 0 | 1, row: 0 | 1 | 2) => {
      const cx = M + headerLeftW + col * metaColW;
      const cy = y + row * metaRowH;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(label, cx + 4, cy + 9);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(value || "—", cx + 4, cy + 22);
    };
    metaCell("Invoice No.", invoice.number, 0, 0);
    metaCell("Dated", fmtDate(invoice.invoiceDate), 1, 0);
    metaCell("Reference No. & Date", invoice.referenceNo || "—", 0, 1);
    metaCell("Mode/Terms of Payment", invoice.paymentTerms || `Due ${fmtDate(invoice.dueDate)}`, 1, 1);
    metaCell("Buyer's Order No.", invoice.buyersOrderNo || "—", 0, 2);
    metaCell("Other References", invoice.status.toUpperCase(), 1, 2);

    y += headerH;

    // ====== Buyer / Consignee ======
    const bcH = 96;
    const halfW = innerW / 2;
    doc.rect(M, y, innerW, bcH);
    doc.line(M + halfW, y, M + halfW, y + bcH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Buyer (Bill to)", M + 6, y + 10);
    doc.text("Consignee (Ship to)", M + halfW + 6, y + 10);

    const drawParty = (x: number) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(customer.name, x + 6, y + 24);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = [
        ...customer.address.split("\n"),
        customer.gstin ? `GSTIN/UIN: ${customer.gstin}` : "",
        `State Name: ${invoice.placeOfSupply || SELLER.stateName}, Code: 36`,
        `Place of Supply: ${invoice.placeOfSupply || SELLER.stateName}`,
      ].filter(Boolean);
      lines.forEach((l, i) => {
        const wrapped = doc.splitTextToSize(l, halfW - 12);
        doc.text(wrapped, x + 6, y + 38 + i * 11);
      });
    };
    drawParty(M);
    drawParty(M + halfW);
    y += bcH;

    // ====== Items table ======
    // Columns: Sl | Description | HSN | GST% | Qty | Rate | Amount
    const cols = [
      { w: 26, label: "Sl", align: "center" as const },
      { w: 0, label: "Description of Services", align: "left" as const }, // flex
      { w: 56, label: "HSN/SAC", align: "center" as const },
      { w: 46, label: "GST", align: "center" as const },
      { w: 34, label: "Qty", align: "center" as const },
      { w: 70, label: "Rate", align: "right" as const },
      { w: 80, label: "Amount", align: "right" as const },
    ];
    const fixedWidths = cols.reduce((s, c) => s + c.w, 0);
    cols[1].w = innerW - fixedWidths;

    const colX = (i: number) => M + cols.slice(0, i).reduce((s, c) => s + c.w, 0);

    // Header row
    const rowH = 18;
    doc.rect(M, y, innerW, rowH);
    cols.forEach((c, i) => {
      if (i > 0) doc.line(colX(i), y, colX(i), y + rowH);
      cell(c.label, colX(i), y + 2, c.w, { align: c.align, bold: true, size: 9 });
    });
    y += rowH;

    // Body — single Sl with sub-items
    const subItems = invoice.subItems ?? [];
    const bodyTopY = y;
    const lineH = 14;

    const bodyRows: { label: string; amount?: number; italic?: boolean; bold?: boolean }[] = [
      { label: invoice.serviceTitle || "Services rendered", bold: true, amount: subtotal },
      ...subItems.map((s) => ({ label: s.label, amount: s.amount, italic: s.italic })),
      { label: "", amount: undefined }, // spacer
    ];
    if (isIgst) {
      bodyRows.push({ label: `IGST`, italic: true, amount: invoice.gstAmount });
    } else {
      bodyRows.push({ label: `CGST`, italic: true, amount: halfTax });
      bodyRows.push({ label: utLabel, italic: true, amount: halfTax });
    }
    if (roundOff !== 0) {
      bodyRows.push({ label: "Round Off", italic: true, amount: roundOff });
    }

    const bodyH = bodyRows.length * lineH + 6;
    // Body cell
    doc.rect(M, y, innerW, bodyH);
    // verticals
    cols.forEach((_c, i) => {
      if (i > 0) doc.line(colX(i), bodyTopY, colX(i), y + bodyH);
    });

    // Sl
    cell("1", colX(0), bodyTopY + 2, cols[0].w, { align: "center" });
    // HSN, GST%, Qty (only on first row)
    cell(invoice.hsnCode || "—", colX(2), bodyTopY + 2, cols[2].w, { align: "center" });
    cell(`${invoice.gstRate} %`, colX(3), bodyTopY + 2, cols[3].w, { align: "center" });
    cell("1", colX(4), bodyTopY + 2, cols[4].w, { align: "center" });

    // Description + Rate + Amount column rows
    let ry = bodyTopY + 2;
    bodyRows.forEach((r, idx) => {
      const isFirst = idx === 0;
      cell(r.label, colX(1), ry, cols[1].w, {
        align: "left",
        bold: !!r.bold,
        italic: !!r.italic,
        size: 9,
      });
      if (r.amount !== undefined) {
        // Show "Rate" only on the first row & sub-rows (not on tax/round-off rows)
        const isTaxRow = ["CGST", "SGST", "UTGST", "IGST", "Round Off"].includes(r.label);
        if (!isTaxRow) {
          cell(fmt(r.amount), colX(5), ry, cols[5].w, { align: "right", bold: isFirst });
        }
        cell(
          r.amount < 0 ? `(-) ${fmt(Math.abs(r.amount))}` : fmt(r.amount),
          colX(6),
          ry,
          cols[6].w,
          { align: "right", bold: isFirst, italic: !!r.italic }
        );
      }
      ry += lineH;
    });
    y += bodyH;

    // Total row
    doc.rect(M, y, innerW, rowH + 4);
    cols.forEach((_c, i) => {
      if (i > 0) doc.line(colX(i), y, colX(i), y + rowH + 4);
    });
    cell("Total", colX(1), y + 2, cols[1].w, { align: "right", bold: true, size: 11 });
    cell("1 nos", colX(4), y + 2, cols[4].w, { align: "center", bold: true });
    cell(`₹ ${fmt(grandTotal)}`, colX(6), y + 2, cols[6].w, { align: "right", bold: true, size: 11 });
    y += rowH + 4;

    // ====== Amount in words ======
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Amount Chargeable Including Tax (in words)", M, y + 8);
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const amtWords = doc.splitTextToSize(tinyAmountInWords(grandTotal), innerW);
    doc.text(amtWords, M, y + 8);
    y += amtWords.length * 12 + 4;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("E. & O.E", W - M, y + 4, { align: "right" });
    y += 10;

    // ====== HSN / SAC tax summary table ======
    const tCols = isIgst
      ? [
          { w: 80, label: "HSN/SAC", align: "center" as const },
          { w: 0, label: "Taxable Value", align: "right" as const },
          { w: 60, label: "Rate", align: "center" as const },
          { w: 80, label: "IGST Amount", align: "right" as const },
          { w: 80, label: "Total Tax", align: "right" as const },
        ]
      : [
          { w: 80, label: "HSN/SAC", align: "center" as const },
          { w: 0, label: "Taxable Value", align: "right" as const },
          { w: 50, label: "C.Rate", align: "center" as const },
          { w: 70, label: "C.Amount", align: "right" as const },
          { w: 50, label: "S.Rate", align: "center" as const },
          { w: 70, label: "S.Amount", align: "right" as const },
          { w: 70, label: "Total Tax", align: "right" as const },
        ];
    const fixed = tCols.reduce((s, c) => s + c.w, 0);
    tCols[1].w = innerW - fixed;
    const tColX = (i: number) => M + tCols.slice(0, i).reduce((s, c) => s + c.w, 0);

    // header
    doc.rect(M, y, innerW, rowH);
    tCols.forEach((c, i) => {
      if (i > 0) doc.line(tColX(i), y, tColX(i), y + rowH);
      cell(c.label, tColX(i), y + 2, c.w, { align: c.align, bold: true, size: 9 });
    });
    y += rowH;

    // body row
    doc.rect(M, y, innerW, rowH);
    tCols.forEach((_c, i) => {
      if (i > 0) doc.line(tColX(i), y, tColX(i), y + rowH);
    });
    if (isIgst) {
      cell(invoice.hsnCode || "—", tColX(0), y + 2, tCols[0].w, { align: "center" });
      cell(fmt(subtotal), tColX(1), y + 2, tCols[1].w, { align: "right" });
      cell(`${invoice.gstRate}%`, tColX(2), y + 2, tCols[2].w, { align: "center" });
      cell(fmt(invoice.gstAmount), tColX(3), y + 2, tCols[3].w, { align: "right" });
      cell(fmt(invoice.gstAmount), tColX(4), y + 2, tCols[4].w, { align: "right" });
    } else {
      cell(invoice.hsnCode || "—", tColX(0), y + 2, tCols[0].w, { align: "center" });
      cell(fmt(subtotal), tColX(1), y + 2, tCols[1].w, { align: "right" });
      cell(`${halfRate}%`, tColX(2), y + 2, tCols[2].w, { align: "center" });
      cell(fmt(halfTax), tColX(3), y + 2, tCols[3].w, { align: "right" });
      cell(`${halfRate}%`, tColX(4), y + 2, tCols[4].w, { align: "center" });
      cell(fmt(halfTax), tColX(5), y + 2, tCols[5].w, { align: "right" });
      cell(fmt(invoice.gstAmount), tColX(6), y + 2, tCols[6].w, { align: "right" });
    }
    y += rowH;

    // total row
    doc.rect(M, y, innerW, rowH);
    tCols.forEach((_c, i) => {
      if (i > 0) doc.line(tColX(i), y, tColX(i), y + rowH);
    });
    cell("Total", tColX(0), y + 2, tCols[0].w, { align: "center", bold: true });
    cell(fmt(subtotal), tColX(1), y + 2, tCols[1].w, { align: "right", bold: true });
    if (isIgst) {
      cell(fmt(invoice.gstAmount), tColX(3), y + 2, tCols[3].w, { align: "right", bold: true });
      cell(fmt(invoice.gstAmount), tColX(4), y + 2, tCols[4].w, { align: "right", bold: true });
    } else {
      cell(fmt(halfTax), tColX(3), y + 2, tCols[3].w, { align: "right", bold: true });
      cell(fmt(halfTax), tColX(5), y + 2, tCols[5].w, { align: "right", bold: true });
      cell(fmt(invoice.gstAmount), tColX(6), y + 2, tCols[6].w, { align: "right", bold: true });
    }
    y += rowH + 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Tax Amount (in words):", M, y + 8);
    doc.setFont("helvetica", "bold");
    const taxWords = doc.splitTextToSize(tinyAmountInWords(invoice.gstAmount), innerW - 110);
    doc.text(taxWords, M + 110, y + 8);
    y += taxWords.length * 11 + 10;

    // ====== Bank details ======
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Company's Bank Details:", M, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const bankLines = [
      `A/c Holder's Name : ${BANK.accountName}`,
      `Bank Name        : ${BANK.bankName}`,
      `A/c No.          : ${BANK.accountNo}`,
      `Branch & IFS Code: ${BANK.branchAndIfsc}`,
    ];
    bankLines.forEach((l, i) => doc.text(l, M, y + 22 + i * 11));
    y += 22 + bankLines.length * 11 + 6;

    // ====== Terms + Signatory ======
    const termsH = 90;
    doc.rect(M, y, innerW, termsH);
    doc.line(M + halfW, y, M + halfW, y + termsH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Terms and Conditions:", M + 6, y + 12);
    doc.text(`for ${SELLER.name}`, M + halfW + 6, y + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    TERMS.forEach((t, i) => {
      const wrapped = doc.splitTextToSize(`${i + 1}. ${t}`, halfW - 12);
      doc.text(wrapped, M + 6, y + 26 + i * 16);
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(SIGNATORY, M + halfW + 6, y + termsH - 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Authorised Signatory", M + halfW + 6, y + termsH - 8);
    y += termsH + 4;

    // ====== Footer ======
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(JURISDICTION, W / 2, y + 10, { align: "center" });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("This is a Computer Generated Invoice", W / 2, H - 18, { align: "center" });

    doc.save(`${invoice.number}.pdf`);
  };

  // -------------------------- On-screen preview --------------------------- //
  return (
    <AppLayout title={`Invoice ${invoice.number}`}>
      <div className="flex items-center justify-between mb-4">
        <Link to="/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <Button
          onClick={downloadPDF}
          className="bg-gradient-to-r from-primary to-primary-glow"
        >
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>

      <Card className="p-6 max-w-4xl mx-auto shadow-elegant border-2 border-foreground/80 text-foreground bg-background text-[12px] leading-snug">
        <h2 className="text-center text-xl font-bold tracking-wide mb-3">TAX INVOICE</h2>

        {/* Header grid */}
        <div className="grid grid-cols-[1.2fr_1fr] border border-foreground/80">
          <div className="p-2 border-r border-foreground/80">
            <p className="font-bold text-[13px]">{SELLER.name}</p>
            <p className="whitespace-pre-line">{SELLER.address}</p>
            <p>GSTIN: {SELLER.gstin}</p>
            <p>State Name: {SELLER.stateName}, Code: {SELLER.stateCode}</p>
            <p>Email: {SELLER.email}</p>
            <p>Phone: {SELLER.phone}</p>
          </div>
          <div className="grid grid-cols-2 grid-rows-3">
            {[
              ["Invoice No.", invoice.number],
              ["Dated", fmtDate(invoice.invoiceDate)],
              ["Reference No. & Date", invoice.referenceNo || "—"],
              ["Mode/Terms of Payment", invoice.paymentTerms || `Due ${fmtDate(invoice.dueDate)}`],
              ["Buyer's Order No.", invoice.buyersOrderNo || "—"],
              ["Other References", invoice.status.toUpperCase()],
            ].map(([label, value], i) => (
              <div
                key={i}
                className="p-2 border-l border-b border-foreground/80 first:border-l-0 [&:nth-child(2)]:border-l [&:nth-child(5)]:border-b-0 [&:nth-child(6)]:border-b-0"
              >
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Buyer / Consignee */}
        <div className="grid grid-cols-2 border-x border-b border-foreground/80">
          {["Buyer (Bill to)", "Consignee (Ship to)"].map((title, idx) => (
            <div key={idx} className={`p-2 ${idx === 0 ? "border-r border-foreground/80" : ""}`}>
              <p className="text-[10px] text-muted-foreground">{title}</p>
              <p className="font-bold">{customer.name}</p>
              <p className="whitespace-pre-line">{customer.address}</p>
              {customer.gstin && <p>GSTIN/UIN: {customer.gstin}</p>}
              <p>State Name: {invoice.placeOfSupply || SELLER.stateName}, Code: 36</p>
              <p>Place of Supply: {invoice.placeOfSupply || SELLER.stateName}</p>
              {!consigneeSame && idx === 1 && (
                <p className="italic text-muted-foreground mt-1">(Same as buyer)</p>
              )}
            </div>
          ))}
        </div>

        {/* Items table */}
        <table className="w-full border-x border-b border-foreground/80 border-collapse">
          <thead>
            <tr className="border-b border-foreground/80 bg-muted/30 text-[11px]">
              <th className="border-r border-foreground/80 px-1 py-1 w-8">Sl</th>
              <th className="border-r border-foreground/80 px-2 py-1 text-left">Description of Services</th>
              <th className="border-r border-foreground/80 px-1 py-1 w-16">HSN/SAC</th>
              <th className="border-r border-foreground/80 px-1 py-1 w-12">GST</th>
              <th className="border-r border-foreground/80 px-1 py-1 w-10">Qty</th>
              <th className="border-r border-foreground/80 px-2 py-1 w-20 text-right">Rate</th>
              <th className="px-2 py-1 w-24 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td rowSpan={6 + (invoice.subItems?.length ?? 0) + (roundOff ? 1 : 0)} className="border-r border-foreground/80 text-center align-top py-1">1</td>
              <td className="px-2 py-1 font-bold">{invoice.serviceTitle || "Services rendered"}</td>
              <td rowSpan={6 + (invoice.subItems?.length ?? 0) + (roundOff ? 1 : 0)} className="border-l border-r border-foreground/80 text-center align-top py-1">{invoice.hsnCode || "—"}</td>
              <td rowSpan={6 + (invoice.subItems?.length ?? 0) + (roundOff ? 1 : 0)} className="border-r border-foreground/80 text-center align-top py-1">{invoice.gstRate}%</td>
              <td rowSpan={6 + (invoice.subItems?.length ?? 0) + (roundOff ? 1 : 0)} className="border-r border-foreground/80 text-center align-top py-1">1</td>
              <td className="px-2 py-1 text-right font-bold">{fmt(subtotal)}</td>
              <td className="px-2 py-1 text-right font-bold">{fmt(subtotal)}</td>
            </tr>
            {(invoice.subItems ?? []).map((s, i) => (
              <tr key={i}>
                <td className={`px-2 py-0.5 ${s.italic ? "italic" : ""}`}>{s.label}</td>
                <td className="px-2 py-0.5 text-right">{fmt(s.amount)}</td>
                <td className="px-2 py-0.5 text-right">{fmt(s.amount)}</td>
              </tr>
            ))}
            <tr><td colSpan={3} className="py-1"></td></tr>
            {isIgst ? (
              <tr>
                <td className="px-2 py-0.5 text-right italic" colSpan={2}>IGST</td>
                <td className="px-2 py-0.5 text-right">{fmt(invoice.gstAmount)}</td>
              </tr>
            ) : (
              <>
                <tr>
                  <td className="px-2 py-0.5 text-right italic" colSpan={2}>CGST</td>
                  <td className="px-2 py-0.5 text-right">{fmt(halfTax)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-0.5 text-right italic" colSpan={2}>{utLabel}</td>
                  <td className="px-2 py-0.5 text-right">{fmt(halfTax)}</td>
                </tr>
              </>
            )}
            {roundOff !== 0 && (
              <tr>
                <td className="px-2 py-0.5 text-right italic" colSpan={2}>Round Off</td>
                <td className="px-2 py-0.5 text-right">{roundOff < 0 ? `(-) ${fmt(Math.abs(roundOff))}` : fmt(roundOff)}</td>
              </tr>
            )}
            <tr className="border-t border-foreground/80 font-bold">
              <td className="px-2 py-1 text-right">Total</td>
              <td className="border-l border-foreground/80 text-center py-1" colSpan={2}>1 nos</td>
              <td className="px-2 py-1 text-right">₹ {fmt(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        {/* Amount in words */}
        <div className="border-x border-b border-foreground/80 p-2">
          <p className="text-[11px]">Amount Chargeable Including Tax (in words)</p>
          <p className="font-bold">{tinyAmountInWords(grandTotal)}</p>
          <p className="text-right italic text-[10px] text-muted-foreground">E. &amp; O.E</p>
        </div>

        {/* HSN tax summary */}
        <table className="w-full border-x border-b border-foreground/80 border-collapse text-[11px]">
          <thead>
            <tr className="bg-muted/30">
              <th className="border border-foreground/80 px-1 py-1" rowSpan={2}>HSN/SAC</th>
              <th className="border border-foreground/80 px-1 py-1" rowSpan={2}>Taxable Value</th>
              {isIgst ? (
                <>
                  <th className="border border-foreground/80 px-1 py-1" colSpan={2}>Integrated Tax</th>
                  <th className="border border-foreground/80 px-1 py-1" rowSpan={2}>Total Tax</th>
                </>
              ) : (
                <>
                  <th className="border border-foreground/80 px-1 py-1" colSpan={2}>Central Tax</th>
                  <th className="border border-foreground/80 px-1 py-1" colSpan={2}>State Tax</th>
                  <th className="border border-foreground/80 px-1 py-1" rowSpan={2}>Total Tax</th>
                </>
              )}
            </tr>
            <tr>
              <th className="border border-foreground/80 px-1 py-1">Rate</th>
              <th className="border border-foreground/80 px-1 py-1">Amount</th>
              {!isIgst && (
                <>
                  <th className="border border-foreground/80 px-1 py-1">Rate</th>
                  <th className="border border-foreground/80 px-1 py-1">Amount</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-foreground/80 text-center px-1 py-1">{invoice.hsnCode || "—"}</td>
              <td className="border border-foreground/80 text-right px-1 py-1">{fmt(subtotal)}</td>
              <td className="border border-foreground/80 text-center px-1 py-1">{isIgst ? invoice.gstRate : halfRate}%</td>
              <td className="border border-foreground/80 text-right px-1 py-1">{fmt(isIgst ? invoice.gstAmount : halfTax)}</td>
              {!isIgst && (
                <>
                  <td className="border border-foreground/80 text-center px-1 py-1">{halfRate}%</td>
                  <td className="border border-foreground/80 text-right px-1 py-1">{fmt(halfTax)}</td>
                </>
              )}
              <td className="border border-foreground/80 text-right px-1 py-1">{fmt(invoice.gstAmount)}</td>
            </tr>
            <tr className="font-bold">
              <td className="border border-foreground/80 text-center px-1 py-1">Total</td>
              <td className="border border-foreground/80 text-right px-1 py-1">{fmt(subtotal)}</td>
              <td className="border border-foreground/80 px-1 py-1"></td>
              <td className="border border-foreground/80 text-right px-1 py-1">{fmt(isIgst ? invoice.gstAmount : halfTax)}</td>
              {!isIgst && (
                <>
                  <td className="border border-foreground/80 px-1 py-1"></td>
                  <td className="border border-foreground/80 text-right px-1 py-1">{fmt(halfTax)}</td>
                </>
              )}
              <td className="border border-foreground/80 text-right px-1 py-1">{fmt(invoice.gstAmount)}</td>
            </tr>
          </tbody>
        </table>

        <p className="px-1 py-2 text-[11px]">
          Tax Amount (in words): <span className="font-bold">{tinyAmountInWords(invoice.gstAmount)}</span>
        </p>

        {/* Bank */}
        <div className="border border-foreground/80 p-2 mt-1 text-[11px]">
          <p className="font-bold">Company's Bank Details:</p>
          <p>A/c Holder's Name : {BANK.accountName}</p>
          <p>Bank Name : {BANK.bankName}</p>
          <p>A/c No. : {BANK.accountNo}</p>
          <p>Branch &amp; IFS Code : {BANK.branchAndIfsc}</p>
        </div>

        {/* Terms + Signatory */}
        <div className="grid grid-cols-2 border-x border-b border-foreground/80 text-[11px]">
          <div className="p-2 border-r border-foreground/80">
            <p className="font-bold">Terms and Conditions:</p>
            <ol className="list-decimal pl-4 space-y-0.5 mt-1">
              {TERMS.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
          </div>
          <div className="p-2 flex flex-col justify-between">
            <p className="font-bold text-right">for {SELLER.name}</p>
            <div className="text-right mt-8">
              <p className="font-bold">{SIGNATORY}</p>
              <p>Authorised Signatory</p>
            </div>
          </div>
        </div>

        <p className="text-center font-bold mt-2">{JURISDICTION}</p>
        <p className="text-center italic text-[10px] text-muted-foreground">This is a Computer Generated Invoice</p>
      </Card>
    </AppLayout>
  );
}
