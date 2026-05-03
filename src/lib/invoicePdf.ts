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

  // Logo + seller — preserve aspect ratio
  const logoData = await loadLogoDataUrl();
  let sellerX = M + 8;
  if (logoData) {
    try {
      const props = doc.getImageProperties(logoData);
      const maxH = 40;
      const maxW = 60;
      const ratio = props.width / props.height;
      let lw = maxH * ratio;
      let lh = maxH;
      if (lw > maxW) {
        lw = maxW;
        lh = maxW / ratio;
      }
      doc.addImage(logoData, "PNG", M + 6, y + 8, lw, lh);
      sellerX = M + 6 + lw + 8;
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
  const labelBandH = 13;
  meta.forEach((cell, i) => {
    const col = i % metaCols;
    const row = Math.floor(i / metaCols);
    const cx = M + leftW + col * cellW;
    const cy = y + row * cellH;
    if (col > 0) doc.line(cx, cy, cx, cy + cellH);
    if (row > 0) doc.line(cx, cy, cx + cellW, cy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.setTextColor(40);
    doc.text(cell[0], cx + 4, cy + 9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(0);
    doc.text(String(cell[1]), cx + 4, cy + 24);
  });
  y += headerH;

  // ===== Buyer / Consignee =====
  const partyH = 92;
  const partyTitleH = 14;
  doc.rect(M, y, innerW, partyH);
  doc.line(M + innerW / 2, y, M + innerW / 2, y + partyH);
  doc.rect(M, y, innerW / 2, partyTitleH, "F");
  doc.rect(M + innerW / 2, y, innerW / 2, partyTitleH, "F");
  ["Buyer (Bill to)", "Consignee (Ship to)"].forEach((title, idx) => {
    const cx = M + (idx === 0 ? 0 : innerW / 2) + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(40);
    doc.text(title, cx, y + 10);
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
  doc.setFillColor(225, 232, 240);
  doc.rect(M, y, innerW, headerRowH, "F");
  doc.rect(M, y, innerW, headerRowH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(40);
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
  doc.setTextColor(0);
  y += headerRowH;

  // Body rows
  const bodyStartY = y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  // Row 1: title centered + amount
  const rowH = 14;
  const descCenterX = colX[1] + cols[1] / 2;
  doc.setFont("helvetica", "bold");
  doc.text(invoice.serviceTitle || "Services rendered", descCenterX, y + 11, { align: "center" });
  doc.text(fmt(subtotal), colX[5] + cols[5] - 4, y + 11, { align: "right" });
  doc.text(fmt(subtotal), colX[6] + cols[6] - 4, y + 11, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += rowH;

  // Sub-items — centered in description column
  (invoice.subItems ?? []).forEach((s) => {
    if (s.italic) doc.setFont("helvetica", "italic");
    else doc.setFont("helvetica", "normal");
    doc.text(s.label, descCenterX, y + 11, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(fmt(s.amount), colX[5] + cols[5] - 4, y + 11, { align: "right" });
    doc.text(fmt(s.amount), colX[6] + cols[6] - 4, y + 11, { align: "right" });
    y += rowH;
  });

  // Tax rows directly below sub-items — "Add :" label on left, tax label italic on right of desc col
  const taxBlockStartY = y;
  const taxRow = (label: string, amt: number) => {
    doc.setFont("helvetica", "italic");
    doc.text(label, colX[1] + cols[1] - 6, y + 11, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(fmt(amt), colX[5] + cols[5] - 4, y + 11, { align: "right" });
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
    doc.setFont("helvetica", "italic");
    doc.text("Round Off", colX[1] + cols[1] - 6, y + 11, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(fmt(roundOff), colX[6] + cols[6] - 4, y + 11, { align: "right" });
    y += rowH;
  }
  // "Add :" label aligned with first tax row
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text("Add :", colX[1] + 8, taxBlockStartY + 11);

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
  doc.text(`\u20B9 ${fmt(grandTotal)}`, colX[6] + cols[6] - 4, y + 12, { align: "right" });
  y += totalH;

  // Amount in words box
  const wordsH = 36;
  doc.rect(M, y, innerW, wordsH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Amount Chargeable Including Tax (in words)", M + 6, y + 12);
  doc.text("E. & O.E", M + innerW - 6, y + 12, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  drawWrapped(doc, amountInWords(grandTotal), M + 6, y + 26, innerW - 12, 11);
  y += wordsH;

  // ===== HSN/SAC tax summary table =====
  // Columns: HSN/SAC | Taxable Value | Central Tax (Rate, Amount) | State Tax (Rate, Amount) | Total Tax
  const sumCols = isIgst
    ? [80, 110, 70, 100, 80] // IGST: HSN | Taxable | Rate | Amount | Total
    : [80, 110, 50, 70, 50, 70, 80]; // CGST/SGST split
  const sumFlex = innerW - sumCols.reduce((a, b) => a + b, 0);
  sumCols[1] += sumFlex; // give extra space to Taxable Value
  const sumX: number[] = [];
  let sx = M;
  sumCols.forEach((w) => {
    sumX.push(sx);
    sx += w;
  });

  const sumHeadH = 26;
  doc.setFillColor(225, 232, 240);
  doc.rect(M, y, innerW, sumHeadH, "F");
  doc.rect(M, y, innerW, sumHeadH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(40);

  if (isIgst) {
    const heads = ["HSN/SAC", "Taxable Value", "Rate", "Amount", "Total Tax Amount"];
    heads.forEach((h, i) => {
      if (i > 0) doc.line(sumX[i], y, sumX[i], y + sumHeadH);
      doc.text(h, sumX[i] + sumCols[i] / 2, y + 16, { align: "center" });
    });
  } else {
    // Two-row header: HSN | Taxable | Central Tax (merged) | State Tax (merged) | Total
    doc.text("HSN/SAC", sumX[0] + sumCols[0] / 2, y + 16, { align: "center" });
    doc.line(sumX[1], y, sumX[1], y + sumHeadH);
    doc.text("Taxable\nValue", sumX[1] + sumCols[1] / 2, y + 11, { align: "center" });
    // Central Tax merged over cols 2,3
    doc.line(sumX[2], y, sumX[2], y + sumHeadH);
    doc.text("Central Tax", sumX[2] + (sumCols[2] + sumCols[3]) / 2, y + 10, { align: "center" });
    doc.line(sumX[2], y + 13, sumX[2] + sumCols[2] + sumCols[3], y + 13);
    doc.text("Rate", sumX[2] + sumCols[2] / 2, y + 22, { align: "center" });
    doc.line(sumX[3], y + 13, sumX[3], y + sumHeadH);
    doc.text("Amount", sumX[3] + sumCols[3] / 2, y + 22, { align: "center" });
    // State Tax merged over cols 4,5
    doc.line(sumX[4], y, sumX[4], y + sumHeadH);
    doc.text(utLabel === "UTGST" ? "UT Tax" : "State Tax", sumX[4] + (sumCols[4] + sumCols[5]) / 2, y + 10, { align: "center" });
    doc.line(sumX[4], y + 13, sumX[4] + sumCols[4] + sumCols[5], y + 13);
    doc.text("Rate", sumX[4] + sumCols[4] / 2, y + 22, { align: "center" });
    doc.line(sumX[5], y + 13, sumX[5], y + sumHeadH);
    doc.text("Amount", sumX[5] + sumCols[5] / 2, y + 22, { align: "center" });
    // Total tax
    doc.line(sumX[6], y, sumX[6], y + sumHeadH);
    doc.text("Total\nTax Amount", sumX[6] + sumCols[6] / 2, y + 11, { align: "center" });
  }
  y += sumHeadH;
  doc.setTextColor(0);

  // Data row + total row
  const sumRowH = 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const drawSumRow = (hsn: string, taxable: number, isTotalRow = false) => {
    if (isTotalRow) doc.setFont("helvetica", "bold");
    doc.rect(M, y, innerW, sumRowH);
    for (let i = 1; i < sumCols.length; i++) {
      doc.line(sumX[i], y, sumX[i], y + sumRowH);
    }
    doc.text(hsn, sumX[0] + sumCols[0] / 2, y + 11, { align: "center" });
    doc.text(fmt(taxable), sumX[1] + sumCols[1] - 4, y + 11, { align: "right" });
    if (isIgst) {
      doc.text(`${invoice.gstRate}%`, sumX[2] + sumCols[2] / 2, y + 11, { align: "center" });
      doc.text(fmt(invoice.gstAmount), sumX[3] + sumCols[3] - 4, y + 11, { align: "right" });
      doc.text(fmt(invoice.gstAmount), sumX[4] + sumCols[4] - 4, y + 11, { align: "right" });
    } else {
      doc.text(`${halfRate}%`, sumX[2] + sumCols[2] / 2, y + 11, { align: "center" });
      doc.text(fmt(halfTax), sumX[3] + sumCols[3] - 4, y + 11, { align: "right" });
      doc.text(`${halfRate}%`, sumX[4] + sumCols[4] / 2, y + 11, { align: "center" });
      doc.text(fmt(halfTax), sumX[5] + sumCols[5] - 4, y + 11, { align: "right" });
      doc.text(fmt(invoice.gstAmount), sumX[6] + sumCols[6] - 4, y + 11, { align: "right" });
    }
    doc.setFont("helvetica", "normal");
    y += sumRowH;
  };
  drawSumRow(invoice.hsnCode || "—", subtotal, false);
  drawSumRow("Total", subtotal, true);

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

  // Terms + signatory — measure actual wrapped height first
  const termLineH = 11;
  const termsColW = innerW / 2 - 12;
  const wrappedTerms = TERMS.map((t, i) =>
    doc.splitTextToSize(`${i + 1}. ${t}`, termsColW) as string[],
  );
  const termsTextH = wrappedTerms.reduce(
    (sum, lines) => sum + lines.length * termLineH + 3, // +3pt gap between terms
    0,
  );
  const termsH = Math.max(80, 20 + termsTextH);
  doc.rect(M, y, innerW, termsH);
  doc.line(M + innerW / 2, y, M + innerW / 2, y + termsH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Terms and Conditions:", M + 6, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let ty = y + 27;
  wrappedTerms.forEach((lines) => {
    doc.text(lines, M + 6, ty);
    ty += lines.length * termLineH + 3;
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
