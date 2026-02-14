import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import {
  CreditCard, Shield, Check, X, Eye, EyeOff, TestTube, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PROVIDERS = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Credit/debit cards, Apple Pay, Google Pay',
    fields: [
      { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_test_...' },
      { key: 'public_key', label: 'Publishable Key', placeholder: 'pk_test_...' },
      { key: 'webhook_secret', label: 'Webhook Secret', placeholder: 'whsec_...' }
    ],
    configFields: [
      { key: 'successUrl', label: 'Success URL', placeholder: 'https://yoursite.com/memberships?success=true' },
      { key: 'cancelUrl', label: 'Cancel URL', placeholder: 'https://yoursite.com/memberships?cancelled=true' }
    ]
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'PayPal balance, cards via PayPal',
    fields: [
      { key: 'public_key', label: 'Client ID', placeholder: 'AV...' },
      { key: 'secret_key', label: 'Client Secret', placeholder: 'EL...' },
      { key: 'webhook_secret', label: 'Webhook ID', placeholder: 'WH-...' }
    ],
    configFields: []
  },
  {
    id: 'square',
    name: 'Square',
    description: 'Credit/debit cards via Square',
    fields: [
      { key: 'public_key', label: 'Location ID', placeholder: 'L...' },
      { key: 'secret_key', label: 'Access Token', placeholder: 'EAAAl...' },
      { key: 'webhook_secret', label: 'Webhook Signature Key', placeholder: 'your-signature-key' }
    ],
    configFields: [
      { key: 'successUrl', label: 'Success URL', placeholder: 'https://yoursite.com/memberships?success=true' },
      { key: 'cancelUrl', label: 'Cancel URL', placeholder: 'https://yoursite.com/memberships?cancelled=true' }
    ]
  }
];

