import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function SiteContentEditor({ contentKey, value, onChange }) {
  const [rawJson, setRawJson] = useState('');

  useEffect(() => {
    try {
      setRawJson(JSON.stringify(value ?? {}, null, 2));
    } catch (e) {
      setRawJson('');
    }
  }, [value]);

  const setHeroField = (field, nextValue) => {
    onChange({
      ...(value ?? {}),
      hero: {
        ...((value ?? {}).hero ?? {}),
        [field]: nextValue
      }
    });
  };

  const features = Array.isArray(value?.features) ? value.features : [];
  const faqs = Array.isArray(value?.faqs) ? value.faqs : [];

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
        <div className="text-sm text-slate-300 font-medium mb-3">Hero</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Title</label>
            <Input
              value={value?.hero?.title || ''}
              onChange={(e) => setHeroField('title', e.target.value)}
              className="bg-slate-800 border-slate-700"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Subtitle</label>
            <Input
              value={value?.hero?.subtitle || ''}
              onChange={(e) => setHeroField('subtitle', e.target.value)}
              className="bg-slate-800 border-slate-700"
            />
          </div>
        </div>
      </div>

      {contentKey === 'home' && (
        <>
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-300 font-medium">Feature Bullets</div>
              <Button
                variant="outline"
                className="border-slate-600"
                onClick={() => onChange({
                  ...(value ?? {}),
                  features: [...features, { title: '', body: '' }]
                })}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="space-y-3">
              {features.length === 0 ? (
                <div className="text-sm text-slate-500">No feature bullets yet.</div>
              ) : (
                features.map((f, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-start">
                    <div className="col-span-4">
                      <Input
                        value={f?.title || ''}
                        onChange={(e) => {
                          const next = [...features];
                          next[idx] = { ...(next[idx] || {}), title: e.target.value };
                          onChange({ ...(value ?? {}), features: next });
                        }}
                        className="bg-slate-800 border-slate-700"
                        placeholder="Title"
                      />
                    </div>
                    <div className="col-span-7">
                      <Input
                        value={f?.body || ''}
                        onChange={(e) => {
                          const next = [...features];
                          next[idx] = { ...(next[idx] || {}), body: e.target.value };
                          onChange({ ...(value ?? {}), features: next });
                        }}
                        className="bg-slate-800 border-slate-700"
                        placeholder="Description"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const next = features.filter((_, i) => i !== idx);
                          onChange({ ...(value ?? {}), features: next });
                        }}
                        className="text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-300 font-medium">FAQs</div>
              <Button
                variant="outline"
                className="border-slate-600"
                onClick={() => onChange({
                  ...(value ?? {}),
                  faqs: [...faqs, { q: '', a: '' }]
                })}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="space-y-3">
              {faqs.length === 0 ? (
                <div className="text-sm text-slate-500">No FAQs yet.</div>
              ) : (
                faqs.map((f, idx) => (
                  <div key={idx} className="space-y-2 border border-slate-700/50 rounded-lg p-3 bg-slate-900/30">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-500">FAQ #{idx + 1}</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const next = faqs.filter((_, i) => i !== idx);
                          onChange({ ...(value ?? {}), faqs: next });
                        }}
                        className="text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Input
                      value={f?.q || ''}
                      onChange={(e) => {
                        const next = [...faqs];
                        next[idx] = { ...(next[idx] || {}), q: e.target.value };
                        onChange({ ...(value ?? {}), faqs: next });
                      }}
                      className="bg-slate-800 border-slate-700"
                      placeholder="Question"
                    />
                    <Textarea
                      value={f?.a || ''}
                      onChange={(e) => {
                        const next = [...faqs];
                        next[idx] = { ...(next[idx] || {}), a: e.target.value };
                        onChange({ ...(value ?? {}), faqs: next });
                      }}
                      className="bg-slate-800 border-slate-700 text-white min-h-[90px]"
                      placeholder="Answer"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-slate-300 font-medium">Raw JSON</div>
          <Button
            variant="outline"
            className="border-slate-600"
            onClick={() => {
              try {
                const parsed = JSON.parse(rawJson || '{}');
                onChange(parsed);
              } catch (e) {
                alert('Invalid JSON');
              }
            }}
          >
            Apply JSON
          </Button>
        </div>
        <Textarea
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          className="bg-slate-800/50 border-slate-700 text-white min-h-[220px]"
        />
      </div>
    </div>
  );
}

export default function ContentTab() {
  const [contentKey, setContentKey] = useState('home');
  const [contentDraft, setContentDraft] = useState(null);
  const queryClient = useQueryClient();

  const { data: siteContentItems = [], isLoading: siteContentLoading } = useQuery({
    queryKey: ['siteContentAdmin'],
    queryFn: () => api.entities.SiteContent.list()
  });

  const upsertSiteContentMutation = useMutation({
    mutationFn: ({ key, json }) => api.entities.SiteContent.upsert(key, json),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siteContentAdmin'] });
    }
  });

  useEffect(() => {
    const defaultsByKey = {
      home: {
        hero: {
          title: 'Your Weekly Golf Picks',
          subtitle: '30 curated bets across 5 tours. Data-driven selections with transparent analysis and real value.'
        },
        features: [
          { title: 'Curated, weekly', body: 'Fresh picks every week across multiple tours.' },
          { title: 'Transparent analysis', body: 'Clear reasoning behind every recommendation.' },
          { title: 'Editorial control', body: 'Pinned picks and tier overrides for curation.' }
        ],
        faqs: [
          { q: 'Are these guaranteed winners?', a: 'No. We provide analysis and information \u2014 not guarantees.' },
          { q: 'How often do picks update?', a: 'Weekly (and occasionally mid-week if markets change).' }
        ]
      },
      join: {
        hero: {
          title: 'Welcome to Bet Caddies',
          subtitle: 'Your premium golf betting companion'
        }
      },
      memberships: {
        hero: {
          title: 'Premium Membership',
          subtitle: 'Unlock exclusive features and maximize your betting success'
        }
      }
    };

    const found = siteContentItems.find((i) => i.key === contentKey);
    setContentDraft(found?.json ?? defaultsByKey[contentKey] ?? {});
  }, [contentKey, siteContentItems]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Site Content</h2>
          <p className="text-sm text-slate-400">Edit marketing copy, feature bullets, and FAQs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={contentKey} onValueChange={setContentKey}>
            <SelectTrigger className="bg-slate-800 border-slate-700 w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="home">home</SelectItem>
              <SelectItem value="join">join</SelectItem>
              <SelectItem value="memberships">memberships</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => upsertSiteContentMutation.mutate({ key: contentKey, json: contentDraft })}
            disabled={upsertSiteContentMutation.isPending || !contentDraft}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            {upsertSiteContentMutation.isPending ? 'Saving\u2026' : 'Save'}
          </Button>
        </div>
      </div>

      {siteContentLoading ? (
        <LoadingSpinner />
      ) : (
        <SiteContentEditor
          contentKey={contentKey}
          value={contentDraft}
          onChange={setContentDraft}
        />
      )}
    </div>
  );
}
