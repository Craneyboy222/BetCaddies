import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const BLOCK_DEFINITIONS = {
  hero: {
    label: 'Hero',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'textarea' },
      { key: 'imageUrl', label: 'Image URL', type: 'text' },
      { key: 'ctaText', label: 'CTA Text', type: 'text' },
      { key: 'ctaUrl', label: 'CTA URL', type: 'text' }
    ]
  },
  banner: {
    label: 'Banner',
    fields: [
      { key: 'text', label: 'Text', type: 'text' },
      { key: 'tone', label: 'Tone', type: 'select', options: ['info', 'success', 'warning', 'danger'] },
      { key: 'url', label: 'Link URL', type: 'text' },
      { key: 'imageUrl', label: 'Image URL', type: 'text' },
      { key: 'imageAlt', label: 'Image Alt', type: 'text' }
    ]
  },
  text: {
    label: 'Text',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'body', label: 'Body', type: 'textarea' }
    ]
  },
  image: {
    label: 'Image',
    fields: [
      { key: 'url', label: 'Image URL', type: 'text' },
      { key: 'alt', label: 'Alt text', type: 'text' },
      { key: 'caption', label: 'Caption', type: 'textarea' }
    ]
  },
  cta: {
    label: 'Call to Action',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'text', label: 'Text', type: 'textarea' },
      { key: 'buttonText', label: 'Button Text', type: 'text' },
      { key: 'buttonUrl', label: 'Button URL', type: 'text' }
    ]
  },
  feature_grid: {
    label: 'Feature Grid',
    fields: [
      { key: 'title', label: 'Section Title', type: 'text' },
      { key: 'items', label: 'Items (JSON array)', type: 'json' }
    ]
  },
  faq: {
    label: 'FAQ',
    fields: [
      { key: 'title', label: 'Section Title', type: 'text' },
      { key: 'items', label: 'Questions (JSON array)', type: 'json' }
    ]
  },
  form: {
    label: 'Form',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'textarea' },
      { key: 'buttonText', label: 'Button Text', type: 'text' },
      { key: 'disclaimer', label: 'Disclaimer', type: 'textarea' }
    ]
  }
};

const PAGE_TEMPLATES = [
  { key: 'blank', label: 'Blank', blocks: [] },
  {
    key: 'landing',
    label: 'Landing',
    blocks: [
      { type: 'hero', data: {} },
      { type: 'feature_grid', data: { items: [] } },
      { type: 'cta', data: {} }
    ]
  },
  {
    key: 'content',
    label: 'Content',
    blocks: [
      { type: 'hero', data: {} },
      { type: 'text', data: {} },
      { type: 'image', data: {} },
      { type: 'faq', data: { items: [] } }
    ]
  }
];