function ProviderCard({ providerDef, savedSettings, onSave, onTest, testResult, isTesting }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [showSecrets, setShowSecrets] = useState({});

  const saved = savedSettings || {};
  const isEnabled = saved.enabled || false;
  const mode = saved.mode || 'test';

  const startEdit = () => {
    setForm({
      enabled: isEnabled,
      mode,
      ...(saved.additional_config || {})
    });
    setEditing(true);
  };

  const handleSave = () => {
    const payload = {
      enabled: form.enabled ?? isEnabled,
      mode: form.mode || mode,
    };

    // Only include keys if they were entered
    providerDef.fields.forEach(f => {
      if (form[f.key] !== undefined && form[f.key] !== '') {
        payload[f.key] = form[f.key];
      }
    });

    // Config fields go into additional_config
    const additionalConfig = {};
    providerDef.configFields.forEach(f => {
      if (form[f.key] !== undefined) additionalConfig[f.key] = form[f.key];
    });
    if (Object.keys(additionalConfig).length > 0) {
      payload.additional_config = { ...(saved.additional_config || {}), ...additionalConfig };
    }

    onSave(providerDef.id, payload);
    setEditing(false);
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isEnabled ? 'bg-emerald-500/20' : 'bg-slate-700/50'
          }`}>
            <CreditCard className={`w-5 h-5 ${isEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
          </div>
          <div>
            <h3 className="text-white font-semibold">{providerDef.name}</h3>
            <p className="text-slate-400 text-sm">{providerDef.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={isEnabled
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            : 'bg-slate-700/50 text-slate-500 border-slate-600/30'
          }>
            {isEnabled ? 'Active' : 'Disabled'}
          </Badge>
          <Badge className={mode === 'live'
            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
          }>
            {mode === 'live' ? 'Live' : 'Test'}
          </Badge>
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="text-slate-400">
          API Key: {saved.has_secret_key
            ? <span className="text-emerald-400">Configured</span>
            : <span className="text-red-400">Not set</span>
          }
        </span>
        <span className="text-slate-400">
          Webhook: {saved.has_webhook_secret
            ? <span className="text-emerald-400">Configured</span>
            : <span className="text-slate-500">Not set</span>
          }
        </span>
      </div>

      {editing ? (
        <div className="space-y-4 border-t border-slate-700/50 pt-4">
          <div className="flex items-center gap-4">
            <label className="text-sm text-slate-300 w-20">Enabled</label>
            <Switch
              checked={form.enabled ?? isEnabled}
              onCheckedChange={(v) => setForm(prev => ({ ...prev, enabled: v }))}
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm text-slate-300 w-20">Mode</label>
            <Select value={form.mode || mode} onValueChange={(v) => setForm(prev => ({ ...prev, mode: v }))}>
              <SelectTrigger className="w-32 bg-slate-900 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Test</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {providerDef.fields.map(f => (
            <div key={f.key} className="flex items-center gap-4">
              <label className="text-sm text-slate-300 w-32 flex-shrink-0">{f.label}</label>
              <div className="flex-1 relative">
                <Input
                  type={showSecrets[f.key] ? 'text' : 'password'}
                  placeholder={f.placeholder}
                  value={form[f.key] || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="bg-slate-900 border-slate-700 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecrets(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showSecrets[f.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
          {providerDef.configFields.map(f => (
            <div key={f.key} className="flex items-center gap-4">
              <label className="text-sm text-slate-300 w-32 flex-shrink-0">{f.label}</label>
              <Input
                placeholder={f.placeholder}
                value={form[f.key] || saved.additional_config?.[f.key] || ''}
                onChange={(e) => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="bg-slate-900 border-slate-700"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} size="sm" className="bg-emerald-500 hover:bg-emerald-600">
              <Check className="w-4 h-4 mr-1" /> Save
            </Button>
            <Button onClick={() => setEditing(false)} size="sm" variant="outline" className="border-slate-600">
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 border-t border-slate-700/50 pt-4">
          <Button onClick={startEdit} size="sm" variant="outline" className="border-slate-600">
            Configure
          </Button>
          <Button
            onClick={() => onTest(providerDef.id)}
            size="sm"
            variant="outline"
            className="border-slate-600"
            disabled={isTesting}
          >
            {isTesting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Shield className="w-4 h-4 mr-1" />}
            Test Connection
          </Button>
          {testResult && (
            <span className={`text-sm self-center ml-2 ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
              {testResult.success ? testResult.message : testResult.error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function PaymentSettingsAdmin() {
  const queryClient = useQueryClient();
  const [testResults, setTestResults] = useState({});
  const [testingProvider, setTestingProvider] = useState(null);

  const { data: settings = [] } = useQuery({
    queryKey: ['paymentSettings'],
    queryFn: () => api.entities.PaymentSettings.list()
  });

  const settingsMap = {};
  settings.forEach(s => { settingsMap[s.provider] = s; });

  const saveMutation = useMutation({
    mutationFn: ({ provider, data }) => api.entities.PaymentSettings.update(provider, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['paymentSettings'] })
  });

  const handleTest = async (provider) => {
    setTestingProvider(provider);
    setTestResults(prev => ({ ...prev, [provider]: null }));
    try {
      const result = await api.entities.PaymentSettings.test(provider);
      setTestResults(prev => ({ ...prev, [provider]: result }));
    } catch (e) {
      setTestResults(prev => ({ ...prev, [provider]: { success: false, error: e.message } }));
    }
    setTestingProvider(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-white">Payment Providers</h2>
      </div>
      <p className="text-slate-400 text-sm mb-4">
        Configure payment gateway API keys. Changes take effect immediately. Use Test mode for development.
      </p>

      {PROVIDERS.map(pDef => (
        <ProviderCard
          key={pDef.id}
          providerDef={pDef}
          savedSettings={settingsMap[pDef.id]}
          onSave={(provider, data) => saveMutation.mutate({ provider, data })}
          onTest={handleTest}
          testResult={testResults[pDef.id]}
          isTesting={testingProvider === pDef.id}
        />
      ))}

      <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4 text-sm text-slate-400">
        <Shield className="w-4 h-4 inline mr-1 text-amber-400" />
        API keys are stored securely in the database. Secret keys are never displayed after saving.
        You can also set keys via environment variables (STRIPE_SECRET_KEY, PAYPAL_CLIENT_ID, SQUARE_ACCESS_TOKEN, etc.)
        which will be used as fallbacks.
      </div>
    </div>
  );
}
