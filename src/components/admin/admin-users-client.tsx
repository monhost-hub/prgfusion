"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Shield, User, Trash2, Coins, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  credits: number;
  createdAt: string;
}

export function AdminUsersClient({ users: initial, labels }: { users: UserRow[]; labels: Record<string, string> }) {
  const [list, setList] = useState<UserRow[]>(initial);
  const [adjustingUser, setAdjustingUser] = useState<UserRow | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>("");
  const [saving, setSaving] = useState(false);

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

  function openAdjust(u: UserRow) {
    setAdjustingUser(u);
    setAdjustAmount(0);
    setAdjustReason("");
  }

  async function saveAdjust() {
    if (!adjustingUser) return;
    if (adjustAmount === 0) {
      toast.error("Amount cannot be 0");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${adjustingUser.id}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: adjustAmount,
          reason: adjustReason || "admin_adjustment",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed");
        return;
      }
      toast.success(`Crédits ajustés : nouveau solde = ${data.balance}`);
      setList((l) =>
        l.map((u) => (u.id === adjustingUser.id ? { ...u, credits: data.balance } : u))
      );
      setAdjustingUser(null);
    } finally {
      setSaving(false);
    }
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
                <th className="text-left px-4 py-3">Crédits</th>
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
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5 text-amber-500" />
                      <span className={`font-semibold ${u.credits > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                        {u.credits ?? 0}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openAdjust(u)}
                        title="Ajuster les crédits"
                      >
                        <Coins className="h-3.5 w-3.5" />
                      </Button>
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

      {/* === Dialog ajuster crédits === */}
      <Dialog open={!!adjustingUser} onOpenChange={(v) => !v && setAdjustingUser(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Ajuster les crédits — {adjustingUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="text-xs text-muted-foreground">Solde actuel</p>
              <p className="text-2xl font-bold">{adjustingUser?.credits ?? 0} crédits</p>
            </div>
            <div>
              <Label className="text-xs">Montant (+ pour ajouter, − pour retirer)</Label>
              <Input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 0)}
                placeholder="ex: 100 pour ajouter 100 crédits"
              />
              <div className="mt-1 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAdjustAmount((v) => v + 10)}
                >
                  <Plus className="h-3 w-3 mr-1" /> 10
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAdjustAmount((v) => v + 50)}
                >
                  <Plus className="h-3 w-3 mr-1" /> 50
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAdjustAmount((v) => v + 100)}
                >
                  <Plus className="h-3 w-3 mr-1" /> 100
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAdjustAmount((v) => Math.max(0, v - 10))}
                >
                  <Minus className="h-3 w-3 mr-1" /> 10
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Raison (optionnel)</Label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="ex: recharge manuelle, bonus, correction..."
              />
            </div>
            {adjustAmount !== 0 && adjustingUser && (
              <div className="rounded-lg bg-primary/10 p-2 text-xs">
                Nouveau solde : <span className="font-bold">{adjustingUser.credits + adjustAmount}</span> crédits
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustingUser(null)}>
              Annuler
            </Button>
            <Button
              onClick={saveAdjust}
              disabled={saving || adjustAmount === 0}
              className="bg-brand-gradient text-white hover:opacity-90"
            >
              {saving ? "..." : "Valider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
