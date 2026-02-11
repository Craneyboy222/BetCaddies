import React from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

export default function IssuesTab() {
  const queryClient = useQueryClient();

  const { data: issues = [] } = useQuery({
    queryKey: ['dataQualityIssues'],
    queryFn: () => api.entities.DataQualityIssue.filter({ resolved: false }, '-created_date', 50)
  });

  const resolveIssueMutation = useMutation({
    mutationFn: (id) => api.entities.DataQualityIssue.update(id, { resolved: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dataQualityIssues'] })
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Data Quality Issues</h2>

      {issues.length === 0 ? (
        <div className="bg-emerald-500/10 rounded-xl border border-emerald-500/30 p-8 text-center">
          <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-emerald-400">No open issues</p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map(issue => (
            <div
              key={issue.id}
              className={`rounded-xl border p-4 ${
                issue.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                issue.severity === 'error' ? 'bg-orange-500/10 border-orange-500/30' :
                issue.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                'bg-slate-800/30 border-slate-700/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={
                      issue.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                      issue.severity === 'error' ? 'bg-orange-500/20 text-orange-400' :
                      issue.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-500/20 text-slate-400'
                    }>
                      {issue.severity}
                    </Badge>
                    {issue.tour && <Badge variant="outline">{issue.tour}</Badge>}
                    <span className="text-xs text-slate-500">{issue.step}</span>
                  </div>
                  <div className="text-white">{issue.issue}</div>
                  {issue.evidence && (
                    <div className="text-sm text-slate-400 mt-2">{issue.evidence}</div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resolveIssueMutation.mutate(issue.id)}
                  className="text-slate-400 hover:text-emerald-400"
                >
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
