import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useData } from "@/lib/store";
import { formatINR } from "@/lib/fx";
import { FilePlus2, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invoices/")({
  head: () => ({ meta: [{ title: "Invoices — Apoyphe" }] }),
  component: InvoicesList,
});

function InvoicesList() {
  const invoices = useData((s) => s.invoices);
  const customers = useData((s) => s.customers);
  const setStatus = useData((s) => s.setInvoiceStatus);
  const deleteInvoice = useData((s) => s.deleteInvoice);
  const [filter, setFilter] = useState<"all" | "paid" | "pending">("all");

  const filtered = invoices.filter((i) => filter === "all" || i.status === filter);
  const cust = (id: string) => customers.find((c) => c.id === id)?.name || "—";

  return (
    <AppLayout title="Invoices">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="all">All ({invoices.length})</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
            </TabsList>
          </Tabs>
          <Link to="/invoices/new"><Button className="bg-gradient-to-r from-primary to-primary-glow"><FilePlus2 className="h-4 w-4 mr-2" />New Invoice</Button></Link>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No invoices.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead><TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead><TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-sm">{i.number}</TableCell>
                  <TableCell className="font-medium">{cust(i.customerId)}</TableCell>
                  <TableCell>{formatINR(i.total)}</TableCell>
                  <TableCell>{i.dueDate}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => setStatus(i.id, i.status === "paid" ? "pending" : "paid")}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${i.status === "paid" ? "bg-success/15 text-success hover:bg-success/25" : "bg-warning/15 text-warning hover:bg-warning/25"}`}
                    >
                      {i.status}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link to="/invoices/$id" params={{ id: i.id }}>
                        <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete invoice {i.number}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove the invoice. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                deleteInvoice(i.id);
                                toast.success(`Invoice ${i.number} deleted`);
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </AppLayout>
  );
}
