import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useData, type UserRole } from "@/lib/store";
import { toast } from "sonner";
import { UserPlus, Trash2, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "Users — Apoyphe" }] }),
  component: UsersPage,
});

const ROLES: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "accountant", label: "Accountant" },
  { value: "viewer", label: "Viewer" },
];

const roleVariant: Record<UserRole, "default" | "secondary" | "outline"> = {
  admin: "default",
  manager: "secondary",
  accountant: "secondary",
  viewer: "outline",
};

function UsersPage() {
  const users = useData((s) => s.users);
  const addUser = useData((s) => s.addUser);
  const deleteUser = useData((s) => s.deleteUser);
  const [showPwd, setShowPwd] = useState(false);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    name: string; email: string; phone: string; role: UserRole; password: string;
  }>({
    name: "", email: "", phone: "", role: "viewer", password: "",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!form.password || form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    addUser({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      role: form.role,
      password: form.password,
    });
    setForm({ name: "", email: "", phone: "", role: "viewer", password: "" });
    toast.success("User added");
  };

  return (
    <AppLayout title="Users">
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Add User</h3>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  maxLength={64}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary-glow">
              <UserPlus className="h-4 w-4 mr-2" />Add User
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Team Members ({users.length})</h3>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet. Add your first team member.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {u.password ? (
                        <button
                          type="button"
                          onClick={() => setRevealId(revealId === u.id ? null : u.id)}
                          className="inline-flex items-center gap-1 hover:text-foreground text-muted-foreground"
                        >
                          {revealId === u.id ? u.password : "••••••••"}
                          {revealId === u.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleVariant[u.role]} className="capitalize">{u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          deleteUser(u.id);
                          toast.success("User removed");
                        }}
                        aria-label={`Delete ${u.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
