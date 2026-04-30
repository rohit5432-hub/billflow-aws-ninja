import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect, useState } from "react";

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

export type GstType = "CGST_SGST" | "IGST" | "CGST_UTGST";

export type UserRole = "admin" | "manager" | "accountant" | "viewer";

export type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  createdAt: string;
};

/** Optional sub-line shown under the main service row (Tally style breakdown). */
export type InvoiceSubItem = {
  label: string;
  amount: number;
  italic?: boolean;
};

export type Invoice = {
  id: string;
  number: string;
  customerId: string;
  amount: number; // amount in INR (post-conversion) = subtotal / taxable value
  originalAmount: number;
  currency: "INR" | "USD";
  fxRate: number; // 1 USD = X INR (1 if INR)
  gstRate: 5 | 12 | 18;
  gstType: GstType;
  gstAmount: number;
  total: number;
  status: "paid" | "pending";
  invoiceDate: string;
  dueDate: string;
  // ---- Tally-style optional fields ----
  serviceTitle?: string;       // e.g. "AWS-SERVICES"
  hsnCode?: string;            // e.g. "998315"
  subItems?: InvoiceSubItem[]; // breakdown rows under the main service
  referenceNo?: string;
  buyersOrderNo?: string;
  paymentTerms?: string;
  placeOfSupply?: string;
  consigneeSameAsBuyer?: boolean;
  roundOff?: number;           // can be negative
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
    {
      name: "billing-auth",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : (undefined as any)
      ),
    }
  )
);

/** True once zustand-persist has rehydrated from localStorage (client-only). */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const check = () => {
      if (
        useAuth.persist.hasHydrated() &&
        useData.persist.hasHydrated()
      ) {
        setHydrated(true);
      }
    };
    check();
    const u1 = useAuth.persist.onFinishHydration(check);
    const u2 = useData.persist.onFinishHydration(check);
    return () => {
      u1();
      u2();
    };
  }, []);
  return hydrated;
}

