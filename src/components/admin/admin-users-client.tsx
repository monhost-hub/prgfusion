"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Shield, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export function AdminUsersClient({ users: initial, labels }: { users: UserRow[]; labels: Record<string, string> }) {
  const [list, setList] = useState<UserRow[]>(initial);

  async function setRole(id: string, role: "USER" | "ADMIN") {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error || "Failed");
      return;
    }
    toast.success("Updated");
    setList((l) => l.map((u) => (u.id === id ? { ...u, role } : u)));
  }

  async function remove(id: string) {
    if (!confirm(labels.confirmDelete)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error || "Failed");
      return;
    }
    toast.success("Deleted");
    setList((l) => l.filter((u) => u.id !== id));
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{labels.title}</h1>
      <Card className="glass-card mt-6 overflow-hidden">
        <div className="overflow-x-auto scroll-styled">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">{labels.colEmail}</th>
                <th className="text-left px-4 py-3">{labels.colName}</th>
                <th className="text-left px-4 py-3">{labels.colRole}</th>
                <th className="text-left px-4 py-3">{labels.colCreated}</th>
                <th className="text-right px-4 py-3">{labels.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {list.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {u.role === "ADMIN" ? (
                      <Badge className="bg-brand-gradient text-white inline-flex items-center gap-1">
                        <Shield className="h-3 w-3" /> ADMIN
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" /> USER
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {u.role === "USER" ? (
                        <Button size="sm" variant="ghost" onClick={() => setRole(u.id, "ADMIN")}>
                          {labels.makeAdmin}
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setRole(u.id, "USER")}>
                          {labels.makeUser}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => remove(u.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
