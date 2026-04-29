import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Company = {
  name: string;
  email: string;
  phone: string;
  gstin: string;
  address: string;
};

export type Customer = {
  id: string;
  name: string;
  gstin: string;
  email: string;
  address: string;
};

export type Invoice = {
  id: string;
  number: string;
  customerId: string;
  amount: number; // amount in INR (post-conversion)
  originalAmount: number;
  currency: "INR" | "USD";
  fxRate: number; // 1 USD = X INR (1 if INR)
  gstRate: 5 | 12 | 18;
  gstAmount: number;
  total: number;
  status: "paid" | "pending";
  invoiceDate: string;
  dueDate: string;
};

type AuthState = {
  loggedIn: boolean;
  username: string | null;
  login: (u: string, p: string) => boolean;
  logout: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      loggedIn: false,
      username: null,
      login: (u, p) => {
        // Demo: admin / admin123
        if (u === "admin" && p === "admin123") {
          set({ loggedIn: true, username: u });
          return true;
        }
        return false;
      },
      logout: () => set({ loggedIn: false, username: null }),
    }),
    { name: "billing-auth" }
  )
);

type DataState = {
  company: Company | null;
  customers: Customer[];
  invoices: Invoice[];
  setCompany: (c: Company) => void;
  addCustomer: (c: Omit<Customer, "id">) => void;
  addInvoice: (i: Omit<Invoice, "id" | "number">) => Invoice;
  setInvoiceStatus: (id: string, status: "paid" | "pending") => void;
};

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      company: null,
      customers: [],
      invoices: [],
      setCompany: (c) => set({ company: c }),
      addCustomer: (c) =>
        set((s) => ({
          customers: [...s.customers, { ...c, id: crypto.randomUUID() }],
        })),
      addInvoice: (i) => {
        const number = `INV-${String(get().invoices.length + 1).padStart(4, "0")}`;
        const inv: Invoice = { ...i, id: crypto.randomUUID(), number };
        set((s) => ({ invoices: [inv, ...s.invoices] }));
        return inv;
      },
      setInvoiceStatus: (id, status) =>
        set((s) => ({
          invoices: s.invoices.map((x) => (x.id === id ? { ...x, status } : x)),
        })),
    }),
    { name: "billing-data" }
  )
);
