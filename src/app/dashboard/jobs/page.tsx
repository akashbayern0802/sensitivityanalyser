'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Briefcase,
  RefreshCw,
  Sparkles,
  MapPin,
  Building2,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Trash2,
  Bookmark,
  CheckCircle2,
  Clock,
  SlidersHorizontal,
  PenSquare,
  Users,
  ShieldCheck,
  Loader2,
  KeyRound,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';

interface JobSearchProfile {
  id: string;
  name: string;
  keywords: string;
  location: string;
  workplaceType: string;
  experience: string;
  apifyActorId: string;
  scheduleTime: string;
  isActive: boolean;
  lastSyncedAt: string | null;
}

interface JobPosting {
  id: string;
  profileId: string | null;
  externalId: string | null;
  title: string;
  company: string;
  companyLogo?: string | null;
  location: string;
  workplaceType?: string | null;
  postedAt?: string | null;
  salaryRange?: string | null;
  jobUrl: string;
  description: string;
  source: string;
  matchScore: number;
  matchReasons: string; // JSON string[]
  missingGaps: string; // JSON string[]
  outreachDraft?: string | null;
  authorityPostIdea?: string | null;
  status: 'new' | 'saved' | 'applied' | 'archived';
  syncedDate: string;
  createdAt: string;
}

const APIFY_ACTORS = [
  { id: 'bebity/linkedin-jobs-scraper', label: 'LinkedIn Jobs Scraper (bebity/linkedin-jobs-scraper)' },
  { id: 'curious_coder/linkedin-jobs-scraper', label: 'LinkedIn Jobs Fast (curious_coder/linkedin-jobs-scraper)' },
  { id: 'misceres/indeed-scraper', label: 'Indeed Jobs Scraper (misceres/indeed-scraper)' },
  { id: 'epctex/google-jobs-scraper', label: 'Google Jobs Aggregator (epctex/google-jobs-scraper)' },
];

