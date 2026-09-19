"use client";

import { useState, useEffect } from "react";
// useEffect still used for fetching models list on mount.
import { toast } from "sonner";
import { Plus, Edit, Trash2, Zap, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Model {
  id: string;
  name: string;
  providerId: string;
  provider: string;
  description: string | null;
  costPerCall: number;
  enabled: boolean;
  isActive: boolean;
}

interface Props {
  models: Model[];
  labels: Record<string, string>;
}

export function AdminModelsClient({ models, labels }: Props) {
  const [list, setList] = useState<Model[]>(models);
  const [editing, setEditing] = useState<Model | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function refresh() {
    const res = await fetch("/api/admin/models");
    const data = await res.json();
    setList(data.models);
  }

  async function activate(id: string) {
    const res = await fetch(`/api/admin/models/${id}/activate`, { method: "POST" });
    if (!res.ok) {
      toast.error("Failed to activate model");
      return;
    }
    toast.success(labels.active + " ✓");
    refresh();
  }

  async function toggle(id: string, current: boolean) {
    const res = await fetch(`/api/admin/models/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !current }),
    });
    if (!res.ok) {
      toast.error("Failed to update model");
      return;
    }
    refresh();
  }

  async function test(id: string) {
    toast.info("Testing model…");
    const res = await fetch(`/api/admin/models/${id}/test`, { method: "POST" });
    const data = await res.json();
    if (data.ok) toast.success(labels.testOk + ` (${data.latencyMs}ms)`);
    else toast.error(labels.testFail.replace("{error}", data.error || "unknown"));
  }

  async function remove(id: string) {
    if (!confirm("Delete this model?")) return;
    const res = await fetch(`/api/admin/models/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error || "Failed to delete");
      return;
    }
    toast.success("Deleted");
    refresh();
  }

  function openEdit(m: Model) {
    setEditing(m);
    setDialogOpen(true);
  }
  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{labels.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
        </div>
        <Button onClick={openAdd} className="bg-brand-gradient text-white hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" />
          {labels.add}
        </Button>
      </div>

      <Card className="glass-card mt-6 overflow-hidden">
        <div className="overflow-x-auto scroll-styled">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">{labels.colName}</th>
                <th className="text-left px-4 py-3">{labels.colProviderId}</th>
                <th className="text-left px-4 py-3">{labels.colProvider}</th>
                <th className="text-left px-4 py-3">{labels.colCost}</th>
                <th className="text-left px-4 py-3">{labels.colEnabled}</th>
                <th className="text-left px-4 py-3">{labels.colActive}</th>
                <th className="text-right px-4 py-3">{labels.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {list.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.providerId}</td>
                  <td className="px-4 py-3">{m.provider}</td>
                  <td className="px-4 py-3">${m.costPerCall.toFixed(4)}</td>
                  <td className="px-4 py-3">
                    <Switch checked={m.enabled} onCheckedChange={() => toggle(m.id, m.enabled)} />
                  </td>
                  <td className="px-4 py-3">
                    {m.isActive ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        {labels.active}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => activate(m.id)}
                        disabled={!m.enabled}
                      >
                        {labels.setActive}
                      </Button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => test(m.id)}>
                        <Zap className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(m.id)}
                        disabled={m.isActive}
                      >
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

      <ModelDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        model={editing}
        labels={labels}
        onSaved={() => {
          setDialogOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

function ModelDialog({
  open,
  onOpenChange,
  model,
  labels,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  model: Model | null;
  labels: Record<string, string>;
  onSaved: () => void;
}) {
  const [name, setName] = useState(model?.name ?? "");
  const [providerId, setProviderId] = useState(model?.providerId ?? "");
  const [provider, setProvider] = useState(model?.provider ?? "openrouter");
  const [description, setDescription] = useState(model?.description ?? "");
  const [costPerCall, setCostPerCall] = useState(model?.costPerCall ?? 0);
  const [enabled, setEnabled] = useState(model?.enabled ?? true);
  const [isActive, setIsActive] = useState(model?.isActive ?? false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const payload = {
      name,
      providerId,
      provider,
      description,
      costPerCall,
      enabled,
      isActive,
    };
    const res = await fetch(
      model ? `/api/admin/models/${model.id}` : "/api/admin/models",
      {
        method: model ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error || "Save failed");
      return;
    }
    toast.success("Saved");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{model ? labels.editTitle : labels.addTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{labels.fieldName}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{labels.fieldProviderId}</Label>
            <Input value={providerId} onChange={(e) => setProviderId(e.target.value)} placeholder="google/nano-banana-2-lite" />
          </div>
          <div>
            <Label className="text-xs">{labels.fieldProvider}</Label>
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{labels.fieldDescription}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <Label className="text-xs">{labels.fieldCost}</Label>
            <Input
              type="number"
              step="0.0001"
              value={costPerCall}
              onChange={(e) => setCostPerCall(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} id="enabled" />
            <Label htmlFor="enabled" className="text-sm">{labels.fieldEnabled}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
            <Label htmlFor="active" className="text-sm">{labels.fieldActive}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{labels.cancel}</Button>
          <Button onClick={save} disabled={saving} className="bg-brand-gradient text-white hover:opacity-90">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
