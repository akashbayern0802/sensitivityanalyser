'use client';

import { useState, useEffect, useCallback } from 'react';
import { Radar, Plus, Trash2, RefreshCw, Sparkles, ExternalLink, Copy, Check, GitBranch, Rss, Loader2, ChevronDown, ChevronUp, MessageSquare, Building2, Newspaper, Bell, AlertCircle } from 'lucide-react';

interface TrackedTarget {
  id: string;
  type: 'rss' | 'github';
  name: string;
  url: string;
  niche: string;
  lastScanned: string | null;
  isActive: boolean;
}

interface RadarEvent {
  id: string;
  title: string;
  url: string;
  summary: string;
  publishedAt: string | null;
  type: string;
  status: string;
  linkedinDraft: string | null;
  commentDraft?: string | null;
  target: TrackedTarget;
}

export default function RadarPage() {
  const [activeTab, setActiveTab] = useState<'targets' | 'radar' | 'company-intel'>('targets');
  const [targets, setTargets] = useState<TrackedTarget[]>([]);
  const [events, setEvents] = useState<RadarEvent[]>([]);
  const [niche, setNiche] = useState('');
  const [region, setRegion] = useState('India');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [synthesizingId, setSynthesizingId] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState('');
  
  const [manualForm, setManualForm] = useState({ type: 'rss' as 'rss' | 'github', name: '', url: '', niche: '' });
  const [isAddingManual, setIsAddingManual] = useState(false);

  const [companyNews, setCompanyNews] = useState<Record<string, any[]>>({});
  const [isScanningCompanyNews, setIsScanningCompanyNews] = useState(false);
  const [companyNewsMessage, setCompanyNewsMessage] = useState('');
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  const loadTargets = useCallback(async () => {
    const res = await fetch('/api/radar/targets');
    const data = await res.json();
    if (data.success) setTargets(data.targets);
  }, []);

  const loadEvents = useCallback(async () => {
    const res = await fetch('/api/radar/scan');
    const data = await res.json();
    if (data.success) setEvents(data.events);
  }, []);

  const loadCompanyNews = useCallback(async () => {
    const res = await fetch('/api/radar/company-news');
    const data = await res.json();
    if (data.success) setCompanyNews(data.grouped);
  }, []);

  const handleScanCompanyNews = async () => {
    setIsScanningCompanyNews(true);
    setCompanyNewsMessage('Scanning Google News for your CRM companies...');
    try {
      const res = await fetch('/api/radar/company-news', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const added = (data.autoDiscovered ?? []).reduce((n: number, d: { added: string[] }) => n + d.added.length, 0);
        setCompanyNewsMessage(`Scanned ${data.scanned} companies. Found ${data.newEvents} new articles.` + (added > 0 ? ` Major news detected: ${added} new contacts added to your CRM Inbox.` : ''));
        setLastScanTime(new Date().toLocaleTimeString());
        loadCompanyNews();
      } else {
        setCompanyNewsMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setCompanyNewsMessage(`Error: ${err.message}`);
    } finally {
      setIsScanningCompanyNews(false);
    }
  };

  useEffect(() => {
    loadTargets();
    loadEvents();
    loadCompanyNews();
  }, [loadTargets, loadEvents, loadCompanyNews]);

  const handleDiscover = async () => {
    if (!niche.trim()) return;
    setIsDiscovering(true);
    try {
      const res = await fetch('/api/radar/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, region }),
      });
      const data = await res.json();
      if (data.success) {
        await loadTargets();
        setNiche('');
      } else {
        alert('Discovery failed: ' + data.error);
      }
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleAddManualTarget = async () => {
    if (!manualForm.name || !manualForm.url || !manualForm.niche) return;
    setIsAddingManual(true);
    try {
      const res = await fetch('/api/radar/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualForm),
      });
      const data = await res.json();
      if (data.success) {
        await loadTargets();
        setManualForm({ type: 'rss', name: '', url: '', niche: '' });
      } else {
        alert('Failed to add target: ' + data.error);
      }
    } finally {
      setIsAddingManual(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch('/api/radar/targets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setTargets(prev => prev.filter(t => t.id !== id));
  };

  const handleDeleteTargetType = async (type: 'rss' | 'github') => {
    if (!confirm(`Are you sure you want to delete all ${type === 'rss' ? 'RSS feeds' : 'GitHub repos'}?`)) return;
    await fetch('/api/radar/targets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    setTargets(prev => prev.filter(t => t.type !== type));
  };

  const handleDeleteEvent = async (id: string) => {
    await fetch('/api/radar/events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const handleDeleteAllEvents = async () => {
    if (!confirm('Are you sure you want to clear your entire radar feed?')) return;
    await fetch('/api/radar/events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteAll: true }),
    });
    setEvents([]);
  };

  const handleScan = async () => {
    setIsScanning(true);
    setScanMessage('');
    try {
      const res = await fetch('/api/radar/scan', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setScanMessage(`Scan complete! ${data.newEvents} new events found.`);
        await loadEvents();
        setActiveTab('radar');
      } else {
        setScanMessage('Scan failed: ' + data.error);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleSynthesize = async (eventId: string, actionType: 'post' | 'comment' = 'post') => {
    setSynthesizingId(eventId + actionType);
    try {
      const res = await fetch('/api/radar/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, actionType }),
      });
      const data = await res.json();
      if (data.success) {
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...data.event } : e));
        setExpandedEventId(eventId);
      } else {
        alert('Synthesis failed: ' + data.error);
      }
    } finally {
      setSynthesizingId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const rssTargets = targets.filter(t => t.type === 'rss');
  const githubTargets = targets.filter(t => t.type === 'github');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Radar className="w-7 h-7 text-indigo-600" />
          Off-Platform Radar
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Track thought leaders on GitHub and Substack. Be the first to bring high-signal content to LinkedIn.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {(['targets', 'radar'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'targets' ? `Targets (${targets.length})` : `Live Radar (${events.length})`}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('company-intel')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'company-intel'
                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Building2 className="w-4 h-4" /> Company Intel
            {Object.keys(companyNews).length > 0 && (
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            )}
          </button>
        </nav>
      </div>

      {/* TARGETS TAB */}
      {activeTab === 'targets' && (
        <div className="space-y-6">
          {/* Auto-Discovery */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Auto-Discover Thought Leaders</h2>
            <p className="text-sm text-gray-500 mb-4">Enter a niche and the AI will find the top RSS feeds and GitHub repos to monitor — globally or filtered by region.</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={niche}
                onChange={e => setNiche(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDiscover()}
                placeholder="e.g. Agentic AI, Fintech, Data Engineering..."
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="Global">Global</option>
                <option value="India">India</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Canada">Canada</option>
                <option value="Australia">Australia</option>
                <option value="Singapore">Singapore</option>
                <option value="Germany">Germany</option>
              </select>
              <button
                onClick={handleDiscover}
                disabled={isDiscovering || !niche.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {isDiscovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isDiscovering ? 'Discovering...' : 'Discover'}
              </button>
            </div>
          </div>

          {/* Manual Addition */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Manually Add a Target</h2>
            <p className="text-sm text-gray-500 mb-4">Paste an RSS/XML bridge link (e.g. from RSS.app for LinkedIn profiles) or a specific GitHub repo.</p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <select
                value={manualForm.type}
                onChange={e => setManualForm({ ...manualForm, type: e.target.value as 'rss' | 'github' })}
                className="col-span-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="rss">RSS Feed</option>
                <option value="github">GitHub Repo</option>
              </select>
              <input
                type="text"
                placeholder="Target Name (e.g. Gergely LinkedIn)"
                value={manualForm.name}
                onChange={e => setManualForm({ ...manualForm, name: e.target.value })}
                className="col-span-1 sm:col-span-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="Niche (e.g. Tech)"
                value={manualForm.niche}
                onChange={e => setManualForm({ ...manualForm, niche: e.target.value })}
                className="col-span-1 sm:col-span-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="URL (e.g. https://rss.app/feed/123.xml)"
                value={manualForm.url}
                onChange={e => setManualForm({ ...manualForm, url: e.target.value })}
                className="col-span-1 sm:col-span-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleAddManualTarget}
                disabled={isAddingManual || !manualForm.name || !manualForm.url || !manualForm.niche}
                className="col-span-1 sm:col-span-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {isAddingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </button>
            </div>
          </div>

          {/* RSS Feeds */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Rss className="w-4 h-4 text-orange-500" /> RSS Feeds ({rssTargets.length})
              </h3>
              {rssTargets.length > 0 && (
                <button onClick={() => handleDeleteTargetType('rss')} className="text-xs text-red-500 hover:text-red-700 font-medium">
                  Delete All
                </button>
              )}
            </div>
            {rssTargets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No RSS feeds yet. Discover some above!</p>
            ) : (
              <div className="space-y-2">
                {rssTargets.map(target => (
                  <div key={target.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{target.name}</p>
                      <p className="text-xs text-gray-500 truncate">{target.url}</p>
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 mt-1">{target.niche}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <a href={target.url.replace(/\/feed\/?$/, '').replace(/\/rss\/?$/, '')} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-orange-500 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button onClick={() => handleDelete(target.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GitHub Repos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-gray-700" /> GitHub Repositories ({githubTargets.length})
              </h3>
              {githubTargets.length > 0 && (
                <button onClick={() => handleDeleteTargetType('github')} className="text-xs text-red-500 hover:text-red-700 font-medium">
                  Delete All
                </button>
              )}
            </div>
            {githubTargets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No GitHub repos yet. Discover some above!</p>
            ) : (
              <div className="space-y-2">
                {githubTargets.map(target => (
                  <div key={target.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{target.name}</p>
                      <p className="text-xs text-gray-500 truncate">{target.url}</p>
                      <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700 mt-1">{target.niche}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <a href={target.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-indigo-500">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button onClick={() => handleDelete(target.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scan Button */}
          {targets.length > 0 && (
            <div className="flex items-center gap-4">
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
              >
                {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {isScanning ? 'Scanning all targets...' : 'Scan All Targets Now'}
              </button>
              {scanMessage && <p className="text-sm text-gray-600">{scanMessage}</p>}
            </div>
          )}
        </div>
      )}

      {/* LIVE RADAR TAB */}
      {activeTab === 'radar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{events.length} events in your radar feed</p>
            <div className="flex items-center gap-2">
              {events.length > 0 && (
                <button
                  onClick={handleDeleteAllEvents}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </button>
              )}
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {isScanning ? 'Scanning...' : 'Refresh'}
              </button>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Radar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-base font-medium text-gray-600">Your radar is empty</p>
              <p className="text-sm">Discover targets and run a scan to populate your feed.</p>
            </div>
          ) : (
            events.map(event => (
              <div key={event.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {event.type === 'article' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700"><Rss className="w-3 h-3" /> Article</span>
                      ) : event.type === 'pr' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"><GitBranch className="w-3 h-3" /> PR Merged</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"><GitBranch className="w-3 h-3" /> Release</span>
                      )}
                      <span className="text-xs text-gray-400">{event.target?.name}</span>
                      {event.publishedAt && (
                        <span className="text-xs text-gray-400">{new Date(event.publishedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">{event.title}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{event.summary}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-indigo-500">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button onClick={() => handleDeleteEvent(event.id)} className="text-gray-400 hover:text-red-500 transition-colors mr-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSynthesize(event.id, 'post')}
                        disabled={synthesizingId !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                      >
                        {synthesizingId === event.id + 'post' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {synthesizingId === event.id + 'post' ? 'Drafting...' : (event.linkedinDraft ? 'Redraft Post' : 'Draft Post')}
                      </button>
                      <button
                        onClick={() => handleSynthesize(event.id, 'comment')}
                        disabled={synthesizingId !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-600 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                      >
                        {synthesizingId === event.id + 'comment' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                        {synthesizingId === event.id + 'comment' ? 'Drafting...' : (event.commentDraft ? 'Redraft Comment' : 'Draft Comment')}
                      </button>
                      {event.status === 'drafted' && (
                        <button
                          onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-200 transition-colors"
                        >
                          {expandedEventId === event.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          View Drafts
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Drafts Display */}
                {expandedEventId === event.id && (
                  <div className="flex flex-col gap-3 mt-3">
                    {event.commentDraft && (
                      <div className="rounded-lg bg-purple-50 border border-purple-100 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Suggested Comments</p>
                          <button
                            onClick={() => copyToClipboard(event.commentDraft!, event.id + 'comment')}
                            className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800"
                          >
                            {copiedId === event.id + 'comment' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedId === event.id + 'comment' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{event.commentDraft}</p>
                      </div>
                    )}
                    {event.linkedinDraft && (
                      <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">LinkedIn Draft</p>
                          <button
                            onClick={() => copyToClipboard(event.linkedinDraft!, event.id + 'post')}
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            {copiedId === event.id + 'post' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedId === event.id + 'post' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{event.linkedinDraft}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
      {/* ═══════════ COMPANY INTEL TAB ═══════════ */}
      {activeTab === 'company-intel' && (
        <div className="space-y-6">
          {/* Header + Scan Button */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-orange-500" />
                  Company News Intelligence
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Google News scanned for every company in your CRM pipeline.
                  {lastScanTime && <span className="ml-2 text-xs text-gray-400">Last scan: {lastScanTime}</span>}
                </p>
              </div>
              <button
                onClick={handleScanCompanyNews}
                disabled={isScanningCompanyNews}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {isScanningCompanyNews ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {isScanningCompanyNews ? 'Scanning...' : 'Scan Now'}
              </button>
            </div>
            {companyNewsMessage && (
              <div className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2 border border-gray-100">
                {companyNewsMessage}
              </div>
            )}
          </div>

          {/* Empty state */}
          {Object.keys(companyNews).length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
              <Building2 className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-base font-medium text-gray-500">No company news yet</p>
              <p className="text-sm text-gray-400 mt-1 max-w-sm text-center">
                Click "Scan Now" to pull the latest Google News for all companies in your CRM.
              </p>
            </div>
          )}

          {/* News grouped by company */}
          {Object.entries(companyNews).map(([company, articles]) => (
            <div key={company} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Company header */}
              <div className="bg-orange-50 px-5 py-3 border-b border-orange-100 flex items-center justify-between">
                <h3 className="font-semibold text-orange-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-orange-600" />
                  {company}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                    {articles.length} article{articles.length > 1 ? 's' : ''}
                  </span>
                  <Bell className="w-4 h-4 text-orange-500" />
                </div>
              </div>

              {/* Articles */}
              <div className="divide-y divide-gray-100">
                {articles.map((article: any) => (
                  <div key={article.id} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-gray-900 hover:text-orange-700 transition-colors text-sm leading-snug block mb-2"
                        >
                          {article.title}
                        </a>
                        {article.summary && (
                          <p className="text-sm text-gray-500 leading-relaxed">{article.summary}</p>
                        )}
                        {article.publishedAt && (
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(article.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors shrink-0"
                        title="Read article"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}





