"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  generations: Array<{
    id: string;
    status: string;
    durationMs: number | null;
    estimatedCost: number;
    error: string | null;
    createdAt: string;
    userEmail: string;
    modelName: string;
  }>;
  labels: Record<string, string>;
}

export function AdminGenerationsClient({ generations, labels }: Props) {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{labels.title}</h1>
      <Card className="glass-card mt-6 overflow-hidden">
        <div className="overflow-x-auto scroll-styled max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-4 py-3">{labels.colDate}</th>
                <th className="text-left px-4 py-3">{labels.colUser}</th>
                <th className="text-left px-4 py-3">{labels.colModel}</th>
                <th className="text-left px-4 py-3">{labels.colStatus}</th>
                <th className="text-left px-4 py-3">{labels.colDuration}</th>
                <th className="text-left px-4 py-3">{labels.colCost}</th>
                <th className="text-left px-4 py-3">{labels.colError}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {generations.map((g) => (
                <tr key={g.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(g.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 truncate max-w-[160px]">{g.userEmail}</td>
                  <td className="px-4 py-3">{g.modelName}</td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        g.status === "succeeded"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : g.status === "failed"
                            ? "bg-destructive/15 text-destructive"
                            : g.status === "running"
                              ? "bg-blue-500/15 text-blue-500"
                              : ""
                      }
                    >
                      {g.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {g.durationMs ? `${(g.durationMs / 1000).toFixed(1)}s` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {g.estimatedCost ? `$${g.estimatedCost.toFixed(4)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[200px]">
                    {g.error ?? "—"}
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
