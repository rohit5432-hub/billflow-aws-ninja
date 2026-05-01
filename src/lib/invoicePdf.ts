import type { jsPDF as JsPDFType } from "jspdf";
import { numberToWordsINR } from "@/lib/fx";
import { SELLER, BANK, TERMS, JURISDICTION } from "@/lib/seller";
import logoUrl from "@/assets/apoyphe-logo-black.png";

type Invoice = {
  id: string;
  number: string;
  invoiceDate: string;
  dueDate: string;
  referenceNo?: string;
  paymentTerms?: string;
  buyersOrderNo?: string;
  status: string;
  amount: number;
  gstRate: number;
  gstAmount: number;
  gstType: "IGST" | "CGST_SGST" | "CGST_UTGST";
  total: number;
  roundOff?: number;
  serviceTitle?: string;
  hsnCode?: string;
  placeOfSupply?: string;
  consigneeSameAsBuyer?: boolean;
  subItems?: { label: string; amount: number; italic?: boolean }[];
};

type Customer = {
  name: string;
  address: string;
  gstin?: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleString("en-US", { month: "short" });
  const yr = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${yr}`;
};

const amountInWords = (n: number, currency = "INR") => {
  const words = numberToWordsINR(Math.abs(n))
    .replace(" Rupees", " Rupee")
    .replace(" Paise", " Paisa");
  return `${currency} ${words}.`;
};

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Wrap text by width, returns the height consumed. */
function drawWrapped(
  doc: JsPDFType,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH = 11,
) {
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, x, y);
  return lines.length * lineH;
}

export async function generateInvoicePDF(invoice: Invoice, customer: Customer) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

  const pageW = doc.internal.pageSize.getWidth();
  const M = 28; // margin
  const innerW = pageW - M * 2;

  const isIgst = invoice.gstType === "IGST";
  const utLabel = invoice.gstType === "CGST_UTGST" ? "UTGST" : "SGST";
  const subtotal = invoice.amount;
  const halfRate = invoice.gstRate / 2;
  const halfTax = invoice.gstAmount / 2;
  const roundOff = invoice.roundOff ?? 0;
  const grandTotal = invoice.total + roundOff;

  let y = M;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("TAX INVOICE", pageW / 2, y + 16, { align: "center" });
  y += 28;

  // ===== Header box: seller (left) | invoice meta (right) =====
  const headerH = 110;
  const leftW = innerW * 0.55;
  const rightW = innerW - leftW;
  doc.setLineWidth(0.8);
  doc.rect(M, y, innerW, headerH);
  doc.line(M + leftW, y, M + leftW, y + headerH);

  // Logo + seller
  const logoData = await loadLogoDataUrl();
  let sellerX = M + 8;
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", M + 6, y + 8, 38, 38);
      sellerX = M + 52;
    } catch {
      // ignore logo failure
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(SELLER.name, sellerX, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let sy = y + 32;
  sy += drawWrapped(doc, SELLER.address, sellerX, sy, leftW - (sellerX - M) - 8, 11);
  doc.text(`GSTIN: ${SELLER.gstin}`, sellerX, sy + 2);
  doc.text(
    `State Name: ${SELLER.stateName}, Code: ${SELLER.stateCode}`,
    sellerX,
    sy + 14,
  );

  // Right meta grid: 3 rows x 2 cols
  const metaCols = 2;
  const metaRows = 3;
  const cellW = rightW / metaCols;
  const cellH = headerH / metaRows;
  const meta: [string, string][] = [
    ["Invoice No.", invoice.number],
    ["Dated", fmtDate(invoice.invoiceDate)],
    ["Reference No. & Date", invoice.referenceNo || "—"],
    [
      "Mode/Terms of Payment",
      invoice.paymentTerms || `Due ${fmtDate(invoice.dueDate)}`,
    ],
    ["Buyer's Order No.", invoice.buyersOrderNo || "—"],
    ["Other References", invoice.status.toUpperCase()],
  ];
  meta.forEach((cell, i) => {
    const col = i % metaCols;
    const row = Math.floor(i / metaCols);
    const cx = M + leftW + col * cellW;
    const cy = y + row * cellH;
    if (col > 0) doc.line(cx, cy, cx, cy + cellH);
    if (row > 0) doc.line(cx, cy, cx + cellW, cy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(cell[0], cx + 4, cy + 11);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(String(cell[1]), cx + 4, cy + 24);
  });
  y += headerH;

  // ===== Buyer / Consignee =====
  const partyH = 92;
  doc.rect(M, y, innerW, partyH);
  doc.line(M + innerW / 2, y, M + innerW / 2, y + partyH);
  ["Buyer (Bill to)", "Consignee (Ship to)"].forEach((title, idx) => {
    const cx = M + (idx === 0 ? 0 : innerW / 2) + 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(title, cx, y + 12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(customer.name, cx, y + 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    let py = y + 38;
    py += drawWrapped(doc, customer.address, cx, py, innerW / 2 - 12, 11);
    if (customer.gstin) {
      doc.text(`GSTIN/UIN: ${customer.gstin}`, cx, py);
      py += 11;
    }
    doc.text(
      `State Name: ${invoice.placeOfSupply || SELLER.stateName}, Code: 36`,
      cx,
      py,
    );
    doc.text(
      `Place of Supply: ${invoice.placeOfSupply || SELLER.stateName}`,
      cx,
      py + 11,
    );
  });
  y += partyH;

  // ===== Items table =====
  // Columns: Sl, Description, HSN, GST, Qty, Rate, Amount
  const cols = [22, 0, 50, 38, 32, 70, 80]; // 0 = flex
  const flexW = innerW - cols.reduce((a, b) => a + b, 0);
  cols[1] = flexW;
  const colX: number[] = [];
  let cx = M;
  cols.forEach((w) => {
    colX.push(cx);
    cx += w;
  });

  const headerRowH = 18;
  doc.rect(M, y, innerW, headerRowH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const headers = ["Sl", "Description of Services", "HSN/SAC", "GST", "Qty", "Rate", "Amount"];
  headers.forEach((h, i) => {
    if (i > 0) doc.line(colX[i], y, colX[i], y + headerRowH);
    const align = i === 1 ? "left" : i >= 5 ? "right" : "center";
    const tx =
      align === "left"
        ? colX[i] + 4
        : align === "right"
          ? colX[i] + cols[i] - 4
          : colX[i] + cols[i] / 2;
    doc.text(h, tx, y + 12, { align });
  });
  y += headerRowH;

  // Body rows
  const bodyStartY = y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  // Row 1: title + amount
  const rowH = 14;
  doc.setFont("helvetica", "bold");
  doc.text(invoice.serviceTitle || "Services rendered", colX[1] + 4, y + 11);
  doc.text(fmt(subtotal), colX[5] + cols[5] - 4, y + 11, { align: "right" });
  doc.text(fmt(subtotal), colX[6] + cols[6] - 4, y + 11, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += rowH;

  // Sub-items
  (invoice.subItems ?? []).forEach((s) => {
    if (s.italic) doc.setFont("helvetica", "italic");
    doc.text(s.label, colX[1] + 4, y + 11);
    doc.setFont("helvetica", "normal");
    doc.text(fmt(s.amount), colX[5] + cols[5] - 4, y + 11, { align: "right" });
    doc.text(fmt(s.amount), colX[6] + cols[6] - 4, y + 11, { align: "right" });
    y += rowH;
  });

  y += 6; // spacer

  // Tax rows
  const taxRow = (label: string, amt: number) => {
    doc.setFont("helvetica", "italic");
    doc.text(label, colX[5] + cols[5] - 4, y + 11, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(fmt(amt), colX[6] + cols[6] - 4, y + 11, { align: "right" });
    y += rowH;
  };
  if (isIgst) {
    taxRow("IGST", invoice.gstAmount);
  } else {
    taxRow("CGST", halfTax);
    taxRow(utLabel, halfTax);
  }
  if (roundOff !== 0) {
    taxRow("Round Off", roundOff);
  }

  // Fixed-column borders for full body
  const bodyEndY = y;
  doc.line(M, bodyStartY, M + innerW, bodyStartY); // top already there
  for (let i = 1; i < cols.length; i++) {
    doc.line(colX[i], bodyStartY, colX[i], bodyEndY);
  }
  doc.rect(M, bodyStartY, innerW, bodyEndY - bodyStartY);

  // Sl number centered in column
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("1", colX[0] + cols[0] / 2, bodyStartY + 11, { align: "center" });
  doc.text(invoice.hsnCode || "—", colX[2] + cols[2] / 2, bodyStartY + 11, {
    align: "center",
  });
  doc.text(`${invoice.gstRate}%`, colX[3] + cols[3] / 2, bodyStartY + 11, {
    align: "center",
  });
  doc.text("1", colX[4] + cols[4] / 2, bodyStartY + 11, { align: "center" });

  // Total row
  const totalH = 18;
  doc.rect(M, y, innerW, totalH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Total", colX[1] + cols[1] - 4, y + 12, { align: "right" });
  doc.text("1 nos", colX[4] + cols[4] / 2, y + 12, { align: "center" });
  doc.text(`Rs ${fmt(grandTotal)}`, colX[6] + cols[6] - 4, y + 12, { align: "right" });
  y += totalH;

  // Amount in words box
  const wordsH = 36;
  doc.rect(M, y, innerW, wordsH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Amount Chargeable Including Tax (in words)", M + 6, y + 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  drawWrapped(doc, amountInWords(grandTotal), M + 6, y + 26, innerW - 12, 11);
  y += wordsH;

  // Tax-amount-in-words
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 4;
  doc.text("Tax Amount (in words):", M, y + 10);
  doc.setFont("helvetica", "bold");
  doc.text(amountInWords(invoice.gstAmount), M + 110, y + 10);
  y += 18;

  // Bank box
  const bankH = 70;
  doc.rect(M, y, innerW, bankH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Company's Bank Details:", M + 6, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`A/c Holder's Name : ${BANK.accountName}`, M + 6, y + 27);
  doc.text(`Bank Name : ${BANK.bankName}`, M + 6, y + 39);
  doc.text(`A/c No. : ${BANK.accountNo}`, M + 6, y + 51);
  doc.text(`Branch & IFS Code : ${BANK.branchAndIfsc}`, M + 6, y + 63);
  y += bankH;

  // Terms + signatory
  const termsH = Math.max(80, 14 + TERMS.length * 12);
  doc.rect(M, y, innerW, termsH);
  doc.line(M + innerW / 2, y, M + innerW / 2, y + termsH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Terms and Conditions:", M + 6, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  TERMS.forEach((t, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${t}`, innerW / 2 - 12);
    doc.text(lines, M + 6, y + 27 + i * 12);
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(`for ${SELLER.name}`, M + innerW - 6, y + 14, { align: "right" });
  y += termsH;

  // Footer
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(JURISDICTION, pageW / 2, y, { align: "center" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text("This is a Computer Generated Invoice", pageW / 2, y + 12, { align: "center" });
  doc.setTextColor(0);

  doc.save(`${invoice.number}.pdf`);
}
