'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Radio, 
  Plus, 
  Trash2, 
  Check, 
  Loader2, 
  Send, 
  AlertCircle, 
  ExternalLink,
  MessageSquare,
  Hash,
  ShieldCheck
} from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  type: string;
  endpointUrl: string;
  isActive: boolean;
  createdAt: string;
  broadcastLogs?: Array<{ status: string; dispatchedAt: string }>;
}

export function DistributionChannelsManager() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // New channel form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'slack_webhook' | 'discord_webhook'>('slack_webhook');
  const [newUrl, setNewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/broadcast/channels');
      const data = await res.json();
      if (data.success) {
        setChannels(data.channels || []);
      }
    } catch (e) {
      console.error('Failed to load channels', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const handleTestWebhook = async (id: string, type: string, endpointUrl: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch('/api/broadcast/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, endpointUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ id, success: true, message: 'Ping verified! Webhook is receiving messages.' });
      } else {
        setTestResult({ id, success: false, message: data.error || 'Webhook test failed.' });
      }
    } catch (err: any) {
      setTestResult({ id, success: false, message: err.message || 'Connection error' });
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActive = async (channel: Channel) => {
    try {
      const res = await fetch('/api/broadcast/channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: channel.id, isActive: !channel.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, isActive: !c.isActive } : c));
      }
    } catch (err) {
      console.error('Toggle failed', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this webhook channel?')) return;
    try {
      const res = await fetch('/api/broadcast/channels', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setChannels(prev => prev.filter(c => c.id !== id));
      }
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!newName.trim() || !newUrl.trim()) {
      setFormError('Please enter both a channel name and webhook URL.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Test ping first to confirm URL is valid
      const testRes = await fetch('/api/broadcast/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newType, endpointUrl: newUrl.trim() }),
      });
      const testData = await testRes.json();
      if (!testData.success) {
        throw new Error(testData.error || 'Webhook test failed. Please verify the URL.');
      }

      // 2. Save channel to DB
      const res = await fetch('/api/broadcast/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          type: newType,
          endpointUrl: newUrl.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save channel.');
      }

      setFormSuccess('Channel verified and added successfully!');
      setNewName('');
      setNewUrl('');
      setIsAdding(false);
      loadChannels();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
      <div className="px-4 py-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Radio className="w-5 h-5" />
              </span>
              <h3 className="text-base font-semibold leading-7 text-gray-900">
                Distribution Channels &amp; Community Webhooks
              </h3>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Configure Slack &amp; Discord incoming webhooks for instant 1-click syndication from the Content Studio.
            </p>
          </div>

          <button
            onClick={() => { setIsAdding(!isAdding); setFormError(''); setFormSuccess(''); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            {isAdding ? 'Cancel' : 'Add Webhook'}
          </button>
        </div>

        {/* Add Channel Drawer */}
        {isAdding && (
          <form onSubmit={handleCreateChannel} className="mt-5 p-5 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
            <h4 className="text-sm font-semibold text-gray-900">New Webhook Integration</h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Channel Label</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. The Product Folks Slack (#reading) or Dev Founders Discord"
                  className="w-full text-sm px-3.5 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Platform</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full text-sm px-3.5 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="slack_webhook">Slack Incoming Webhook</option>
                  <option value="discord_webhook">Discord Webhook</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Incoming Webhook URL</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder={
                    newType === 'slack_webhook'
                      ? 'https://hooks.slack.com/services/T000/B000/XXXXXX'
                      : 'https://discord.com/api/webhooks/123456/abcdef...'
                  }
                  className="w-full text-sm px-3.5 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-xs"
                  required
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  {newType === 'slack_webhook' 
                    ? 'Create in Slack: Apps → Incoming Webhooks → Add New Webhook to Workspace.' 
                    : 'Create in Discord: Channel Settings → Integrations → Webhooks → New Webhook.'}
                </p>
              </div>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-green-50 text-green-700 rounded-lg text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                {isSubmitting ? 'Verifying Ping & Saving...' : 'Test & Add Channel'}
              </button>
            </div>
          </form>
        )}

        {/* Channels List */}
        <div className="mt-6 space-y-3">
          {isLoading ? (
            <div className="py-6 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              Loading channels...
            </div>
          ) : channels.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
              <Hash className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">No community webhooks configured</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Add your Slack or Discord community channel webhooks above to enable zero-friction broadcasts from the Content Studio.
              </p>
            </div>
          ) : (
            channels.map((ch) => (
              <div
                key={ch.id}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  ch.isActive ? 'bg-white border-gray-200 hover:border-indigo-300 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`p-2 rounded-lg text-xs font-bold shrink-0 mt-0.5 ${
                    ch.type === 'slack_webhook' 
                      ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  }`}>
                    {ch.type === 'slack_webhook' ? 'Slack' : 'Discord'}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{ch.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        ch.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {ch.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 font-mono truncate mt-0.5 max-w-md">
                      {ch.endpointUrl.replace(/(hooks\.slack\.com\/services\/[^\/]+\/[^\/]+\/).+/, '$1••••••••')}
                    </p>

                    {ch.broadcastLogs && ch.broadcastLogs.length > 0 && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Last broadcast: {new Date(ch.broadcastLogs[0].dispatchedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} ({ch.broadcastLogs[0].status})
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => handleTestWebhook(ch.id, ch.type, ch.endpointUrl)}
                    disabled={testingId === ch.id}
                    className="px-2.5 py-1.5 text-xs text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-200"
                    title="Send test ping"
                  >
                    {testingId === ch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test Ping'}
                  </button>

                  <button
                    onClick={() => handleToggleActive(ch)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                      ch.isActive 
                        ? 'text-amber-700 border-amber-200 hover:bg-amber-50' 
                        : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    {ch.isActive ? 'Pause' : 'Activate'}
                  </button>

                  <button
                    onClick={() => handleDelete(ch.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete channel"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {testResult && testResult.id === ch.id && (
                  <div className={`sm:col-span-2 w-full p-2.5 rounded-lg text-xs mt-2 ${
                    testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {testResult.message}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