type DataState = {
  company: Company | null;
  customers: Customer[];
  invoices: Invoice[];
  users: TeamUser[];
  setCompany: (c: Company) => void;
  addCustomer: (c: Omit<Customer, "id">) => Customer;
  addInvoice: (i: Omit<Invoice, "id" | "number">) => Invoice;
  setInvoiceStatus: (id: string, status: "paid" | "pending") => void;
  addUser: (u: Omit<TeamUser, "id" | "createdAt">) => TeamUser;
  updateUser: (id: string, patch: Partial<Omit<TeamUser, "id" | "createdAt">>) => void;
  deleteUser: (id: string) => void;
  loadSampleData: () => void;
  resetAll: () => void;
};

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      company: null,
      customers: [],
      invoices: [],
      users: [],
      setCompany: (c) => set({ company: c }),
      addCustomer: (c) => {
        const customer = { ...c, id: crypto.randomUUID() };
        set((s) => ({ customers: [...s.customers, customer] }));
        return customer;
      },
      addInvoice: (i) => {
        const number = `INV-${String(get().invoices.length + 1).padStart(4, "0")}`;
        const inv: Invoice = { ...i, id: crypto.randomUUID(), number };
        set((s) => ({ invoices: [inv, ...s.invoices] }));
        return inv;
      },
      addUser: (u) => {
        const user: TeamUser = {
          ...u,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ users: [user, ...s.users] }));
        return user;
      },
      updateUser: (id, patch) =>
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        })),
      deleteUser: (id) =>
        set((s) => ({ users: s.users.filter((u) => u.id !== id) })),
      setInvoiceStatus: (id, status) =>
        set((s) => ({
          invoices: s.invoices.map((x) => (x.id === id ? { ...x, status } : x)),
        })),
      loadSampleData: () => {
        const today = new Date();
        const iso = (offset = 0) =>
          new Date(today.getTime() + offset * 86400000).toISOString().slice(0, 10);

        // Company — matches the reference Tally PDF (Apoyphe seller)
        set({
          company: {
            name: "Apoyphe Software Services Pvt Ltd",
            email: "billing@apoyphe.com",
            phone: "+91 99489 03222",
            gstin: "36AAXCA4173C1ZI",
            address:
              "#467, 4th Floor, Ayyappa Society,\nMadhapur, Hyderabad - 500081.\nState: Telangana, Code: 36",
          },
        });

        // 3 customers — first one matches the reference PDF (Sumax Engineering)
        const customers: Customer[] = [
          {
            id: crypto.randomUUID(),
            name: "Sumax Engineering Pvt Ltd",
            gstin: "36AAQCS1234M1Z7",
            email: "accounts@sumaxengineering.com",
            address:
              "Plot No. 45, Phase-II, IDA Cherlapally,\nHyderabad - 500051.\nState: Telangana, Code: 36",
          },
          {
            id: crypto.randomUUID(),
            name: "Bengaluru Logistics LLP",
            gstin: "29AABCB5678K1Z9",
            email: "accounts@blr-logistics.in",
            address: "MG Road, Bengaluru, Karnataka 560001",
          },
          {
            id: crypto.randomUUID(),
            name: "Chandigarh Retail Group",
            gstin: "04AACCC9012L1Z3",
            email: "finance@chd-retail.in",
            address: "Sector 17, Chandigarh 160017",
          },
        ];
        set({ customers });

        // 4 sample invoices: CGST+SGST paid, IGST pending USD, CGST+UTGST paid, IGST pending small
        const samples: Omit<Invoice, "id" | "number">[] = [
          {
            customerId: customers[0].id,
            amount: 68729.84, originalAmount: 68729.84, currency: "INR", fxRate: 1,
            gstRate: 18, gstType: "CGST_SGST",
            gstAmount: 12371.37, total: 81101.21,
            status: "paid", invoiceDate: iso(-20), dueDate: iso(-5),
            serviceTitle: "AWS-SERVICES",
            hsnCode: "998315",
            subItems: [
              { label: "Data Transfer & Configuration", amount: 30728.0 },
              { label: "New organisation Set-up", amount: 6440, italic: true },
              { label: "Manage Services", amount: 8000 },
              { label: "Previous Month GST Amount", amount: 23561.84, italic: true },
            ],
            referenceNo: "PO-2026-014",
            placeOfSupply: "Telangana",
            consigneeSameAsBuyer: true,
            roundOff: -0.21,
          },
          {
            customerId: customers[1].id,
            amount: 1200 * 83.5, originalAmount: 1200, currency: "USD", fxRate: 83.5,
            gstRate: 18, gstType: "IGST",
            gstAmount: (1200 * 83.5 * 18) / 100,
            total: 1200 * 83.5 + (1200 * 83.5 * 18) / 100,
            status: "pending", invoiceDate: iso(-7), dueDate: iso(8),
            serviceTitle: "CONSULTING SERVICES",
            hsnCode: "998314",
            placeOfSupply: "Karnataka",
            consigneeSameAsBuyer: true,
          },
          {
            customerId: customers[2].id,
            amount: 28000, originalAmount: 28000, currency: "INR", fxRate: 1,
            gstRate: 12, gstType: "CGST_UTGST",
            gstAmount: 3360, total: 31360,
            status: "paid", invoiceDate: iso(-12), dueDate: iso(3),
            serviceTitle: "SOFTWARE LICENSE",
            hsnCode: "998313",
            placeOfSupply: "Chandigarh",
            consigneeSameAsBuyer: true,
          },
          {
            customerId: customers[1].id,
            amount: 8500, originalAmount: 8500, currency: "INR", fxRate: 1,
            gstRate: 5, gstType: "IGST",
            gstAmount: 425, total: 8925,
            status: "pending", invoiceDate: iso(-2), dueDate: iso(13),
            serviceTitle: "SUPPORT SERVICES",
            hsnCode: "998316",
            placeOfSupply: "Karnataka",
            consigneeSameAsBuyer: true,
          },
        ];

        const invoices: Invoice[] = samples.map((s, idx) => ({
          ...s,
          id: crypto.randomUUID(),
          number: `INV-${String(idx + 1).padStart(4, "0")}`,
        }));
        set({ invoices });
      },
      resetAll: () => set({ company: null, customers: [], invoices: [], users: [] }),
    }),
    {
      name: "billing-data",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : (undefined as any)
      ),
    }
  )
);
