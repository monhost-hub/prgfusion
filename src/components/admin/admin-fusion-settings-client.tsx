"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  initialPrompt: string;
  labels: Record<string, string>;
}

export function AdminFusionSettingsClient({ initialPrompt, labels }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fusion-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Save failed");
        return;
      }
      toast.success(labels.saved);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{labels.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{labels.subtitle}</p>

      <Card className="glass-card mt-6">
        <CardContent className="p-5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">{labels.prompt}</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={20}
            className="mt-2 font-mono text-xs"
            maxLength={8000}
          />
          <p className="mt-2 text-xs text-muted-foreground">{labels.promptHint}</p>
          <div className="mt-4 flex justify-end">
            <Button onClick={save} disabled={saving} className="bg-brand-gradient text-white hover:opacity-90">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {labels.save}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
