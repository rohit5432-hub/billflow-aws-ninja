// Thin REST client for the AWS Lambda + API Gateway backend.
// Activated when VITE_API_URL is set at build time (e.g. "/api" behind CloudFront,
// or a full https URL for direct API Gateway calls). When unset, isApiEnabled()
// returns false and the app keeps using its local zustand store — so the Lovable
// preview keeps working without AWS.

import type { Company, Customer, Invoice, TeamUser } from "./store";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

export const isApiEnabled = () => BASE.length > 0;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return (await res.json()) as T;
}

export const api = {
  // company
  getCompany: () => req<Company | null>("/company"),
  putCompany: (c: Company) => req<Company>("/company", { method: "PUT", body: JSON.stringify(c) }),

  // customers
  listCustomers: () => req<Customer[]>("/customers"),
  createCustomer: (c: Omit<Customer, "id">) =>
    req<Customer>("/customers", { method: "POST", body: JSON.stringify(c) }),
  updateCustomer: (id: string, c: Partial<Customer>) =>
    req<Customer>(`/customers/${id}`, { method: "PUT", body: JSON.stringify(c) }),
  deleteCustomer: (id: string) => req<{ ok: true }>(`/customers/${id}`, { method: "DELETE" }),

  // invoices
  listInvoices: () => req<Invoice[]>("/invoices"),
  getInvoice: (id: string) => req<Invoice>(`/invoices/${id}`),
  createInvoice: (i: Omit<Invoice, "id" | "number">) =>
    req<Invoice>("/invoices", { method: "POST", body: JSON.stringify(i) }),
  updateInvoice: (id: string, i: Partial<Invoice>) =>
    req<Invoice>(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(i) }),
  deleteInvoice: (id: string) => req<{ ok: true }>(`/invoices/${id}`, { method: "DELETE" }),
  setInvoiceStatus: (id: string, status: "paid" | "pending") =>
    req<{ ok: true }>(`/invoices/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  // users
  listUsers: () => req<TeamUser[]>("/users"),
  createUser: (u: Omit<TeamUser, "id" | "createdAt">) =>
    req<TeamUser>("/users", { method: "POST", body: JSON.stringify(u) }),
  updateUser: (id: string, u: Partial<TeamUser>) =>
    req<TeamUser>(`/users/${id}`, { method: "PUT", body: JSON.stringify(u) }),
  deleteUser: (id: string) => req<{ ok: true }>(`/users/${id}`, { method: "DELETE" }),
};
