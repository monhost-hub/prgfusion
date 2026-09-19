"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Plan {
  id: string;
  slug: string;
  nameJson: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  credits: number;
  featured: boolean;
  enabled: boolean;
  sortOrder: number;
}

interface Props {
  plans: Plan[];
  labels: Record<string, string>;
}

export function AdminPricingClient({ plans, labels }: Props) {
  const [list, setList] = useState<Plan[]>(plans);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function refresh() {
    const res = await fetch("/api/admin/pricing");
    const data = await res.json();
    setList(data.plans);
  }

  async function remove(id: string) {
    if (!confirm("Delete this plan?")) return;
    const res = await fetch(`/api/admin/pricing/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Deleted");
    refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{labels.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="bg-brand-gradient text-white hover:opacity-90"
        >
          <Plus className="mr-2 h-4 w-4" />
          {labels.add}
        </Button>
      </div>

      <Card className="glass-card mt-6 overflow-hidden">
        <div className="overflow-x-auto scroll-styled">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">{labels.colSlug}</th>
                <th className="text-left px-4 py-3">{labels.colName}</th>
                <th className="text-left px-4 py-3">{labels.colPrice}</th>
                <th className="text-left px-4 py-3">{labels.colCredits}</th>
                <th className="text-left px-4 py-3">{labels.colFeatured}</th>
                <th className="text-left px-4 py-3">{labels.colEnabled}</th>
                <th className="text-right px-4 py-3">{labels.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {list.map((p) => {
                let name: any = p.nameJson;
                try { name = JSON.parse(p.nameJson); } catch {}
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{p.slug}</td>
                    <td className="px-4 py-3">{name?.en ?? p.slug}</td>
                    <td className="px-4 py-3">${p.priceMonthly} / ${p.priceYearly}</td>
                    <td className="px-4 py-3">{p.credits}</td>
                    <td className="px-4 py-3">{p.featured ? <Badge>★</Badge> : "—"}</td>
                    <td className="px-4 py-3">{p.enabled ? <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">on</Badge> : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(p);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <PlanDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan={editing}
        labels={labels}
        onSaved={() => {
          setDialogOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

function PlanDialog({
  open,
  onOpenChange,
  plan,
  labels,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: Plan | null;
  labels: Record<string, string>;
  onSaved: () => void;
}) {
  // Derive initial state from plan prop (the dialog is keyed by plan.id, so
  // a fresh state is created each time it opens).
  const initialName = (() => {
    if (!plan) return { en: "", fr: "", es: "" };
    try { return JSON.parse(plan.nameJson); } catch { return { en: "", fr: "", es: "" }; }
  })();

  const [slug, setSlug] = useState(plan?.slug ?? "");
  const [nameEn, setNameEn] = useState(initialName.en ?? "");
  const [nameFr, setNameFr] = useState(initialName.fr ?? "");
  const [nameEs, setNameEs] = useState(initialName.es ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [priceMonthly, setPriceMonthly] = useState(plan?.priceMonthly ?? 0);
  const [priceYearly, setPriceYearly] = useState(plan?.priceYearly ?? 0);
  const [credits, setCredits] = useState(plan?.credits ?? 0);
  const [featured, setFeatured] = useState(plan?.featured ?? false);
  const [enabled, setEnabled] = useState(plan?.enabled ?? true);
  const [sortOrder, setSortOrder] = useState(plan?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const payload = {
      slug,
      nameJson: { en: nameEn, fr: nameFr, es: nameEs },
      description,
      priceMonthly,
      priceYearly,
      credits,
      featured,
      enabled,
      sortOrder,
    };
    const res = await fetch(plan ? `/api/admin/pricing/${plan.id}` : "/api/admin/pricing", {
      method: plan ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
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
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{plan ? labels.edit : labels.add}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto scroll-styled pr-1">
          <div>
            <Label className="text-xs">Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="pro" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Name EN</Label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Name FR</Label>
              <Input value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Name ES</Label>
              <Input value={nameEs} onChange={(e) => setNameEs(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Monthly $</Label>
              <Input type="number" step="0.01" value={priceMonthly} onChange={(e) => setPriceMonthly(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs">Yearly $</Label>
              <Input type="number" step="0.01" value={priceYearly} onChange={(e) => setPriceYearly(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs">Credits</Label>
              <Input type="number" value={credits} onChange={(e) => setCredits(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 items-center">
            <div className="flex items-center gap-2">
              <Switch checked={featured} onCheckedChange={setFeatured} id="featured" />
              <Label htmlFor="featured" className="text-xs">Featured</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={enabled} onCheckedChange={setEnabled} id="enabled" />
              <Label htmlFor="enabled" className="text-xs">Enabled</Label>
            </div>
            <div>
              <Label className="text-xs">Sort</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} />
            </div>
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
