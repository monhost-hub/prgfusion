"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Zap, CheckCircle2, XCircle, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  hasKey: boolean;
  labels: Record<string, string>;
}

export function AdminOpenRouterClient({ hasKey, labels }: Props) {
  const [status, setStatus] = useState<{ configured: boolean; maskedKey: string | null; activeModel: any } | null>(null);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/openrouter")
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  async function test() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/openrouter/test", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${labels.testOk} (${data.latencyMs}ms)`);
      } else {
        toast.error(labels.testFail.replace("{error}", data.error || "error"));
      }
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{labels.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{labels.subtitle}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Plug className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{labels.status}</span>
            </div>
            {status?.configured ? (
              <div className="space-y-1">
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {labels.statusOk}
                </Badge>
                {status.maskedKey && (
                  <p className="text-xs font-mono text-muted-foreground mt-2">{status.maskedKey}</p>
                )}
              </div>
            ) : (
              <Badge className="bg-destructive/15 text-destructive inline-flex items-center gap-1">
                <XCircle className="h-3 w-3" /> {labels.statusMissing}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{labels.activeModel}</span>
            </div>
            {status?.activeModel ? (
              <div>
                <p className="font-medium">{status.activeModel.name}</p>
                <p className="text-xs font-mono text-muted-foreground">{status.activeModel.providerId}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{labels.apiKey}</p>
        <p className="text-sm text-muted-foreground max-w-2xl">{labels.apiKeyHint}</p>
        <Button onClick={test} disabled={testing || !hasKey} className="mt-3 bg-brand-gradient text-white hover:opacity-90">
          {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
          {labels.test}
        </Button>
      </div>
    </div>
  );
}
