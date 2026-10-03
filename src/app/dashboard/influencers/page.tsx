'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  MessageSquare,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  X,
  Rss,
  BookmarkPlus,
  BookmarkCheck,
  Kanban,
  Building2,
  Clock,
  Calendar,
  GripVertical,
  Newspaper
} from 'lucide-react';

interface Influencer {
  id?: string;
  name: string;
  headline: string;
  linkedinUrl: string;
  whyFollow?: string;
  relevanceScore?: number;
  isSaved?: boolean;
  companyName?: string;
  status?: 'inbox' | 'cold' | 'engaged' | 'connected';
  lastEngagedAt?: string;
}

const NICHE_CHIPS = [
  'Agentic AI',
  'System Design',
  'Frontend Engineering',
  'Platform Engineering',
  'Product Management',
  'GenAI / LLMs',
  'DevOps & SRE',
  'Data Engineering',
  'Startup & VC',
  'Leadership & Management',
];

// ─── SessionStorage helpers ──────────────────────────────────────────────────
const SS_KEY = 'sa_influencers_v3';

type DiscoverCache = {
  influencers: Influencer[];
  searchQuery: string;
  country: string;
  lastQuery: string;
  activeNiche: string | null;
};

function readCache(): DiscoverCache {
  try {
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem(SS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        influencers: Array.isArray(parsed.influencers) ? parsed.influencers : [],
        searchQuery: parsed.searchQuery ?? '',
        country: parsed.country ?? '',
        lastQuery: parsed.lastQuery ?? '',
        activeNiche: parsed.activeNiche ?? null,
      };
    }
  } catch {
    // ignore corrupt cache
  }
  return { influencers: [], searchQuery: '', country: '', lastQuery: '', activeNiche: null };
}

