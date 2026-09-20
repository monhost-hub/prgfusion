"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, CheckCircle2, XCircle, Edit, History, Save, X, Coins, Euro,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

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
  whopPlanId: string | null;
  whopCheckoutUrl: string | null;
  billingPeriod: string | null;
  updatedAt: string;
  _count?: { whopPayments: number; planChanges: number };
}

interface Payment {
  id: string;
  whopPaymentId: string;
  userId: string;
  amount: number;
  currency: string;
  credits: number;
  status: string;
  createdAt: string;
  plan: { slug: string; nameJson: string } | null;
}

interface WhopEvent {
  id: string;
  whopEventId: string;
  eventType: string;
  userId: string | null;
  planSlug: string | null;
  status: string;
  creditsGranted: number;
  error: string | null;
  createdAt: string;
}

interface Props {
  labels: Record<string, string>;
}

export function AdminPaymentsClient({ labels }: Props) {
  const [loading, setLoading] = useState(true);
  const [whopConfigured, setWhopConfigured] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [events, setEvents] = useState<WhopEvent[]>([]);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [historyPlanId, setHistoryPlanId] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payments");
      const data = await res.json();
      setWhopConfigured(data.whopConfigured);
      setTotalRevenue(data.totalRevenue || 0);
      setPlans(data.plans || []);
      setPayments(data.recentPayments || []);
      setEvents(data.recentEvents || []);
    } catch {
      toast.error("Failed to load payments data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function loadHistory(planId: string) {
    setHistoryPlanId(planId);
    setHistory([]);
    try {
      const res = await fetch(`/api/admin/payments/plans/${planId}`);
      const data = await res.json();
      setHistory(data.history || []);
    } catch {
      toast.error("Failed to load history");
    }
  }

  function nameOf(plan: Plan): string {
    try {
      const obj = JSON.parse(plan.nameJson);
      return obj.fr || obj.en || plan.slug;
    } catch {
      return plan.slug;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{labels.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{labels.subtitle}</p>

      {/* === Status + revenue === */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{labels.configStatus}</p>
              {whopConfigured ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {labels.configured}
                </Badge>
              ) : (
                <Badge className="bg-destructive/15 text-destructive">
                  <XCircle className="h-3 w-3 mr-1" /> {labels.notConfigured}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{labels.totalRevenue}</p>
            <p className="mt-1 text-2xl font-bold flex items-center gap-1">
              <Euro className="h-5 w-5 text-emerald-500" />
              {totalRevenue.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* === Plans table === */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-1">{labels.plansTitle}</h2>
        <p className="text-xs text-muted-foreground mb-4">{labels.plansSubtitle}</p>
        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto scroll-styled">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-3">{labels.colName}</th>
                  <th className="text-left px-3 py-3">{labels.colPrice}</th>
                  <th className="text-left px-3 py-3">{labels.colCredits}</th>
                  <th className="text-left px-3 py-3">{labels.colWhopPlanId}</th>
                  <th className="text-left px-3 py-3">{labels.colBilling}</th>
                  <th className="text-left px-3 py-3">{labels.colEnabled}</th>
                  <th className="text-left px-3 py-3">{labels.colFeatured}</th>
                  <th className="text-right px-3 py-3">{labels.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <div className="font-medium">{nameOf(p)}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p.slug}</div>
                    </td>
                    <td className="px-3 py-3">€{p.priceMonthly.toFixed(2)} <span className="text-xs text-muted-foreground">{p.currency}</span></td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1">
                        <Coins className="h-3 w-3 text-amber-500" />
                        {p.credits}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {p.whopPlanId ? (
                        <span className="text-emerald-600 dark:text-emerald-400">{p.whopPlanId}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">{p.billingPeriod ?? "—"}</td>
                    <td className="px-3 py-3">
                      {p.enabled ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">on</Badge>
                      ) : (
                        <Badge variant="outline">off</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">{p.featured ? "★" : "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditingPlan(p)} title={labels.edit}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => loadHistory(p.id)} title={labels.history}>
                          <History className="h-3.5 w-3.5" />
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

      {/* === Recent payments === */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">{labels.paymentsTitle}</h2>
        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto scroll-styled max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left px-3 py-3">{labels.colDate}</th>
                  <th className="text-left px-3 py-3">{labels.colUser}</th>
                  <th className="text-left px-3 py-3">{labels.colPlan}</th>
                  <th className="text-left px-3 py-3">{labels.colAmount}</th>
                  <th className="text-left px-3 py-3">{labels.colCredits}</th>
                  <th className="text-left px-3 py-3">{labels.colStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {payments.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{labels.noData}</td></tr>
                ) : payments.map((pmt) => (
                  <tr key={pmt.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(pmt.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-xs">{pmt.userId.slice(0, 12)}…</td>
                    <td className="px-3 py-2">{pmt.plan?.slug ?? "—"}</td>
                    <td className="px-3 py-2">€{pmt.amount.toFixed(2)} {pmt.currency}</td>
                    <td className="px-3 py-2"><span className="inline-flex items-center gap-1"><Coins className="h-3 w-3 text-amber-500" />{pmt.credits}</span></td>
                    <td className="px-3 py-2">
                      <Badge className={
                        pmt.status === "succeeded" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : pmt.status === "failed" ? "bg-destructive/15 text-destructive"
                        : ""
                      }>{pmt.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* === Recent webhook events === */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">{labels.eventsTitle}</h2>
        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto scroll-styled max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left px-3 py-3">{labels.colDate}</th>
                  <th className="text-left px-3 py-3">{labels.colEventType}</th>
                  <th className="text-left px-3 py-3">{labels.colStatus}</th>
                  <th className="text-left px-3 py-3">{labels.colCreditsGranted}</th>
                  <th className="text-left px-3 py-3">{labels.colUser}</th>
                  <th className="text-left px-3 py-3">{labels.colError}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {events.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{labels.noData}</td></tr>
                ) : events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(evt.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-xs">{evt.eventType}</td>
                    <td className="px-3 py-2">
                      <Badge className={
                        evt.status === "succeeded" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : evt.status === "failed" || evt.status === "no_user" || evt.status === "unknown_plan" ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground"
                      }>{evt.status}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {evt.creditsGranted > 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <Coins className="h-3 w-3" />+{evt.creditsGranted}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{evt.userId ? evt.userId.slice(0, 12) + "…" : "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate" title={evt.error ?? ""}>{evt.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* === Edit plan dialog === */}
      {editingPlan && (
        <EditPlanDialog
          plan={editingPlan}
          labels={labels}
          onClose={() => setEditingPlan(null)}
          onSaved={() => {
            setEditingPlan(null);
            refresh();
          }}
        />
      )}

      {/* === History dialog === */}
      {historyPlanId && (
        <Dialog open={true} onOpenChange={(v) => !v && setHistoryPlanId(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{labels.history}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto scroll-styled">
              {history.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">{labels.noData}</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left py-2">Date</th>
                      <th className="text-left py-2">Champ</th>
                      <th className="text-left py-2">Avant</th>
                      <th className="text-left py-2">Après</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-t border-border/40">
                        <td className="py-2 text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</td>
                        <td className="py-2 font-mono">{h.field}</td>
                        <td className="py-2 text-muted-foreground truncate max-w-[150px]">{h.oldValue ?? "—"}</td>
                        <td className="py-2 truncate max-w-[150px]">{h.newValue ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function EditPlanDialog({
  plan, labels, onClose, onSaved,
}: {
  plan: Plan; labels: Record<string, string>; onClose: () => void; onSaved: () => void;
}) {
  let parsed: any = {};
  try { parsed = JSON.parse(plan.nameJson); } catch {}

  const [nameEn, setNameEn] = useState(parsed.en || "");
  const [nameFr, setNameFr] = useState(parsed.fr || "");
  const [nameEs, setNameEs] = useState(parsed.es || "");
  const [description, setDescription] = useState(plan.description);
  const [priceMonthly, setPriceMonthly] = useState(plan.priceMonthly);
  const [credits, setCredits] = useState(plan.credits);
  const [currency, setCurrency] = useState(plan.currency);
  const [whopPlanId, setWhopPlanId] = useState(plan.whopPlanId || "");
  const [whopCheckoutUrl, setWhopCheckoutUrl] = useState(plan.whopCheckoutUrl || "");
  const [billingPeriod, setBillingPeriod] = useState(plan.billingPeriod || "monthly");
  const [featured, setFeatured] = useState(plan.featured);
  const [enabled, setEnabled] = useState(plan.enabled);
  const [sortOrder, setSortOrder] = useState(plan.sortOrder);
  const [saving, setSaving] = useState(false);

  // Confirmation state for sensitive fields
  const [confirming, setConfirming] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/payments/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameEn, nameFr, nameEs, description,
          priceMonthly: Number(priceMonthly),
          credits: Number(credits),
          currency,
          whopPlanId: whopPlanId || null,
          whopCheckoutUrl: whopCheckoutUrl || null,
          billingPeriod: billingPeriod || null,
          featured, enabled, sortOrder: Number(sortOrder),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Save failed");
        return;
      }
      toast.success(`Plan mis à jour (${data.changesLogged} champ(s) modifié(s))`);
      onSaved();
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  }

  // Sensitive change detection
  const sensitiveChanged =
    whopPlanId !== (plan.whopPlanId || "") ||
    whopCheckoutUrl !== (plan.whopCheckoutUrl || "") ||
    Number(priceMonthly) !== plan.priceMonthly ||
    Number(credits) !== plan.credits;

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{labels.edit} — {plan.slug}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto scroll-styled pr-1">
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Nom EN</Label><Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></div>
            <div><Label className="text-xs">Nom FR</Label><Input value={nameFr} onChange={(e) => setNameFr(e.target.value)} /></div>
            <div><Label className="text-xs">Nom ES</Label><Input value={nameEs} onChange={(e) => setNameEs(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Prix mensuel (€)</Label><Input type="number" step="0.01" value={priceMonthly} onChange={(e) => setPriceMonthly(parseFloat(e.target.value) || 0)} /></div>
            <div><Label className="text-xs">Crédits</Label><Input type="number" value={credits} onChange={(e) => setCredits(parseInt(e.target.value) || 0)} /></div>
            <div><Label className="text-xs">Devise</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} /></div>
          </div>
          <div><Label className="text-xs">Whop Plan ID</Label><Input value={whopPlanId} onChange={(e) => setWhopPlanId(e.target.value)} placeholder="plan_xxx" /></div>
          <div><Label className="text-xs">Whop Checkout URL (optionnel)</Label><Input value={whopCheckoutUrl} onChange={(e) => setWhopCheckoutUrl(e.target.value)} placeholder="https://whop.com/checkout/..." /></div>
          <div>
            <Label className="text-xs">Période de facturation</Label>
            <select
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
              <option value="one_time">one_time</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2 items-center">
            <div className="flex items-center gap-2">
              <Switch checked={featured} onCheckedChange={setFeatured} id="featured" />
              <Label htmlFor="featured" className="text-xs">Populaire</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={enabled} onCheckedChange={setEnabled} id="enabled" />
              <Label htmlFor="enabled" className="text-xs">Actif</Label>
            </div>
            <div><Label className="text-xs">Ordre</Label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} /></div>
          </div>

          {sensitiveChanged && !confirming && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">⚠ Modification sensible détectée</p>
              <p className="text-muted-foreground">Tu modifies un champ critique (prix, crédits, ou Plan ID Whop). Confirme que c'est intentionnel.</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setConfirming(true)}>
                Confirmer la modification
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{labels.cancel}</Button>
          <Button
            onClick={save}
            disabled={saving || (sensitiveChanged && !confirming)}
            className="bg-brand-gradient text-white hover:opacity-90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
