import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function TourEventEditForm({ event, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState({
    tour: event.tour || '',
    event_name: event.event_name || '',
    start_date: event.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : '',
    end_date: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : '',
    location: event.location || '',
    course_name: event.course_name || '',
    course_lat: event.course_lat ?? '',
    course_lng: event.course_lng ?? '',
    source_urls: Array.isArray(event.source_urls) ? event.source_urls.join('\n') : ''
  });

  const toIsoStringOrUndefined = (value) => {
    if (!value) return undefined;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return undefined;
    return dt.toISOString();
  };

  const parseNumberOr = (value, fallback) => {
    if (value === '' || value === undefined || value === null) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      tour: form.tour,
      event_name: form.event_name,
      start_date: toIsoStringOrUndefined(form.start_date),
      end_date: toIsoStringOrUndefined(form.end_date),
      location: form.location || undefined,
      course_name: form.course_name || undefined,
      course_lat: form.course_lat === '' ? null : parseNumberOr(form.course_lat, null),
      course_lng: form.course_lng === '' ? null : parseNumberOr(form.course_lng, null),
      source_urls: form.source_urls
        ? form.source_urls.split('\n').map(s => s.trim()).filter(Boolean)
        : []
    };
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Tour</label>
          <Input
            value={form.tour}
            onChange={(e) => setForm({ ...form, tour: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Event Name</label>
          <Input
            value={form.event_name}
            onChange={(e) => setForm({ ...form, event_name: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Start (local)</label>
          <Input
            type="datetime-local"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">End (local)</label>
          <Input
            type="datetime-local"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Location</label>
          <Input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Course Name</label>
          <Input
            value={form.course_name}
            onChange={(e) => setForm({ ...form, course_name: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Course Lat</label>
          <Input
            value={String(form.course_lat)}
            onChange={(e) => setForm({ ...form, course_lat: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Course Lng</label>
          <Input
            value={String(form.course_lng)}
            onChange={(e) => setForm({ ...form, course_lng: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-1">Source URLs (one per line)</label>
        <Textarea
          value={form.source_urls}
          onChange={(e) => setForm({ ...form, source_urls: e.target.value })}
          className="bg-slate-800/50 border-slate-700 text-white min-h-[120px]"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-slate-300 hover:text-white">
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} className="bg-emerald-500 hover:bg-emerald-600">
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

export default function TourEventsTab() {
  const [editingTourEvent, setEditingTourEvent] = useState(null);
  const queryClient = useQueryClient();

  const { data: tourEvents = [], isLoading: tourEventsLoading } = useQuery({
    queryKey: ['tourEvents'],
    queryFn: () => api.entities.TourEvent.list('-start_date', 50)
  });

  const updateTourEventMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.TourEvent.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourEvents'] });
      setEditingTourEvent(null);
    }
  });

  const deleteTourEventMutation = useMutation({
    mutationFn: (id) => api.entities.TourEvent.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tourEvents'] })
  });

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Tour Events ({tourEvents.length})</h2>
        </div>

        {tourEventsLoading ? (
          <LoadingSpinner />
        ) : tourEvents.length === 0 ? (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
            <p className="text-slate-400">No tour events found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tourEvents.map(ev => (
              <div
                key={ev.id}
                className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                        {ev.tour}
                      </Badge>
                      {ev.start_date && (
                        <span className="text-xs text-slate-500">
                          {new Date(ev.start_date).toLocaleDateString()} → {ev.end_date ? new Date(ev.end_date).toLocaleDateString() : '-'}
                        </span>
                      )}
                      {ev.run_id && (
                        <Badge variant="outline" className="bg-slate-700/50 text-slate-400 border-slate-600">
                          Run: {ev.run_id}
                        </Badge>
                      )}
                    </div>
                    <div className="font-semibold text-white">{ev.event_name}</div>
                    <div className="text-sm text-slate-400">
                      {ev.location || '\u2014'}{ev.course_name ? ` \u2022 ${ev.course_name}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingTourEvent(ev)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTourEventMutation.mutate(ev.id)}
                      className="text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Tour Event Dialog */}
      <Dialog open={!!editingTourEvent} onOpenChange={() => setEditingTourEvent(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Tour Event</DialogTitle>
          </DialogHeader>
          {editingTourEvent && (
            <TourEventEditForm
              event={editingTourEvent}
              onSave={(data) => updateTourEventMutation.mutate({ id: editingTourEvent.id, data })}
              onCancel={() => setEditingTourEvent(null)}
              isSaving={updateTourEventMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
