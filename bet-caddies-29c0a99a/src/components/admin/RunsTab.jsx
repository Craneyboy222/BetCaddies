import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from '@/components/ui/use-toast';

export default function RunsTab() {
  const queryClient = useQueryClient();

  const [pipelineRunMode, setPipelineRunMode] = useState('CURRENT_WEEK');
  const [pipelineDryRun, setPipelineDryRun] = useState(false);
  const [pipelineOverrideTour, setPipelineOverrideTour] = useState('');
  const [pipelineOverrideEventId, setPipelineOverrideEventId] = useState('');

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['researchRuns'],
    queryFn: () => api.entities.ResearchRun.list('-created_date', 20)
  });

  const checkPipelineHealthMutation = useMutation({
    mutationFn: async () => {
      const response = await api.entities.Health.pipeline()
      return response
    },
    onSuccess: (result) => {
      const ok = result?.ok === true
      toast({
        title: ok ? 'Pipeline module OK' : 'Pipeline module issue',
        description: ok
          ? 'Weekly pipeline module loaded successfully.'
          : (result?.error || 'Pipeline module not available.'),
        variant: ok ? undefined : 'destructive'
      })
    },
    onError: (error) => {
      toast({
        title: 'Pipeline health check failed',
        description: error?.message || 'Failed to check pipeline health',
        variant: 'destructive'
      })
    }
  })

  const checkDbHealthMutation = useMutation({
    mutationFn: async () => {
      const response = await api.entities.Health.db()
      return response
    },
    onSuccess: (result) => {
      const ok = result?.ok === true
      toast({
        title: ok ? 'DB OK' : 'DB issue',
        description: ok
          ? 'Database connectivity looks good.'
          : (result?.error || 'Database not available.'),
        variant: ok ? undefined : 'destructive'
      })
    },
    onError: (error) => {
      toast({
        title: 'DB health check failed',
        description: error?.message || 'Failed to check DB health',
        variant: 'destructive'
      })
    }
  })

  const triggerRunMutation = useMutation({
    mutationFn: async () => {
      const response = await api.functions.invoke('weeklyResearchPipeline', {
        dryRun: pipelineDryRun,
        run_mode: pipelineRunMode,
        override_tour: pipelineOverrideTour?.trim() || undefined,
        event_id: pipelineOverrideEventId?.trim() || undefined
      });
      return response;
    },
    onSuccess: (result) => {
      toast({
        title: 'Pipeline started',
        description: result?.runKey ? `Run key: ${result.runKey}` : 'Run queued successfully.'
      })
      queryClient.invalidateQueries({ queryKey: ['researchRuns'] });
      queryClient.invalidateQueries({ queryKey: ['allBets'] });

      // Give the server a moment to persist initial rows before refetch.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['researchRuns'] });
        queryClient.invalidateQueries({ queryKey: ['allBets'] });
      }, 1500)
    },
    onError: (error) => {
      const msg = error?.message || 'Failed to start pipeline'
      toast({
        title: 'Trigger run failed',
        description: msg,
        variant: 'destructive'
      })
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Research Runs</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => checkPipelineHealthMutation.mutate()}
            disabled={checkPipelineHealthMutation.isPending}
            className="border-slate-700 text-slate-200"
          >
            {checkPipelineHealthMutation.isPending ? 'Checking…' : 'Check Pipeline'}
          </Button>
          <Button
            variant="outline"
            onClick={() => checkDbHealthMutation.mutate()}
            disabled={checkDbHealthMutation.isPending}
            className="border-slate-700 text-slate-200"
          >
            {checkDbHealthMutation.isPending ? 'Checking…' : 'Check DB'}
          </Button>
          <Button
            onClick={() => triggerRunMutation.mutate()}
            disabled={triggerRunMutation.isPending}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            {triggerRunMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Trigger Run
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <p className="text-xs text-slate-400">Run mode</p>
          <Select value={pipelineRunMode} onValueChange={setPipelineRunMode}>
            <SelectTrigger className="bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CURRENT_WEEK">CURRENT_WEEK</SelectItem>
              <SelectItem value="THURSDAY_NEXT_WEEK">THURSDAY_NEXT_WEEK</SelectItem>
              <SelectItem value="WEEKLY">WEEKLY</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-slate-400">Override tour (optional)</p>
          <Input
            value={pipelineOverrideTour}
            onChange={(e) => setPipelineOverrideTour(e.target.value)}
            placeholder="PGA"
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-slate-400">Override event_id (optional)</p>
          <Input
            value={pipelineOverrideEventId}
            onChange={(e) => setPipelineOverrideEventId(e.target.value)}
            placeholder="4"
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div className="flex items-end justify-between rounded-lg border border-slate-700/60 bg-slate-800/30 px-3 py-2">
          <div>
            <p className="text-xs text-slate-400">Dry run</p>
            <p className="text-xs text-slate-500">Skip DB writes</p>
          </div>
          <Switch checked={pipelineDryRun} onCheckedChange={setPipelineDryRun} />
        </div>
      </div>

      {runsLoading ? (
        <LoadingSpinner />
      ) : runs.length === 0 ? (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
          <p className="text-slate-400">No runs yet. Trigger a run to generate picks.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map(run => (
            <div
              key={run.id}
              className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">{run.run_id}</div>
                  <div className="text-sm text-slate-400">
                    {run.week_start} to {run.week_end}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={
                    run.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                    run.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    run.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-slate-500/20 text-slate-400'
                  }>
                    {run.status}
                  </Badge>
                  <div className="text-sm text-slate-400">
                    {run.total_bets_published || 0} bets
                  </div>
                </div>
              </div>
              {run.error_summary && (
                <div className="mt-3 p-3 bg-red-500/10 rounded-lg text-sm text-red-400">
                  {run.error_summary}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
