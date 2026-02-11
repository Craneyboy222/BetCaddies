import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function MediaTab() {
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const queryClient = useQueryClient();

  const { data: mediaAssets = [], isLoading: mediaAssetsLoading } = useQuery({
    queryKey: ['mediaAssets'],
    queryFn: () => api.entities.MediaAsset.list(200)
  });

  const { data: r2Status } = useQuery({
    queryKey: ['r2Status'],
    queryFn: () => api.entities.MediaAsset.status()
  });

  const deleteMediaAssetMutation = useMutation({
    mutationFn: (id) => api.entities.MediaAsset.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mediaAssets'] })
  });

  const handleUploadMedia = async (file) => {
    if (!file) return;
    setMediaUploading(true);
    setMediaError(null);
    try {
      await api.entities.MediaAsset.upload(file, 'cms');
      queryClient.invalidateQueries({ queryKey: ['mediaAssets'] });
      toast({ title: 'Upload complete', description: 'Media asset added.' });
    } catch (error) {
      console.error(error);
      setMediaError(error?.message || 'Upload failed');
    } finally {
      setMediaUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {r2Status && !r2Status.configured && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-lg p-4">
          <p className="font-semibold mb-2">Cloudflare R2 not configured</p>
          <p className="text-sm text-amber-300/80 mb-2">Image uploads require Cloudflare R2 object storage. Add these environment variables in Railway:</p>
          <ul className="text-sm text-amber-300/80 list-disc list-inside space-y-1">
            {(r2Status.missing || []).map(v => <li key={v}><code className="bg-slate-800 px-1 rounded">{v}</code></li>)}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Media Library</h2>
          <p className="text-sm text-slate-400">Upload and manage media assets.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => handleUploadMedia(e.target.files?.[0])}
            className="bg-slate-800 border-slate-700"
            disabled={r2Status && !r2Status.configured}
          />
          {mediaUploading && (
            <span className="text-xs text-slate-400">Uploading...</span>
          )}
        </div>
      </div>

      {mediaError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg p-3">
          {mediaError}
        </div>
      )}

      {mediaAssetsLoading ? (
        <LoadingSpinner />
      ) : mediaAssets.length === 0 ? (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
          <p className="text-slate-400">No media assets yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mediaAssets.map((asset) => (
            <div key={asset.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
              <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden mb-3 flex items-center justify-center">
                <img src={asset.url} alt={asset.alt_text || asset.file_name || 'Media'} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm text-slate-200 truncate">{asset.file_name || asset.public_id || asset.url}</div>
              <div className="text-xs text-slate-500">{asset.width || '\u2014'} \u00d7 {asset.height || '\u2014'}</div>
              <div className="flex items-center justify-end mt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMediaAssetMutation.mutate(asset.id)}
                  className="text-slate-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
