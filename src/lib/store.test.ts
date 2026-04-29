import { describe, it, expect, beforeEach } from "vitest";
import { useAuth, useData } from "./store";

describe("useAuth", () => {
  beforeEach(() => {
    useAuth.setState({ loggedIn: false, username: null });
  });

  it("logs in with correct demo credentials", () => {
    const ok = useAuth.getState().login("admin", "admin123");
    expect(ok).toBe(true);
    expect(useAuth.getState().loggedIn).toBe(true);
    expect(useAuth.getState().username).toBe("admin");
  });

  it("rejects wrong credentials", () => {
    const ok = useAuth.getState().login("admin", "nope");
    expect(ok).toBe(false);
    expect(useAuth.getState().loggedIn).toBe(false);
  });

  it("logs out", () => {
    useAuth.getState().login("admin", "admin123");
    useAuth.getState().logout();
    expect(useAuth.getState().loggedIn).toBe(false);
    expect(useAuth.getState().username).toBeNull();
  });
});

describe("useData (end-to-end flow)", () => {
  beforeEach(() => {
    useData.setState({ company: null, customers: [], invoices: [] });
  });

  it("full flow: company -> customer -> invoice -> mark paid", () => {
    const s = useData.getState;

    // 1. Save company
    s().setCompany({
      name: "Apoyphe",
      email: "hi@apoyphe.com",
      phone: "+91 99489 03222",
      gstin: "36ABCDE1234F1Z5",
      address: "Madhapur, Telangana",
    });
    expect(s().company?.name).toBe("Apoyphe");

    // 2. Add a customer
    s().addCustomer({
      name: "Acme Co",
      email: "ap@acme.com",
      gstin: "29XYZAB5678C1Z9",
      address: "Bangalore",
    });
    expect(s().customers).toHaveLength(1);
    const customer = s().customers[0];
    expect(customer.id).toBeTruthy();

    // 3. Create an invoice (CGST + SGST 18% on 1000 INR)
    const created = s().addInvoice({
      customerId: customer.id,
      amount: 1000,
      originalAmount: 1000,
      currency: "INR",
      fxRate: 1,
      gstRate: 18,
      gstType: "CGST_SGST",
      gstAmount: 180,
      total: 1180,
      status: "pending",
      invoiceDate: "2026-04-29",
      dueDate: "2026-05-14",
    });
    expect(created.number).toBe("INV-0001");
    expect(s().invoices).toHaveLength(1);
    expect(s().invoices[0].status).toBe("pending");

    // 4. Mark it paid
    s().setInvoiceStatus(created.id, "paid");
    expect(s().invoices[0].status).toBe("paid");
  });

  it("auto-numbers sequential invoices", () => {
    const s = useData.getState;
    s().addCustomer({ name: "C", email: "", gstin: "", address: "" });
    const cid = s().customers[0].id;
    const base = {
      customerId: cid,
      amount: 100,
      originalAmount: 100,
      currency: "INR" as const,
      fxRate: 1,
      gstRate: 18 as const,
      gstType: "IGST" as const,
      gstAmount: 18,
      total: 118,
      status: "pending" as const,
      invoiceDate: "2026-04-29",
      dueDate: "2026-05-14",
    };
    const a = s().addInvoice(base);
    const b = s().addInvoice(base);
    const c = s().addInvoice(base);
    expect([a.number, b.number, c.number]).toEqual([
      "INV-0001",
      "INV-0002",
      "INV-0003",
    ]);
  });
});