export default function JobSearchPage() {
  const router = useRouter();

  const [profiles, setProfiles] = useState<JobSearchProfile[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncBanner, setSyncBanner] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [activeStatusTab, setActiveStatusTab] = useState<'all' | 'new' | 'saved' | 'applied'>('all');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Apify Credentials & Actor Drawer
  const [isApifyDrawerOpen, setIsApifyDrawerOpen] = useState(false);
  const [apifyToken, setApifyToken] = useState('');
  const [selectedActorId, setSelectedActorId] = useState('bebity/linkedin-jobs-scraper');
  const [autoDailySync, setAutoDailySync] = useState(true);

  // New Search Profile Modal / Drawer
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileForm, setNewProfileForm] = useState({
    name: '',
    keywords: '',
    location: 'Bangalore, India',
    workplaceType: 'Any',
    experience: 'Executive / Lead',
    apifyActorId: 'bebity/linkedin-jobs-scraper',
    scheduleTime: '08:30',
  });

  // Expanded Job Card Details & Copy states
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [addingCrmJobId, setAddingCrmJobId] = useState<string | null>(null);
  const [addedCrmJobIds, setAddedCrmJobIds] = useState<string[]>([]);

  const getMultiPortalLinks = (job: JobPosting) => {
    const cleanRole = job.title.split('—')[0].split('(')[0].trim();
    const cleanCompany = job.company.trim();
    const rawLoc = job.location || 'India';
    const parts = rawLoc
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const primaryCity = parts[0] || 'Bengaluru';
    const country = parts.length > 2 ? 'India' : parts[1] || 'India';

    const roleSlug = `${cleanRole}-${cleanCompany}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const linkedinUrl =
      job.jobUrl && job.jobUrl.includes('linkedin.com/jobs/view')
        ? job.jobUrl
        : `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
            `"${cleanCompany}" "${cleanRole}"`
          )}&location=${encodeURIComponent(country)}`;

    const naukriUrl =
      job.jobUrl && job.jobUrl.includes('naukri.com')
        ? job.jobUrl
        : `https://www.naukri.com/${encodeURIComponent(roleSlug)}-jobs?k=${encodeURIComponent(
            `${cleanRole} ${cleanCompany}`
          )}&l=${encodeURIComponent(primaryCity.toLowerCase())}`;

    const indeedUrl =
      job.jobUrl && job.jobUrl.includes('indeed.')
        ? job.jobUrl
        : `https://in.indeed.com/jobs?q=${encodeURIComponent(
            `"${cleanCompany}" ${cleanRole}`
          )}&l=${encodeURIComponent(primaryCity)}`;

    const googleJobsUrl = `https://www.google.com/search?q=${encodeURIComponent(
      `"${cleanCompany}" "${cleanRole}" jobs in ${primaryCity} ${country}`
    )}&ibp=htl;jobs`;

    const isDirectAtsOrPortalUrl =
      job.jobUrl &&
      !job.jobUrl.includes('linkedin.com/jobs/search') &&
      !job.jobUrl.includes('vertexaisearch.cloud.google.com');

    const primaryUrl = isDirectAtsOrPortalUrl ? job.jobUrl : googleJobsUrl;

    let primaryLabel = 'View on Google Jobs';
    if (primaryUrl.includes('naukri.com')) primaryLabel = 'Apply on Naukri';
    else if (primaryUrl.includes('indeed.')) primaryLabel = 'Apply on Indeed';
    else if (primaryUrl.includes('linkedin.com/jobs/view')) primaryLabel = 'Direct LinkedIn Job';
    else if (primaryUrl.includes('greenhouse.io')) primaryLabel = 'Apply on Greenhouse';
    else if (primaryUrl.includes('lever.co')) primaryLabel = 'Apply on Lever';
    else if (primaryUrl.includes('wellfound.com')) primaryLabel = 'Apply on Wellfound';
    else if (primaryUrl.includes('instahyre.com')) primaryLabel = 'Apply on Instahyre';
    else if (!primaryUrl.includes('google.com/search')) primaryLabel = `Apply (${job.source || 'Direct'})`;

    return {
      primaryUrl,
      primaryLabel,
      linkedinUrl,
      naukriUrl,
      indeedUrl,
      googleJobsUrl,
    };
  };

  const getLLMConfig = () => {
    if (typeof window === 'undefined') return undefined;
    const provider = localStorage.getItem('sa_provider') || 'gemini';
    return {
      provider,
      modelId: localStorage.getItem('sa_model') || 'gemini-2.5-flash',
      apiKey: localStorage.getItem(`sa_apiKey_${provider}`) || '',
    };
  };

  // Load saved Apify settings from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('sa_apifyToken') || '';
    const savedActor = localStorage.getItem('sa_apifyActorId') || 'bebity/linkedin-jobs-scraper';
    const savedAuto = localStorage.getItem('sa_apifyAutoDaily');
    setApifyToken(savedToken);
    setSelectedActorId(savedActor);
    if (savedAuto !== null) {
      setAutoDailySync(savedAuto === 'true');
    }
  }, []);

  const handleSaveApifyConfig = () => {
    localStorage.setItem('sa_apifyToken', apifyToken.trim());
    localStorage.setItem('sa_apifyActorId', selectedActorId);
    localStorage.setItem('sa_apifyAutoDaily', String(autoDailySync));
    setSyncBanner({
      type: 'success',
      text: '✓ Saved Apify API Token & Daily Actor configuration.',
    });
    setIsApifyDrawerOpen(false);
  };

  const handleSyncDailyFeed = useCallback(
    async (profileIdToSync?: string, silentAutoTrigger = false) => {
      setIsSyncing(true);
      if (!silentAutoTrigger) {
        setSyncBanner({
          type: 'info',
          text: 'Running Apify Job Scraper & scoring roles against your Knowledge Vault...',
        });
      }

      try {
        const token = localStorage.getItem('sa_apifyToken') || apifyToken;
        const actor = localStorage.getItem('sa_apifyActorId') || selectedActorId;

        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync-daily',
            profileId: profileIdToSync && profileIdToSync !== 'all' ? profileIdToSync : undefined,
            apifyToken: token || undefined,
            actorIdOverride: actor || undefined,
            modelConfig: getLLMConfig(),
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to sync daily job feed');
        }

        setJobs(data.jobs || []);
        if (data.profiles) setProfiles(data.profiles);

        setSyncBanner({
          type: 'success',
          text: `✓ Daily Job Feed Synced (${data.syncedCount} roles scored). ${data.message || ''}`,
        });
      } catch (err: any) {
        setSyncBanner({
          type: 'error',
          text: err.message || 'Error syncing daily job feed',
        });
      } finally {
        setIsSyncing(false);
      }
    },
    [apifyToken, selectedActorId]
  );

  const loadJobsAndProfiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      if (data.success) {
        setProfiles(data.profiles || []);
        setJobs(data.jobs || []);

        // Automatic Daily Feed Generation: if no jobs have been synced for today's date yet, trigger automatically!
        const shouldAuto = localStorage.getItem('sa_apifyAutoDaily') !== 'false';
        if (shouldAuto && (!data.hasSyncedToday || (data.jobs || []).length === 0)) {
          handleSyncDailyFeed(undefined, true);
        }
      }
    } catch (e) {
      console.error('Failed to load jobs:', e);
    } finally {
      setIsLoading(false);
    }
  }, [handleSyncDailyFeed]);

  useEffect(() => {
    loadJobsAndProfiles();
  }, [loadJobsAndProfiles]);

  const handleCreateProfile = async () => {
    if (!newProfileForm.name.trim() || !newProfileForm.keywords.trim()) {
      alert('Please enter both a profile name and target keywords.');
      return;
    }
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-profile',
          ...newProfileForm,
        }),
      });
      const data = await res.json();
      if (data.success && data.profile) {
        setProfiles((prev) => [...prev, data.profile]);
        setNewProfileForm({
          name: '',
          keywords: '',
          location: 'Bangalore, India',
          workplaceType: 'Any',
          experience: 'Executive / Lead',
          apifyActorId: selectedActorId,
          scheduleTime: '08:30',
        });
        setIsAddingProfile(false);
        // Immediately sync jobs for the new profile
        handleSyncDailyFeed(data.profile.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create job search profile');
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (profiles.length <= 1) {
      alert('Keep at least one active Job Search Profile for your daily feed.');
      return;
    }
    try {
      await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-profile', id }),
      });
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      if (selectedProfileId === id) setSelectedProfileId('all');
    } catch (e) {
      console.error('Failed to delete profile', e);
    }
  };

  const handleUpdateJobStatus = async (jobId: string, status: 'new' | 'saved' | 'applied' | 'archived') => {
    try {
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));
      await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-job-status', jobId, status }),
      });
    } catch (e) {
      console.error('Failed to update job status', e);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDraftAuthorityPost = (job: JobPosting) => {
    const topic =
      job.authorityPostIdea ||
      `Strategic Playbook: Solving ${job.title.split('—')[0].trim()} Scale Challenges at ${job.company}`;
    const angle = `Written to demonstrate executive domain authority for ${job.company}'s ${job.title} charter.`;
    router.push(
      `/dashboard/content?topic=${encodeURIComponent(topic)}&angle=${encodeURIComponent(angle)}&format=${encodeURIComponent('Story / Case Study')}`
    );
  };

  const handleAddHiringTeamToCrm = async (job: JobPosting) => {
    setAddingCrmJobId(job.id);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-to-crm',
          company: job.company,
          title: job.title,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAddedCrmJobIds((prev) => [...prev, job.id]);
        setSyncBanner({
          type: 'success',
          text: `✓ Added ${job.company} Product & Hiring Leadership to your Influencer CRM (Qualified Influencers → Pipeline Inbox)!`,
        });
      } else {
        throw new Error(data.error || 'Failed to add to CRM');
      }
    } catch (e: any) {
      console.error('Failed to add to CRM', e);
      setSyncBanner({
        type: 'error',
        text: e.message || 'Could not add company to CRM',
      });
    } finally {
      setAddingCrmJobId(null);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (activeStatusTab === 'all' && job.status === 'archived') return false;
    if (activeStatusTab !== 'all' && job.status !== activeStatusTab) return false;
    if (selectedProfileId !== 'all' && job.profileId !== selectedProfileId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q) ||
        job.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const parseJsonArray = (raw: string): string[] => {
    try {
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Executive Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-indigo-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                Apify Daily Job Intelligence
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Knowledge Vault Match Scoring
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5 mt-1">
              <Briefcase className="w-6 h-6 text-indigo-400" />
              Daily Executive Job Feed &amp; Authority Pipeline
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl">
              Automatically scrapes LinkedIn, Indeed, and Google Jobs daily via Apify Actors, scores every opening against your Knowledge Vault, and generates warm Hiring Manager outreach + inbound authority post angles.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsApifyDrawerOpen(!isApifyDrawerOpen)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-300" />
              <span>Apify Actor Config</span>
              {apifyToken ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400" title="Apify API Token configured" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-400" title="Using Hybrid Discovery (Add Apify Token for direct Actor runs)" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsAddingProfile(!isAddingProfile)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-300" />
              <span>New Search Feed</span>
            </button>

            <button
              type="button"
              onClick={() => handleSyncDailyFeed(selectedProfileId)}
              disabled={isSyncing}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Syncing Apify Feed...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Sync Today&apos;s Job Feed Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Apify Configuration Drawer */}
        {isApifyDrawerOpen && (
          <div className="mt-5 pt-5 border-t border-white/15 grid grid-cols-1 md:grid-cols-12 gap-4 bg-black/25 p-4 rounded-xl">
            <div className="md:col-span-5 space-y-1">
              <label className="block text-xs font-semibold text-indigo-200">
                Apify API Token (from console.apify.com → Settings → Integrations)
              </label>
              <input
                type="password"
                value={apifyToken}
                onChange={(e) => setApifyToken(e.target.value)}
                placeholder="apify_api_..."
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
              />
              <p className="text-[11px] text-slate-400">
                Triggers live Apify Actor runs (`run-sync-get-dataset-items`) or pulls your latest scheduled dataset.
              </p>
            </div>

            <div className="md:col-span-4 space-y-1">
              <label className="block text-xs font-semibold text-indigo-200">Default Apify Job Scraper Actor</label>
              <select
                value={selectedActorId}
                onChange={(e) => setSelectedActorId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-400"
              >
                {APIFY_ACTORS.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Supports any LinkedIn, Indeed, or Google Jobs scraper Actor ID.
              </p>
            </div>

            <div className="md:col-span-3 flex flex-col justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={autoDailySync}
                  onChange={(e) => setAutoDailySync(e.target.checked)}
                  className="rounded border-slate-600 text-indigo-600 focus:ring-0"
                />
                <span>Auto-generate feed every day on first visit</span>
              </label>

              <div className="flex items-center gap-2 justify-end mt-3">
                <button
                  type="button"
                  onClick={() => setIsApifyDrawerOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveApifyConfig}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  Save Apify Config
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Search Feed Form Drawer */}
        {isAddingProfile && (
          <div className="mt-5 pt-5 border-t border-white/15 bg-black/25 p-4 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                Create Daily Job Feed Watchlist
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingProfile(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-indigo-200 mb-1">Feed Name</label>
                <input
                  type="text"
                  value={newProfileForm.name}
                  onChange={(e) => setNewProfileForm({ ...newProfileForm, name: e.target.value })}
                  placeholder="e.g., India FinTech VP / Director Roles"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-indigo-200 mb-1">
                  Keywords &amp; Role Titles (comma-separated)
                </label>
                <input
                  type="text"
                  value={newProfileForm.keywords}
                  onChange={(e) => setNewProfileForm({ ...newProfileForm, keywords: e.target.value })}
                  placeholder="VP Product, Director of Product, Payments, UPI, AI"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-indigo-200 mb-1">Target Location</label>
                <input
                  type="text"
                  value={newProfileForm.location}
                  onChange={(e) => setNewProfileForm({ ...newProfileForm, location: e.target.value })}
                  placeholder="Bangalore, India or Remote"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-indigo-200 mb-1">Workplace Mode</label>
                <select
                  value={newProfileForm.workplaceType}
                  onChange={(e) => setNewProfileForm({ ...newProfileForm, workplaceType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                >
                  <option value="Any">Any (Remote / Hybrid / On-site)</option>
                  <option value="Remote">Remote Only</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="On-site">On-site</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-indigo-200 mb-1">Seniority Tier</label>
                <select
                  value={newProfileForm.experience}
                  onChange={(e) => setNewProfileForm({ ...newProfileForm, experience: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                >
                  <option value="Executive / Lead">Executive / VP / Head of Product</option>
                  <option value="Director">Director / Principal</option>
                  <option value="Mid-Senior">Senior / Staff PM</option>
                </select>
              </div>

              <div className="flex items-end justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCreateProfile}
                  className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                >
                  + Save &amp; Sync Feed Immediately
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sync Status Banner */}
      {syncBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            syncBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : syncBanner.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {syncBanner.type === 'info' && <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />}
            {syncBanner.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {syncBanner.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{syncBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncBanner(null)}
            className="text-gray-400 hover:text-gray-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Active Daily Search Profiles Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Active Daily Apify Watchlists ({profiles.length})
            </span>
          </div>
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Auto-refreshes daily · Grounded against your Knowledge Vault
          </span>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedProfileId('all')}
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all ${
              selectedProfileId === 'all'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            All Watchlists ({jobs.filter((j) => j.status !== 'archived').length})
          </button>

          {profiles.map((prof) => (
            <div
              key={prof.id}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs transition-all ${
                selectedProfileId === prof.id
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-semibold'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedProfileId(prof.id)}
                className="text-left flex items-center gap-2"
              >
                <div>
                  <div className="font-semibold text-xs leading-tight">{prof.name}</div>
                  <div className="text-[10px] text-gray-500 truncate max-w-[220px]">
                    {prof.location} · {prof.keywords}
                  </div>
                </div>
              </button>
              {profiles.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteProfile(prof.id)}
                  className="text-gray-400 hover:text-rose-600 p-1"
                  title="Delete watchlist"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-white border border-gray-200 p-1 shadow-2xs">
          {(
            [
              { id: 'all', label: 'Daily Feed', count: jobs.filter((j) => j.status !== 'archived').length },
              { id: 'new', label: 'New Today', count: jobs.filter((j) => j.status === 'new').length },
              { id: 'saved', label: 'Saved Roles', count: jobs.filter((j) => j.status === 'saved').length },
              { id: 'applied', label: 'Applied', count: jobs.filter((j) => j.status === 'applied').length },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveStatusTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeStatusTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeStatusTab === tab.id ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by company, role, UPI, AI, location..."
            className="w-full sm:w-72 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Job Feed Cards */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
          <Loader2 className="w-7 h-7 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-gray-800">Loading your Daily Executive Job Feed...</p>
          <p className="text-xs text-gray-500">Checking Apify datasets and Knowledge Vault fit scores</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
          <Briefcase className="w-8 h-8 text-gray-400 mx-auto" />
          <p className="text-sm font-semibold text-gray-800">No job postings match this filter yet</p>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Click <strong>&quot;Sync Today&apos;s Job Feed Now&quot;</strong> above to trigger your Apify scraper and generate fresh executive job matches.
          </p>
          <button
            type="button"
            onClick={() => handleSyncDailyFeed(selectedProfileId)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync Daily Feed Now
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => {
            const matchReasons = parseJsonArray(job.matchReasons);
            const missingGaps = parseJsonArray(job.missingGaps);
            const isExpanded = expandedJobId === job.id;

            return (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-gray-200 hover:border-indigo-300 shadow-xs transition-all overflow-hidden"
              >
                <div className="p-5 space-y-4">
                  {/* Top Row: Role, Company, Location & Vault Match Badge */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                        {job.company
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-gray-900">{job.title}</h3>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            🌐 {job.source || 'Multi-Portal'}
                          </span>
                          {job.status === 'saved' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              ★ Saved
                            </span>
                          )}
                          {job.status === 'applied' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              ✓ Applied
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-600">
                          <span className="font-semibold text-indigo-700 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {job.company}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {job.location}
                          </span>
                          {job.workplaceType && (
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-medium">
                              {job.workplaceType}
                            </span>
                          )}
                          {job.salaryRange && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                              {job.salaryRange}
                            </span>
                          )}
                          <span className="text-[11px] text-gray-400">
                            · {job.postedAt || 'Today'} · Synced {job.syncedDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Vault Fit Score Badge */}
                    <div className="flex items-center gap-2 self-start">
                      <div
                        className={`px-3 py-1.5 rounded-xl border text-right ${
                          job.matchScore >= 90
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : job.matchScore >= 82
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                          Vault Fit Score
                        </div>
                        <div className="text-base font-black leading-none mt-0.5">{job.matchScore}% Match</div>
                      </div>
                    </div>
                  </div>

                  {/* Description Snippet */}
                  <p className="text-xs text-gray-700 leading-relaxed">{job.description}</p>

                  {/* Grounded Match Reasons Pills */}
                  {matchReasons.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mr-1">
                        Why You Match:
                      </span>
                      {matchReasons.map((reason, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-[11px] font-medium"
                        >
                          ✓ {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Inbound Authority Post Idea Bar (Direct Bridge to Content Studio) */}
                  {job.authorityPostIdea && (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-indigo-50/90 border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          Inbound Authority Magnet (Post this to attract {job.company}&apos;s Hiring Team)
                        </span>
                        <p className="text-xs font-semibold text-gray-900">{job.authorityPostIdea}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDraftAuthorityPost(job)}
                        className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 shadow-2xs transition-colors shrink-0"
                      >
                        <PenSquare className="w-3.5 h-3.5" />
                        <span>Draft in Content Studio →</span>
                      </button>
                    </div>
                  )}

                  {/* Action Toolbar */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
                    {(() => {
                      const portalLinks = getMultiPortalLinks(job);
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Primary Exact Match / ATS / Google Jobs Button */}
                          <a
                            href={portalLinks.primaryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                          >
                            <span>{portalLinks.primaryLabel}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          {/* Multi-Portal Direct Links: Naukri, Indeed, LinkedIn */}
                          <a
                            href={portalLinks.naukriUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                            title={`Search ${job.title} at ${job.company} on Naukri.com`}
                          >
                            <span>Naukri</span>
                            <ExternalLink className="w-3 h-3 opacity-70" />
                          </a>

                          <a
                            href={portalLinks.indeedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                            title={`Search ${job.title} at ${job.company} on Indeed`}
                          >
                            <span>Indeed</span>
                            <ExternalLink className="w-3 h-3 opacity-70" />
                          </a>

                          <a
                            href={portalLinks.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                            title={`Search ${job.title} at ${job.company} on LinkedIn`}
                          >
                            <span>LinkedIn</span>
                            <ExternalLink className="w-3 h-3 opacity-70" />
                          </a>

                          <button
                            type="button"
                            onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <span>Warm DM &amp; Prep</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAddHiringTeamToCrm(job)}
                            disabled={addingCrmJobId === job.id || addedCrmJobIds.includes(job.id)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                              addedCrmJobIds.includes(job.id)
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200'
                            }`}
                          >
                            {addingCrmJobId === job.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : addedCrmJobIds.includes(job.id) ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Users className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {addedCrmJobIds.includes(job.id)
                                ? `Added ${job.company} to CRM`
                                : `+ Add ${job.company} to CRM`}
                            </span>
                          </button>
                        </div>
                      );
                    })()}

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateJobStatus(job.id, job.status === 'saved' ? 'new' : 'saved')
                        }
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                          job.status === 'saved'
                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>{job.status === 'saved' ? 'Saved' : 'Save'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateJobStatus(job.id, job.status === 'applied' ? 'new' : 'applied')
                        }
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                          job.status === 'applied'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{job.status === 'applied' ? 'Applied' : 'Mark Applied'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateJobStatus(job.id, 'archived')}
                        className="px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-rose-600 transition-colors"
                        title="Archive role"
                      >
                        Archive
                      </button>
                    </div>
                  </div>

                  {/* Expanded Warm Outreach DM & Gap Analysis Drawer */}
                  {isExpanded && (
                    <div className="mt-3 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-50 p-4 rounded-xl">
                      <div className="md:col-span-8 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">
                            💬 Warm Hiring Manager / CXO Outreach Note
                          </span>
                          {job.outreachDraft && (
                            <button
                              type="button"
                              onClick={() => handleCopyText(job.outreachDraft!, `dm_${job.id}`)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                            >
                              {copiedId === `dm_${job.id}` ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy DM</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">
                          {job.outreachDraft ||
                            `Hi ${job.company} Team — saw the ${job.title} role. Having scaled Indian banking and payment products, I'd love to share a quick breakdown of how we approached unit economics and scale in this exact space.`}
                        </div>
                      </div>

                      <div className="md:col-span-4 space-y-2">
                        <span className="text-xs font-bold text-slate-800 block">
                          🎯 Interview Positioning &amp; Nuances
                        </span>
                        <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2 text-xs">
                          {missingGaps.length > 0 ? (
                            missingGaps.map((gap, idx) => (
                              <div key={idx} className="text-amber-900 bg-amber-50/70 p-2 rounded border border-amber-200">
                                💡 {gap}
                              </div>
                            ))
                          ) : (
                            <p className="text-gray-600">
                              Direct match with your Knowledge Vault items. Emphasize quantified P&amp;L and TPS scale metrics.
                            </p>
                          )}
                          <div className="pt-1 flex items-center justify-between text-[11px] text-gray-400">
                            <span>Source: {job.source}</span>
                            <Link href="/dashboard/settings" className="text-indigo-600 hover:underline">
                              Update Vault →
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

