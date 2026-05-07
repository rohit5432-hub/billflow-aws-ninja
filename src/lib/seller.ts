// Hardcoded seller / company on every invoice (matches the reference Tally PDF).

export const SELLER = {
  name: "Apoyphe Software Services Pvt Ltd",
  address:
    "#467, 4th Floor, Ayyappa Society, Madhapur, Hyderabad - 500081.",
  gstin: "36AAXCA4173C1ZI",
  stateName: "Telangana",
  stateCode: "36",
  email: "billing@apoyphe.com",
  phone: "+91 99489 03222",
};

export const BANK = {
  accountName: "APOYPHE SOFTWARE SERVICES PRIVATE LIMITED",
  bankName: "ICICI Bank C/Ac",
  accountNo: "424505000618",
  branchAndIfsc: "Kondapur Branch, Sec-Bad. & ICIC0004245",
};

export const TERMS = [
  "Goods once sold will be not taken back or exchanged.",
  "Payment to be made in favour of APOYPHE SOFTWARE SERVICES PRIVATE LIMITED via CHQ/NEFT/RTGS",
  "In case of Payment default Interest shall be charged, @36% p.a.",
];

/** Selectable terms shown in the "Choose Terms & Conditions" picker on the invoice form. */
export const TERMS_OPTIONS: string[] = [
  "Payment to be made in favour of APOYPHE SOFTWARE SERVICES PRIVATE LIMITED via CHQ/NEFT/RTGS",
  "In case of Payment default Interest shall be charged, @36% p.a.",
  "This invoice represents supply of cloud computing infrastructure on a principal-to-principal basis.",
  "These subsequent resales of the software without any modifications by the dealer.",
  "This does not constitute professional, technical or consultancy services.",
  "TDS under Section 194J is NOT applicable.",
  "GST charged is eligible for ITC.",
  "Payment to be made to APOYPHE SOFTWARE SERVICES PRIVATE LIMITED.",
];

export const SIGNATORY = "VANTURI RAMAKRISHNA";
export const JURISDICTION = "SUBJECT TO HYDERABAD JURISDICTION";