export default function PagesTab() {
  const [pageSearch, setPageSearch] = useState('');
  const [editingPage, setEditingPage] = useState(null);
  const [pageDraft, setPageDraft] = useState(null);
  const [creatingPage, setCreatingPage] = useState(false);
  const queryClient = useQueryClient();

  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ['cmsPages'],
    queryFn: () => api.entities.Page.list()
  });

  const createPageMutation = useMutation({
    mutationFn: (data) => api.entities.Page.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cmsPages'] });
      setCreatingPage(false);
      setEditingPage(null);
      setPageDraft(null);
    }
  });

  const updatePageMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Page.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cmsPages'] });
      setEditingPage(null);
      setPageDraft(null);
    }
  });

  const deletePageMutation = useMutation({
    mutationFn: (id) => api.entities.Page.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cmsPages'] })
  });

  const buildTemplateBlocks = (templateKey) => {
    const tpl = PAGE_TEMPLATES.find((item) => item.key === templateKey);
    if (!tpl) return [];
    return JSON.parse(JSON.stringify(tpl.blocks || []));
  };

  const openCreatePage = () => {
    setCreatingPage(true);
    setEditingPage(null);
    setPageDraft({
      slug: '',
      title: '',
      status: 'draft',
      template_key: 'blank',
      blocks: []
    });
  };

  const openEditPage = (page) => {
    setCreatingPage(false);
    setEditingPage(page);
    setPageDraft({
      id: page.id,
      slug: page.slug,
      title: page.title,
      status: page.status || 'draft',
      template_key: page.template_key || 'blank',
      blocks: Array.isArray(page.blocks) ? page.blocks : []
    });
  };

  const updatePageDraft = (updates) => {
    setPageDraft((prev) => ({ ...prev, ...updates }));
  };

  const updateBlock = (index, updates) => {
    setPageDraft((prev) => {
      const blocks = Array.isArray(prev?.blocks) ? [...prev.blocks] : [];
      blocks[index] = { ...blocks[index], ...updates };
      return { ...prev, blocks };
    });
  };

  const removeBlock = (index) => {
    setPageDraft((prev) => {
      const blocks = Array.isArray(prev?.blocks) ? [...prev.blocks] : [];
      blocks.splice(index, 1);
      return { ...prev, blocks };
    });
  };

  const moveBlock = (index, direction) => {
    setPageDraft((prev) => {
      const blocks = Array.isArray(prev?.blocks) ? [...prev.blocks] : [];
      const target = index + direction;
      if (target < 0 || target >= blocks.length) return prev;
      const next = [...blocks];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...prev, blocks: next };
    });
  };

  const addBlock = (type) => {
    setPageDraft((prev) => ({
      ...prev,
      blocks: [...(prev?.blocks || []), { type, data: {} }]
    }));
  };

  const handleSavePage = () => {
    if (!pageDraft?.slug || !pageDraft?.title) {
      toast({ title: 'Missing fields', description: 'Slug and title are required.', variant: 'destructive' });
      return;
    }
    const payload = {
      slug: pageDraft.slug,
      title: pageDraft.title,
      status: pageDraft.status,
      template_key: pageDraft.template_key || null,
      blocks: pageDraft.blocks || []
    };
    if (creatingPage) {
      createPageMutation.mutate(payload);
    } else if (pageDraft?.id) {
      updatePageMutation.mutate({ id: pageDraft.id, data: payload });
    }
  };

  const filteredPages = pages.filter((page) => {
    if (!pageSearch) return true;
    const term = pageSearch.toLowerCase();
    return page.slug?.toLowerCase().includes(term) || page.title?.toLowerCase().includes(term);
  });

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-white">Pages</h2>
            <p className="text-sm text-slate-400">Create and edit WordPress-style pages.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={pageSearch}
              onChange={(e) => setPageSearch(e.target.value)}
              placeholder="Search pages"
              className="bg-slate-800 border-slate-700 w-[220px]"
            />
            <Button onClick={openCreatePage} className="bg-emerald-500 hover:bg-emerald-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Page
            </Button>
          </div>
        </div>

        {pagesLoading ? (
          <LoadingSpinner />
        ) : filteredPages.length === 0 ? (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
            <p className="text-slate-400">No pages yet. Create your first page.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPages.map((page) => (
              <div
                key={page.id}
                className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge className={page.status === 'published' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/50 text-slate-300'}>
                        {page.status}
                      </Badge>
                      <span className="text-xs text-slate-500">/{page.slug}</span>
                    </div>
                    <div className="font-semibold text-white">{page.title}</div>
                    <div className="text-sm text-slate-400">Updated {page.updated_at ? new Date(page.updated_at).toLocaleString() : '\u2014'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditPage(page)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePageMutation.mutate(page.id)}
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

      <Dialog open={Boolean(pageDraft)} onOpenChange={(open) => {
        if (!open) {
          setPageDraft(null);
          setEditingPage(null);
          setCreatingPage(false);
        }
      }}>
        <DialogContent className="max-w-4xl bg-slate-900 text-slate-100 border border-slate-700 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{creatingPage ? 'Create Page' : 'Edit Page'}</DialogTitle>
          </DialogHeader>
          {pageDraft && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Title</label>
                  <Input
                    value={pageDraft.title}
                    onChange={(e) => updatePageDraft({ title: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Slug</label>
                  <Input
                    value={pageDraft.slug}
                    onChange={(e) => updatePageDraft({ slug: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Status</label>
                  <Select value={pageDraft.status} onValueChange={(value) => updatePageDraft({ status: value })}>
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">draft</SelectItem>
                      <SelectItem value="published">published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Template</label>
                  <Select
                    value={pageDraft.template_key || 'blank'}
                    onValueChange={(value) => updatePageDraft({ template_key: value })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_TEMPLATES.map((tpl) => (
                        <SelectItem key={tpl.key} value={tpl.key}>{tpl.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    className="border-slate-700 text-slate-200 mt-2"
                    onClick={() => updatePageDraft({ blocks: buildTemplateBlocks(pageDraft.template_key) })}
                  >
                    Apply Template Blocks
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Content Blocks</h3>
                  <div className="flex items-center gap-2">
                    <Select onValueChange={(value) => addBlock(value)}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 w-[200px]">
                        <SelectValue placeholder="Add block" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(BLOCK_DEFINITIONS).map(([key, block]) => (
                          <SelectItem key={key} value={key}>{block.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(pageDraft.blocks || []).length === 0 ? (
                  <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 text-sm text-slate-400">
                    No blocks yet. Add your first block using the selector above.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(pageDraft.blocks || []).map((block, index) => {
                      const definition = BLOCK_DEFINITIONS[block.type] || { label: block.type, fields: [] };
                      return (
                        <div key={`${block.type}-${index}`} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                          <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-slate-700/60 text-slate-200 border-slate-600">
                                {definition.label}
                              </Badge>
                              <Select
                                value={block.type}
                                onValueChange={(value) => updateBlock(index, { type: value, data: {} })}
                              >
                                <SelectTrigger className="bg-slate-800 border-slate-700 h-8 w-[160px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(BLOCK_DEFINITIONS).map(([key, item]) => (
                                    <SelectItem key={key} value={key}>{item.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" onClick={() => moveBlock(index, -1)} className="text-slate-400 hover:text-white">
                                <ArrowUp className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => moveBlock(index, 1)} className="text-slate-400 hover:text-white">
                                <ArrowDown className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => removeBlock(index)} className="text-slate-400 hover:text-red-400">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            {definition.fields.map((field) => {
                              const rawValue = block.data?.[field.key];
                              if (field.type === 'textarea') {
                                return (
                                  <div key={field.key} className="space-y-2 md:col-span-2">
                                    <label className="text-xs text-slate-400">{field.label}</label>
                                    <Textarea
                                      value={rawValue || ''}
                                      onChange={(e) => updateBlock(index, { data: { ...block.data, [field.key]: e.target.value } })}
                                      className="bg-slate-800 border-slate-700 min-h-[90px]"
                                    />
                                  </div>
                                );
                              }

                              if (field.type === 'select') {
                                return (
                                  <div key={field.key} className="space-y-2">
                                    <label className="text-xs text-slate-400">{field.label}</label>
                                    <Select
                                      value={rawValue || field.options?.[0]}
                                      onValueChange={(value) => updateBlock(index, { data: { ...block.data, [field.key]: value } })}
                                    >
                                      <SelectTrigger className="bg-slate-800 border-slate-700">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(field.options || []).map((option) => (
                                          <SelectItem key={option} value={option}>{option}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                );
                              }

                              if (field.type === 'json') {
                                const displayValue = typeof rawValue === 'string'
                                  ? rawValue
                                  : JSON.stringify(rawValue ?? [], null, 2);
                                return (
                                  <div key={field.key} className="space-y-2 md:col-span-2">
                                    <label className="text-xs text-slate-400">{field.label}</label>
                                    <Textarea
                                      value={displayValue}
                                      onChange={(e) => {
                                        let nextValue = e.target.value;
                                        try {
                                          nextValue = JSON.parse(e.target.value);
                                        } catch {
                                          nextValue = e.target.value;
                                        }
                                        updateBlock(index, { data: { ...block.data, [field.key]: nextValue } });
                                      }}
                                      className="bg-slate-800 border-slate-700 min-h-[120px] font-mono text-xs"
                                    />
                                  </div>
                                );
                              }

                              return (
                                <div key={field.key} className="space-y-2">
                                  <label className="text-xs text-slate-400">{field.label}</label>
                                  <Input
                                    value={rawValue || ''}
                                    onChange={(e) => updateBlock(index, { data: { ...block.data, [field.key]: e.target.value } })}
                                    className="bg-slate-800 border-slate-700"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-200"
                  onClick={() => {
                    setPageDraft(null);
                    setEditingPage(null);
                    setCreatingPage(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSavePage}
                  disabled={createPageMutation.isPending || updatePageMutation.isPending}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  {createPageMutation.isPending || updatePageMutation.isPending ? 'Saving\u2026' : 'Save Page'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