function writeCache(data: DiscoverCache) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfluencerSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-4 rounded-xl border border-gray-100 bg-white animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-2/5" />
              <div className="h-3 bg-gray-100 rounded w-4/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentDrawer({
  influencer,
  onClose,
}: {
  influencer: Influencer;
  onClose: () => void;
}) {
  const [postText, setPostText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [companyNews, setCompanyNews] = useState<{ title: string; summary: string; url: string } | null>(null);
  const [contextUsed, setContextUsed] = useState(false);

  useEffect(() => {
    if (!influencer.companyName) return;
    // Fetch latest news for this company from Company Intel
    fetch(`/api/radar/company-news`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.grouped) {
          const companyEvents = data.grouped[influencer.companyName!] || [];
          if (companyEvents.length > 0) {
            const latest = companyEvents[0];
            setCompanyNews({ title: latest.title, summary: latest.summary, url: latest.url });
          }
        }
      })
      .catch(() => {});
  }, [influencer.companyName]);

  const getModelConfig = () => {
    const provider = localStorage.getItem('sa_provider') || 'google-vertex';
    return {
      provider,
      modelId: localStorage.getItem('sa_model') || 'gemini-3.8-flash',
      apiKey: localStorage.getItem(`sa_apiKey_${provider}`) || '',
      ollamaBaseUrl: localStorage.getItem('sa_baseUrl') || '',
      bedrockRegion: localStorage.getItem('sa_region') || '',
    };
  };

  const handleGenerate = async () => {
    if (!postText.trim()) return;
    setIsGenerating(true);
    setError('');
    setSuggestions([]);
    try {
      const res = await fetch('/api/influencers/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postText,
          modelConfig: getModelConfig(),
          userProfile: { targetRole: localStorage.getItem('sa_targetRole') || 'Professional' },
          companyName: influencer.companyName || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed');
      setSuggestions(data.suggestions || []);
      if (data.contextUsed) setContextUsed(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const copy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
            {influencer.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 truncate">{influencer.name}</h2>
            <p className="text-xs text-gray-500 truncate">{influencer.headline}</p>
          </div>
          <div className="flex gap-2">
            <a href={influencer.linkedinUrl} target="_blank" rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {influencer.whyFollow && (
            <div className="flex gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>{influencer.whyFollow}</span>
            </div>
          )}
          {companyNews && (
            <div className="flex flex-col gap-1.5 p-3 bg-orange-50 border border-orange-100 rounded-xl text-sm">
              <div className="flex items-center gap-1.5 text-orange-700 font-medium text-xs">
                <Newspaper className="w-3.5 h-3.5" /> Latest news from {influencer.companyName}
              </div>
              <a href={companyNews.url} target="_blank" rel="noopener noreferrer"
                className="font-medium text-orange-900 hover:underline leading-snug text-xs">
                {companyNews.title}
              </a>
              {companyNews.summary && (
                <p className="text-xs text-orange-700 leading-relaxed line-clamp-2">{companyNews.summary}</p>
              )}
              <p className="text-[10px] text-orange-500 mt-1">✓ This will be automatically injected into the AI prompt</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste their recent LinkedIn post
            </label>
            <textarea value={postText} onChange={(e) => setPostText(e.target.value)}
              placeholder="Paste the post text here…" rows={7}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none text-sm" />
            <p className="text-xs text-gray-400 mt-1">{postText.length} chars</p>
          </div>
          {error && <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">{error}</div>}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Suggested Comments</h3>
                {contextUsed && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                    <Newspaper className="w-2.5 h-2.5" /> News-context injected
                  </span>
                )}
              </div>
              {suggestions.map((comment, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-gray-50 border border-gray-100 relative">
                  <p className="text-gray-700 text-sm pr-10 leading-relaxed">{comment}</p>
                  <button onClick={() => copy(comment, idx)}
                    className="absolute right-3 top-3 p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors">
                    {copiedIndex === idx ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-white">
          <button onClick={handleGenerate} disabled={isGenerating || !postText.trim()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
            {isGenerating ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating…</> :
              suggestions.length > 0 ? <><RefreshCw className="w-4 h-4" />Regenerate</> :
                <><MessageSquare className="w-4 h-4" />Generate Smart Comments</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function InfluencersPage() {
  // ── Discover state: initialized synchronously from sessionStorage
  //    so state is never empty on mount → no timing race with persist effect
  const [influencers, setInfluencers] = useState<Influencer[]>(() => readCache().influencers);
  const [searchQuery, setSearchQuery] = useState<string>(() => readCache().searchQuery);
  const [country, setCountry] = useState<string>(() => readCache().country);
  const [lastQuery, setLastQuery] = useState<string>(() => readCache().lastQuery);
  const [activeNiche, setActiveNiche] = useState<string | null>(() => readCache().activeNiche);

  const [isDiscovering, setIsDiscovering] = useState(false);
  const [error, setError] = useState('');

  // ── Qualified / Saved state (from DB)
  const [savedInfluencers, setSavedInfluencers] = useState<Influencer[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  // ── Tab
  const [activeTab, setActiveTab] = useState<'discover' | 'saved'>('discover');

  // ── CRM State
  const [crmView, setCrmView] = useState<'pipeline' | 'accounts'>('pipeline');
  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null);

  // ── Update CRM Status & Company
  const handleUpdateStatus = async (inf: Influencer, newStatus: string, newCompany?: string) => {
    // Optimistic update
    setSavedInfluencers(prev => prev.map(s => s.id === inf.id ? { 
      ...s, 
      status: newStatus as any,
      ...(newCompany !== undefined ? { companyName: newCompany } : {}) 
    } : s));
    
    try {
      await fetch('/api/influencers/saved', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: inf.id, 
          status: newStatus,
          ...(newCompany !== undefined ? { companyName: newCompany } : {})
        }),
      });
    } catch {
      fetchSaved(); // revert on fail
    }
  };

  const handleLogEngagement = async (inf: Influencer) => {
    const newStatus = 'engaged';
    const now = new Date().toISOString();
    // Optimistic update
    setSavedInfluencers(prev => prev.map(s => s.id === inf.id ? { ...s, status: newStatus, lastEngagedAt: now } : s));
    try {
      await fetch('/api/influencers/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencerId: inf.id, actionType: 'comment' }),
      });
      fetchSaved(); // get true DB state
    } catch {
      fetchSaved(); // revert on fail
    }
  };

  // ── Persist discover state to sessionStorage whenever it changes
  useEffect(() => {
    writeCache({ influencers, searchQuery, country, lastQuery, activeNiche });
  }, [influencers, searchQuery, country, lastQuery, activeNiche]);

  // ── Load saved influencers from DB on mount
  const fetchSaved = async () => {
    setIsLoadingSaved(true);
    try {
      const res = await fetch('/api/influencers/saved');
      const data = await res.json();
      if (data.success) setSavedInfluencers(data.influencers ?? []);
    } catch { /* ignore */ } finally {
      setIsLoadingSaved(false);
    }
  };

  useEffect(() => { fetchSaved(); }, []);

  // ── Toggle save / unsave an influencer
  const handleToggleSave = async (inf: Influencer) => {
    if (!inf.id) {
      console.warn('Cannot save influencer without DB id', inf);
      return;
    }

    const alreadySaved = savedInfluencers.some((s) => s.id === inf.id) || !!inf.isSaved;

    // Optimistic update
    if (alreadySaved) {
      setSavedInfluencers((prev) => prev.filter((s) => s.id !== inf.id));
    } else {
      setSavedInfluencers((prev) => [{ ...inf, isSaved: true }, ...prev]);
    }
    setInfluencers((prev) =>
      prev.map((p) => (p.id === inf.id ? { ...p, isSaved: !alreadySaved } : p))
    );

    try {
      const res = await fetch('/api/influencers/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inf.id, isSaved: !alreadySaved }),
      });
      const data = await res.json();
      if (!data.success) {
        console.error('Save failed:', data.error);
        fetchSaved(); // revert
      }
    } catch {
      fetchSaved();
    }
  };

  // ── Run discovery
  const runDiscovery = async (query: string, searchCountry: string = '') => {
    if (!query.trim()) return;
    setIsDiscovering(true);
    setInfluencers([]);
    setSelectedInfluencer(null);
    setError('');
    setLastQuery(query);

    try {
      const res = await fetch('/api/influencers/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests: [query], country: searchCountry }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Discovery failed');
      setInfluencers(data.influencers || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleChipClick = (niche: string) => {
    setActiveNiche(niche);
    setSearchQuery(niche);
    runDiscovery(niche, country);
  };

  const isSaved = (inf: Influencer) =>
    !!inf.isSaved || savedInfluencers.some((s) => s.id === inf.id);

  const handleAddToRadar = async (e: React.MouseEvent, inf: Influencer) => {
    e.stopPropagation();
    try {
      await fetch('/api/radar/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'linkedin', name: inf.name, url: inf.linkedinUrl, niche: lastQuery }),
      });
      alert(`${inf.name} added to Radar!`);
    } catch { alert('Could not add to Radar.'); }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header + Tab toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Influencer Radar
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Discover thought leaders and craft high-signal comments.
          </p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab('discover')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'discover' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Discover
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'saved' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Qualified Influencers
            {savedInfluencers.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded-full text-xs">
                {savedInfluencers.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ════════════════════ DISCOVER TAB ════════════════════ */}
      {activeTab === 'discover' && (
        <>
          {/* Niche chips */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Niches</p>
            <div className="flex flex-wrap gap-2">
              {NICHE_CHIPS.map((niche) => (
                <button key={niche} onClick={() => handleChipClick(niche)} disabled={isDiscovering}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all disabled:opacity-50 ${
                    activeNiche === niche
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  {niche}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="flex gap-3">
            <input type="text" value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setActiveNiche(null); }}
              onKeyDown={(e) => e.key === 'Enter' && runDiscovery(searchQuery, country)}
              placeholder='Type a niche, e.g. "AI Safety", "Rust programming"…'
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm"
            />
            <select value={country} onChange={(e) => setCountry(e.target.value)}
              className="px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white shadow-sm shrink-0">
              <option value="">Global</option>
              <option value="India">India</option>
              <option value="United States">United States</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Canada">Canada</option>
              <option value="Australia">Australia</option>
              <option value="Singapore">Singapore</option>
              <option value="Germany">Germany</option>
            </select>
            <button onClick={() => runDiscovery(searchQuery, country)}
              disabled={isDiscovering || !searchQuery.trim()}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm shrink-0">
              {isDiscovering
                ? <><RefreshCw className="w-4 h-4 animate-spin" />Searching…</>
                : <><Search className="w-4 h-4" />Discover</>}
            </button>
          </div>

          {/* Loading */}
          {isDiscovering && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium">
                <Sparkles className="w-4 h-4 animate-pulse" />
                Searching for top voices in <span className="font-bold">{lastQuery}</span>…
              </div>
              <InfluencerSkeleton />
            </div>
          )}

          {/* Error */}
          {error && !isDiscovering && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex gap-2">
              <X className="w-4 h-4 shrink-0 mt-0.5" />
              <div><p className="font-medium">Discovery failed</p><p className="mt-0.5">{error}</p></div>
            </div>
          )}

          {/* Empty (initial) */}
          {!isDiscovering && !error && influencers.length === 0 && !lastQuery && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Users className="w-14 h-14 mb-4 text-gray-200" />
              <h3 className="text-lg font-semibold text-gray-600 mb-1">Find Your Industry&apos;s Best Voices</h3>
              <p className="text-sm text-center max-w-xs">Click a niche chip or type a topic above.</p>
            </div>
          )}

          {/* Empty (no results) */}
          {!isDiscovering && !error && influencers.length === 0 && !!lastQuery && (
            <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400">
              <Search className="w-10 h-10 mb-3 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No results for &ldquo;{lastQuery}&rdquo;</p>
            </div>
          )}

          {/* Results */}
          {influencers.length > 0 && !isDiscovering && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  {influencers.length} voices found
                </h2>
                <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">{lastQuery}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {influencers.map((inf, idx) => (
                  <div key={inf.id || idx}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
                    <div className="p-5">
                      {/* Card header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                          {inf.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">{inf.name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{inf.headline}</p>
                        </div>
                      </div>

                      {/* Why follow */}
                      {inf.whyFollow && (
                        <div className="flex gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg mb-4 text-xs text-amber-800 leading-relaxed">
                          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                          <span>{inf.whyFollow}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        {/* ★ SAVE BUTTON */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleToggleSave(inf); }}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors shrink-0 ${
                            isSaved(inf)
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                          }`}
                        >
                          {isSaved(inf)
                            ? <><BookmarkCheck className="w-4 h-4" />Saved</>
                            : <><BookmarkPlus className="w-4 h-4" />Save</>}
                        </button>

                        {/* Comment Studio */}
                        <button type="button" onClick={() => setSelectedInfluencer(inf)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Comment Studio
                        </button>

                        {/* LinkedIn */}
                        <a href={inf.linkedinUrl} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Open LinkedIn Profile">
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        {/* Radar */}
                        <button type="button" onClick={(e) => handleAddToRadar(e, inf)}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Add to Radar Tracking">
                          <Rss className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════ QUALIFIED TAB (CRM) ════════════════════ */}
      {activeTab === 'saved' && (() => {
        // Derive sorted unique company names for the filter dropdown
        const allCompanies = Array.from(
          new Set(savedInfluencers.map(inf => inf.companyName?.trim()).filter(Boolean))
        ).sort() as string[];

        // Apply company filter to saved list
        const filteredInfluencers = companyFilter
          ? savedInfluencers.filter(inf => inf.companyName?.trim() === companyFilter)
          : savedInfluencers;

        return (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex gap-2">
                <button onClick={() => setCrmView('pipeline')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${crmView === 'pipeline' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>
                  <Kanban className="w-4 h-4" /> Pipeline
                </button>
                <button onClick={() => setCrmView('accounts')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${crmView === 'accounts' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>
                  <Building2 className="w-4 h-4" /> Accounts
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Company Filter */}
                <div className="relative">
                  <select
                    value={companyFilter}
                    onChange={e => setCompanyFilter(e.target.value)}
                    className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer"
                  >
                    <option value="">All Companies</option>
                    {allCompanies.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <Building2 className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                {companyFilter && (
                  <button onClick={() => setCompanyFilter('')} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
                <span className="text-sm text-gray-500 pr-1">{filteredInfluencers.length} Tracking</span>
                <button onClick={fetchSaved} title="Refresh DB" className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isLoadingSaved ? (
              <InfluencerSkeleton />
            ) : savedInfluencers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-gray-200 text-gray-400">
                <BookmarkPlus className="w-12 h-12 mb-3 text-gray-300" />
                <p className="text-base font-medium text-gray-500">Your CRM is empty</p>
                <p className="text-sm mt-1 max-w-sm text-center">Discover voices and click <strong>Save</strong> to build your pipeline.</p>
                <button onClick={() => setActiveTab('discover')} className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-700 font-medium rounded-lg hover:bg-indigo-100 transition-colors text-sm">
                  Go to Discovery
                </button>
              </div>
            ) : filteredInfluencers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-dashed border-gray-200 text-gray-400">
                <Building2 className="w-10 h-10 mb-3 text-gray-300" />
                <p className="text-sm font-medium text-gray-500">No targets match the selected company filter.</p>
                <button onClick={() => setCompanyFilter('')} className="mt-3 text-sm text-indigo-600 hover:underline">Clear filter</button>
              </div>
            ) : (
              <>
                {/* --- PIPELINE VIEW --- */}
                {crmView === 'pipeline' && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-4">
                    {['inbox', 'cold', 'engaged', 'connected'].map(col => (
                      <div key={col} className="bg-gray-50 rounded-xl p-3 min-w-[280px]">
                        <div className="flex items-center justify-between mb-3 px-1">
                          <h3 className="font-semibold text-sm text-gray-700 capitalize flex items-center gap-2">
                            {col === 'inbox' && <div className="w-2 h-2 rounded-full bg-gray-400" />}
                            {col === 'cold' && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                            {col === 'engaged' && <div className="w-2 h-2 rounded-full bg-orange-400" />}
                            {col === 'connected' && <div className="w-2 h-2 rounded-full bg-green-400" />}
                            {col === 'inbox' ? 'Inbox (Unverified)' : col === 'cold' ? 'Cold Target' : col}
                          </h3>
                          <span className="text-xs font-medium text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                            {filteredInfluencers.filter(inf => (inf.status || 'inbox') === col).length}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {filteredInfluencers.filter(inf => (inf.status || 'inbox') === col).map(inf => (
                            <div key={inf.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-all relative group">
                              <div className="flex items-start gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                                  {inf.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm text-gray-900 truncate">{inf.name}</h4>
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
                                    <input
                                      type="text"
                                      placeholder="Add Company..."
                                      defaultValue={inf.companyName || ''}
                                      onBlur={(e) => handleUpdateStatus(inf, inf.status || 'inbox', e.target.value)}
                                      className="text-[11px] text-gray-600 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none placeholder:text-gray-300 w-full"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                                <select
                                  value={inf.status || 'inbox'}
                                  onChange={(e) => handleUpdateStatus(inf, e.target.value)}
                                  className="text-[11px] font-medium bg-gray-50 border border-gray-200 text-gray-600 rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                >
                                  <option value="inbox">To Inbox</option>
                                  <option value="cold">To Cold</option>
                                  <option value="engaged">To Engaged</option>
                                  <option value="connected">To Connected</option>
                                </select>

                                <div className="flex items-center gap-0.5">
                                  <button onClick={() => setSelectedInfluencer(inf)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Message Studio">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleLogEngagement(inf)} className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Log Engagement">
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <a href={inf.linkedinUrl} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </div>
                              {inf.lastEngagedAt && (
                                <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Last engaged: {new Date(inf.lastEngagedAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* --- ACCOUNTS VIEW --- */}
                {crmView === 'accounts' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(
                      filteredInfluencers.reduce((acc, inf) => {
                        const comp = inf.companyName?.trim() || 'Unknown Company';
                        if (!acc[comp]) acc[comp] = [];
                        acc[comp].push(inf);
                        return acc;
                      }, {} as Record<string, Influencer[]>)
                    ).sort(([a], [b]) => a.localeCompare(b)).map(([company, employees]) => (
                      <div key={company} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                          <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-indigo-500" />
                            {company}
                          </h3>
                          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                            {employees.length} Target{employees.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="p-4 flex-1 space-y-3">
                          {employees.map(inf => (
                            <div key={inf.id} className="flex items-center justify-between group">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                                  {inf.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-sm font-medium text-gray-900 truncate pr-2">{inf.name}</h4>
                                  <span className={`text-[10px] font-medium capitalize px-1.5 py-0.5 rounded-full ${
                                    inf.status === 'connected' ? 'bg-green-50 text-green-600' :
                                    inf.status === 'engaged' ? 'bg-orange-50 text-orange-600' :
                                    inf.status === 'cold' ? 'bg-blue-50 text-blue-600' :
                                    'bg-gray-100 text-gray-500'
                                  }`}>{inf.status || 'inbox'}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setSelectedInfluencer(inf)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Comment Studio">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                                <a href={inf.linkedinUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Open LinkedIn Profile">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Comment Drawer */}
      {selectedInfluencer && (
        <CommentDrawer influencer={selectedInfluencer} onClose={() => setSelectedInfluencer(null)} />
      )}
    </div>
  );
}
