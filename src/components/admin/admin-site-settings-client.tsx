"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

interface Row {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

export function AdminSiteSettingsClient({ settings, labels }: { settings: Row[]; labels: Record<string, string> }) {
  const [list, setList] = useState<Row[]>(settings);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  async function update(id: string, value: string) {
    const row = list.find((r) => r.id === id);
    if (!row) return;
    const res = await fetch("/api/admin/site-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: row.key, value }),
    });
    if (!res.ok) {
      toast.error("Failed to update");
      return;
    }
    toast.success("Saved");
    setList((l) => l.map((r) => (r.id === id ? { ...r, value } : r)));
  }

  async function add() {
    if (!newKey.trim()) return;
    const res = await fetch("/api/admin/site-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newKey.trim(), value: newValue }),
    });
    if (!res.ok) {
      toast.error("Failed to add");
      return;
    }
    const data = await res.json();
    setList((l) => [...l, data.setting]);
    setNewKey("");
    setNewValue("");
    toast.success("Added");
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{labels.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>

      <Card className="glass-card mt-6">
        <CardContent className="p-5">
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] items-end">
            <div>
              <label className="text-xs">{labels.colKey}</label>
              <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            </div>
            <div>
              <label className="text-xs">{labels.colValue}</label>
              <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            </div>
            <Button onClick={add} className="bg-brand-gradient text-white hover:opacity-90">
              <Plus className="mr-1 h-4 w-4" /> {labels.add}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        {list.map((r) => (
          <Card key={r.id} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-sm font-semibold">{r.key}</span>
                {r.description && <span className="text-xs text-muted-foreground">{r.description}</span>}
              </div>
              <Textarea
                defaultValue={r.value}
                rows={Math.min(10, Math.max(2, r.value.split("\n").length + 1))}
                onBlur={(e) => {
                  if (e.target.value !== r.value) update(r.id, e.target.value);
                }}
                className="font-mono text-xs"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
