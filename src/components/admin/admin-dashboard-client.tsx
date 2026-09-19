"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Users, Sparkles, CheckCircle2, AlertTriangle, Cpu, DollarSign, Clock } from "lucide-react";

interface Stats {
  users: number;
  generations: number;
  succeeded: number;
  failed: number;
  successRate: number;
  last30: number;
  activeModel: { id: string; name: string; providerId: string } | null;
  estimatedCost: number;
}

interface Props {
  title: string;
  subtitle: string;
  labels: {
    users: string;
    generations: string;
    successRate: string;
    errors: string;
    activeModel: string;
    estimatedCost: string;
    lastGeneration: string;
  };
}

export function AdminDashboardClient({ title, subtitle, labels }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={<Users className="h-4 w-4" />} label={labels.users} value={stats?.users?.toString() ?? "—"} />
        <StatCard icon={<Sparkles className="h-4 w-4" />} label={labels.generations} value={stats?.generations?.toString() ?? "—"} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label={labels.successRate} value={stats ? `${stats.successRate}%` : "—"} />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label={labels.errors} value={stats?.failed?.toString() ?? "—"} />
        <StatCard
          icon={<Cpu className="h-4 w-4" />}
          label={labels.activeModel}
          value={stats?.activeModel?.name ?? "—"}
          sub={stats?.activeModel?.providerId}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label={labels.estimatedCost}
          value={stats ? `$${stats.estimatedCost.toFixed(4)}` : "—"}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <p className="mt-1 text-2xl font-bold truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </CardContent>
    </Card>
  );
}
