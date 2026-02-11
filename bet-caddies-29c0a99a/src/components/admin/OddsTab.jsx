import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, Trash2, Eye } from 'lucide-react';
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

function OddsOfferEditForm({ offer, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState({
    odds_decimal: offer.odds_decimal ?? '',
    odds_display: offer.odds_display ?? '',
    deep_link: offer.deep_link ?? ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      odds_decimal: form.odds_decimal === '' ? undefined : Number(form.odds_decimal),
      odds_display: form.odds_display === '' ? undefined : form.odds_display,
      deep_link: form.deep_link === '' ? '' : form.deep_link
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
        <div className="font-medium text-white">{offer.selection_name}</div>
        <div className="text-sm text-slate-400">{offer.bookmaker || '\u2014'} \u2022 {offer.market_key || '\u2014'}</div>
        <div className="text-xs text-slate-500">{offer.event_name || '\u2014'}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Odds (decimal)</label>
          <Input
            value={String(form.odds_decimal)}
            onChange={(e) => setForm({ ...form, odds_decimal: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Odds (display)</label>
          <Input
            value={form.odds_display}
            onChange={(e) => setForm({ ...form, odds_display: e.target.value })}
            className="bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-1">Deep Link (optional)</label>
        <Input
          value={form.deep_link}
          onChange={(e) => setForm({ ...form, deep_link: e.target.value })}
          className="bg-slate-800/50 border-slate-700 text-white"
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

function OddsEventDetailsView({ oddsEvent }) {
  const markets = Array.isArray(oddsEvent.markets) ? oddsEvent.markets : [];
  return (
    <div className="space-y-4">
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
            {oddsEvent.odds_provider}
          </Badge>
          <span className="text-xs text-slate-500">Markets: {markets.length}</span>
          {oddsEvent.fetched_at && (
            <span className="text-xs text-slate-500">Fetched: {new Date(oddsEvent.fetched_at).toLocaleString()}</span>
          )}
        </div>
        <div className="mt-2 font-semibold text-white">{oddsEvent.event_name || '\u2014'}</div>
        <div className="text-sm text-slate-400">External ID: {oddsEvent.external_event_id || '\u2014'}</div>
      </div>

      <div className="space-y-3">
        {markets.map((m) => (
          <div key={m.id} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium text-white">{m.market_key || 'Market'}</div>
              <div className="text-xs text-slate-500">Offers: {(m.offers || []).length}</div>
            </div>
            {(m.offers || []).length > 0 && (
              <div className="mt-3 space-y-2">
                {(m.offers || []).slice(0, 20).map(o => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <div className="text-slate-300 truncate pr-3">{o.selection_name}</div>
                    <div className="text-slate-400 flex-shrink-0">
                      {o.bookmaker || '\u2014'} \u2022 {o.odds_display || o.odds_decimal || '\u2014'}
                    </div>
                  </div>
                ))}
                {(m.offers || []).length > 20 && (
                  <div className="text-xs text-slate-500">Showing first 20 offers...</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {oddsEvent.raw && (
        <div>
          <div className="text-sm text-slate-300 mb-2">Raw JSON</div>
          <Textarea
            readOnly
            value={JSON.stringify(oddsEvent.raw, null, 2)}
            className="bg-slate-800/50 border-slate-700 text-white min-h-[220px]"
          />
        </div>
      )}
    </div>
  );
}

export default function OddsTab() {
  const [viewingOddsEventId, setViewingOddsEventId] = useState(null);
  const [editingOddsOffer, setEditingOddsOffer] = useState(null);
  const [oddsMarketIdFilter, setOddsMarketIdFilter] = useState('');
  const [oddsOffersLimit, setOddsOffersLimit] = useState(200);
  const queryClient = useQueryClient();

  const { data: oddsEvents = [], isLoading: oddsEventsLoading } = useQuery({
    queryKey: ['oddsEvents'],
    queryFn: () => api.entities.OddsEvent.list('-fetched_at', 50)
  });

  const { data: oddsOffers = [], isLoading: oddsOffersLoading } = useQuery({
    queryKey: ['oddsOffers', oddsMarketIdFilter, oddsOffersLimit],
    queryFn: () => api.entities.OddsOffer.list({
      odds_market_id: oddsMarketIdFilter?.trim() ? oddsMarketIdFilter.trim() : undefined,
      limit: oddsOffersLimit
    })
  });

  const { data: oddsEventDetails, isLoading: oddsEventDetailsLoading } = useQuery({
    queryKey: ['oddsEventDetails', viewingOddsEventId],
    enabled: !!viewingOddsEventId,
    queryFn: () => api.entities.OddsEvent.get(viewingOddsEventId)
  });

  const updateOddsOfferMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.OddsOffer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oddsOffers'] });
      setEditingOddsOffer(null);
    }
  });

  const deleteOddsOfferMutation = useMutation({
    mutationFn: (id) => api.entities.OddsOffer.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['oddsOffers'] })
  });

  return (
    <>
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Odds Events ({oddsEvents.length})</h2>
          </div>

          {oddsEventsLoading ? (
            <LoadingSpinner />
          ) : oddsEvents.length === 0 ? (
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
              <p className="text-slate-400">No odds events found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {oddsEvents.map(ev => (
                <div
                  key={ev.id}
                  className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                          {ev.odds_provider}
                        </Badge>
                        <span className="text-xs text-slate-500">Markets: {ev.markets_count || 0}</span>
                        {ev.fetched_at && (
                          <span className="text-xs text-slate-500">Fetched: {new Date(ev.fetched_at).toLocaleString()}</span>
                        )}
                      </div>
                      <div className="font-semibold text-white">{ev.event_name || '\u2014'}</div>
                      <div className="text-sm text-slate-400">
                        {ev.tour || '\u2014'} \u2022 External ID: {ev.external_event_id || '\u2014'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewingOddsEventId(ev.id)}
                        className="text-slate-400 hover:text-white"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-bold text-white">Odds Offers ({oddsOffers.length})</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                value={oddsMarketIdFilter}
                onChange={(e) => setOddsMarketIdFilter(e.target.value)}
                placeholder="Filter by odds_market_id (optional)"
                className="w-80 bg-slate-800/50 border-slate-700 text-white"
              />
              <Input
                value={String(oddsOffersLimit)}
                onChange={(e) => setOddsOffersLimit(Number(e.target.value || 200))}
                placeholder="Limit"
                className="w-24 bg-slate-800/50 border-slate-700 text-white"
              />
            </div>
          </div>

          {oddsOffersLoading ? (
            <LoadingSpinner />
          ) : oddsOffers.length === 0 ? (
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
              <p className="text-slate-400">No odds offers found.</p>
            </div>
          ) : (
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Selection</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Book</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Odds</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Event</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Fetched</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {oddsOffers.map((offer, idx) => (
                    <tr key={offer.id} className={idx !== oddsOffers.length - 1 ? 'border-b border-slate-700/30' : ''}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{offer.selection_name}</div>
                        <div className="text-xs text-slate-500">{offer.market_key || '\u2014'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">{offer.bookmaker || '\u2014'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {offer.odds_display || offer.odds_decimal || '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {offer.event_name || '\u2014'}
                        <div className="text-xs text-slate-500">{offer.tour || '\u2014'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {offer.fetched_at ? new Date(offer.fetched_at).toLocaleString() : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingOddsOffer(offer)}
                            className="text-slate-400 hover:text-white"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteOddsOfferMutation.mutate(offer.id)}
                            className="text-slate-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* View Odds Event Dialog */}
      <Dialog open={!!viewingOddsEventId} onOpenChange={() => setViewingOddsEventId(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Odds Event Details</DialogTitle>
          </DialogHeader>
          {oddsEventDetailsLoading ? (
            <LoadingSpinner />
          ) : oddsEventDetails ? (
            <OddsEventDetailsView oddsEvent={oddsEventDetails} />
          ) : (
            <div className="text-slate-400">No details found.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Odds Offer Dialog */}
      <Dialog open={!!editingOddsOffer} onOpenChange={() => setEditingOddsOffer(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Odds Offer</DialogTitle>
          </DialogHeader>
          {editingOddsOffer && (
            <OddsOfferEditForm
              offer={editingOddsOffer}
              onSave={(data) => updateOddsOfferMutation.mutate({ id: editingOddsOffer.id, data })}
              onCancel={() => setEditingOddsOffer(null)}
              isSaving={updateOddsOfferMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
