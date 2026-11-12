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
  { id: 'all_rounder/naukri-jobs-scraper', label: 'Naukri.com Jobs Scraper (all_rounder/naukri-jobs-scraper)' },
  { id: 'easyapi/naukri-jobs-scraper', label: 'Naukri.com Fast Scraper (easyapi/naukri-jobs-scraper)' },
  { id: 'misceres/indeed-scraper', label: 'Indeed Jobs Scraper (misceres/indeed-scraper)' },
  { id: 'borderline/indeed-scraper', label: 'Indeed India & Global Scraper (borderline/indeed-scraper)' },
  { id: 'epctex/google-jobs-scraper', label: 'Google Jobs Aggregator (epctex/google-jobs-scraper)' },
  { id: 'shahidirfan/Glassdoor-Jobs-Scraper', label: 'Glassdoor Jobs Scraper (shahidirfan/Glassdoor-Jobs-Scraper)' },
];

const WORKPLACE_OPTIONS = [
  { id: 'Remote', label: 'Remote' },
  { id: 'Hybrid', label: 'Hybrid' },
  { id: 'On-site', label: 'On-site' },
];

const SENIORITY_OPTIONS = [
  { id: 'Executive / Lead', label: 'Executive / VP / Head of Product' },
  { id: 'Director', label: 'Director / Principal' },
  { id: 'Mid-Senior', label: 'Senior / Staff PM' },
];

function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: Array<{ id: string; label: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  const toggleItem = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const selectAll = () => onChange(options.map((o) => o.id));
  const clearAll = () => onChange([]);

  const summaryText =
    selected.length === 0
      ? placeholder
      : selected.length === options.length
      ? `All Selected (${options.length})`
      : selected
          .map((id) => options.find((o) => o.id === id)?.label.split(' (')[0] || id)
          .join(', ');

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-indigo-400 text-xs text-white flex items-center justify-between gap-2 text-left transition-colors"
      >
        <span className="truncate">{summaryText}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-200 text-[10px] font-bold">
            {selected.length}
          </span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-2 space-y-1 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800 text-[10px] text-slate-400">
            <span>{selected.length} of {options.length} selected</span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={selectAll}
                className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>
          {options.map((opt) => {
            const isChecked = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleItem(opt.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left cursor-pointer transition-colors ${
                  isChecked
                    ? 'bg-indigo-600/25 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                    isChecked
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-950 border-slate-600 text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  const [selectedActorIds, setSelectedActorIds] = useState<string[]>([
    'bebity/linkedin-jobs-scraper',
    'epctex/google-jobs-scraper',
  ]);
  const [autoDailySync, setAutoDailySync] = useState(true);

  // New Search Profile Modal / Drawer
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileForm, setNewProfileForm] = useState({
    name: '',
    keywords: '',
    location: 'Bangalore, India',
    workplaceTypes: ['Remote', 'Hybrid', 'On-site'],
    experiences: ['Executive / Lead', 'Director'],
    scheduleTime: '08:30',
  });

  // Expanded Job Card Details & Copy states
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [expandedDescIds, setExpandedDescIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [addingCrmJobId, setAddingCrmJobId] = useState<string | null>(null);
  const [addedCrmJobIds, setAddedCrmJobIds] = useState<string[]>([]);

  /**
   * Formats raw or previously saved single-line job descriptions (with inline `* ` bullets or section headers)
   * into clean, structured paragraphs and bullet points.
   */
  const formatDescriptionForDisplay = (raw: string): string => {
    if (!raw) return '';
    let text = String(raw)
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*\/p\s*>/gi, '\n\n')
      .replace(/<\s*li[^>]*>/gi, '\n• ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&');

    text = text.replace(
      /\s+(About The Team|About the Team|About The Role|About the Role|What Will You Do|What You Will Do|What You'll Do|What You Will Need|What You'll Need|Key Responsibilities|Responsibilities|Requirements|Qualifications|Minimum Qualifications|Preferred Qualifications|Who You Are|Why Join Us)\b/g,
      '\n\n$1:\n'
    );

    text = text.replace(/\s+\*\s+(?=[A-Z0-9])/g, '\n• ');
    text = text.replace(/\s+•\s+/g, '\n• ');

    return text
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  /**
   * Resolves ONLY the single relevant apply link for the portal where this job was sourced.
   * E.g., if the job is from LinkedIn Jobs -> only show the LinkedIn link.
   * If from Naukri -> only Naukri link. If from Indeed -> only Indeed link.
   */
  const getSingleRelevantPortalLink = (job: JobPosting) => {
    const cleanRole = job.title.split('—')[0].split('(')[0].trim();
    const cleanCompany = job.company.trim();
    const rawLoc = job.location || 'India';
    const parts = rawLoc
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const primaryCity = parts[0] || 'Bengaluru';
    const country = parts.length > 2 ? 'India' : parts[1] || 'India';

    const sourceLower = (job.source || '').toLowerCase();
    const urlLower = (job.jobUrl || '').toLowerCase();

    // 1. LinkedIn Jobs
    if (sourceLower.includes('linkedin') || urlLower.includes('linkedin.com')) {
      const url =
        job.jobUrl && !urlLower.includes('linkedin.com/jobs/search')
          ? job.jobUrl
          : `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
              `"${cleanCompany}" "${cleanRole}"`
            )}&location=${encodeURIComponent(country)}`;
      return {
        url,
        label: 'View / Apply on LinkedIn',
      };
    }

    // 2. Naukri.com
    if (sourceLower.includes('naukri') || urlLower.includes('naukri.com')) {
      const roleSlug = `${cleanRole}-${cleanCompany}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const url =
        job.jobUrl && urlLower.includes('naukri.com')
          ? job.jobUrl
          : `https://www.naukri.com/${encodeURIComponent(roleSlug)}-jobs?k=${encodeURIComponent(
              `${cleanRole} ${cleanCompany}`
            )}&l=${encodeURIComponent(primaryCity.toLowerCase())}`;
      return {
        url,
        label: 'View / Apply on Naukri.com',
      };
    }

    // 3. Indeed
    if (sourceLower.includes('indeed') || urlLower.includes('indeed.')) {
      const url =
        job.jobUrl && urlLower.includes('indeed.')
          ? job.jobUrl
          : `https://in.indeed.com/jobs?q=${encodeURIComponent(
              `"${cleanCompany}" ${cleanRole}`
            )}&l=${encodeURIComponent(primaryCity)}`;
      return {
        url,
        label: 'View / Apply on Indeed',
      };
    }

    // 4. Specific ATS or Portal (Wellfound, Instahyre, Greenhouse, Lever, Company Careers, Google Jobs)
    if (
      job.jobUrl &&
      job.jobUrl.startsWith('http') &&
      !urlLower.includes('vertexaisearch.cloud.google.com')
    ) {
      let portalName = job.source || 'Job Portal';
      if (urlLower.includes('greenhouse.io')) portalName = 'Greenhouse';
      else if (urlLower.includes('lever.co')) portalName = 'Lever';
      else if (urlLower.includes('wellfound.com')) portalName = 'Wellfound';
      else if (urlLower.includes('instahyre.com')) portalName = 'Instahyre';
      else if (urlLower.includes('google.com/search')) portalName = 'Google Jobs';

      return {
        url: job.jobUrl,
        label: `View / Apply on ${portalName}`,
      };
    }

    // Default fallback to Google Jobs for that role
    return {
      url: `https://www.google.com/search?q=${encodeURIComponent(
        `"${cleanCompany}" "${cleanRole}" jobs in ${primaryCity} ${country}`
      )}&ibp=htl;jobs`,
      label: `View / Apply (${job.source || 'Direct'})`,
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
    const savedActor =
      localStorage.getItem('sa_apifyActorId') ||
      'bebity/linkedin-jobs-scraper,epctex/google-jobs-scraper';
    const savedAuto = localStorage.getItem('sa_apifyAutoDaily');
    setApifyToken(savedToken);
    const parsedActors = savedActor
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsedActors.length > 0) {
      setSelectedActorIds(parsedActors);
    }
    if (savedAuto !== null) {
      setAutoDailySync(savedAuto === 'true');
    }
  }, []);

  const handleSaveApifyConfig = () => {
    const joinedActors = selectedActorIds.join(',');
    localStorage.setItem('sa_apifyToken', apifyToken.trim());
    localStorage.setItem('sa_apifyActorId', joinedActors);
    localStorage.setItem('sa_apifyAutoDaily', String(autoDailySync));
    setSyncBanner({
      type: 'success',
      text: `✓ Saved Apify API Token & ${selectedActorIds.length} Daily Scraper Actor(s).`,
    });
    setIsApifyDrawerOpen(false);
  };

  const handleSyncDailyFeed = useCallback(
    async (profileIdToSync?: string, silentAutoTrigger = false) => {
      setIsSyncing(true);
      if (!silentAutoTrigger) {
        setSyncBanner({
          type: 'info',
          text: 'Running selected Apify Job Scraper Actors & scoring roles against your Knowledge Vault...',
        });
      }

      try {
        const token = localStorage.getItem('sa_apifyToken') || apifyToken;
        const actor =
          localStorage.getItem('sa_apifyActorId') || selectedActorIds.join(',');

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
    [apifyToken, selectedActorIds]
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
      const workplaceType =
        newProfileForm.workplaceTypes.length === WORKPLACE_OPTIONS.length
          ? 'Any'
          : newProfileForm.workplaceTypes.join(', ');
      const experience = newProfileForm.experiences.join(', ');

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-profile',
          name: newProfileForm.name,
          keywords: newProfileForm.keywords,
          location: newProfileForm.location,
          workplaceType,
          experience,
          apifyActorId: selectedActorIds.join(','),
          scheduleTime: newProfileForm.scheduleTime,
        }),
      });
      const data = await res.json();
      if (data.success && data.profile) {
        setProfiles((prev) => [...prev, data.profile]);
        setNewProfileForm({
          name: '',
          keywords: '',
          location: 'Bangalore, India',
          workplaceTypes: ['Remote', 'Hybrid', 'On-site'],
          experiences: ['Executive / Lead', 'Director'],
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
              <label className="block text-xs font-semibold text-indigo-200">
                Apify Job Scraper Actors (Multi-Select)
              </label>
              <MultiSelectDropdown
                options={APIFY_ACTORS}
                selected={selectedActorIds}
                onChange={setSelectedActorIds}
                placeholder="Select Apify Job Scrapers..."
              />
              <p className="text-[11px] text-slate-400">
                Select multiple actors (LinkedIn, Indeed, Google Jobs) to aggregate in parallel.
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
                <label className="block text-[11px] font-semibold text-indigo-200 mb-1">
                  Workplace Mode (Multi-Select)
                </label>
                <MultiSelectDropdown
                  options={WORKPLACE_OPTIONS}
                  selected={newProfileForm.workplaceTypes}
                  onChange={(next) => setNewProfileForm({ ...newProfileForm, workplaceTypes: next })}
                  placeholder="Select workplace modes..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-indigo-200 mb-1">
                  Seniority Tier (Multi-Select)
                </label>
                <MultiSelectDropdown
                  options={SENIORITY_OPTIONS}
                  selected={newProfileForm.experiences}
                  onChange={(next) => setNewProfileForm({ ...newProfileForm, experiences: next })}
                  placeholder="Select seniority tiers..."
                />
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

                  {/* Formatted & Collapsible Description Snippet */}
                  {(() => {
                    const formattedDesc = formatDescriptionForDisplay(job.description);
                    const isDescExpanded = expandedDescIds.includes(job.id);
                    const isLongDesc = formattedDesc.length > 360 || formattedDesc.split('\n').length > 5;
                    const displayDesc =
                      isLongDesc && !isDescExpanded
                        ? `${formattedDesc.slice(0, 360).trim()}...`
                        : formattedDesc;

                    return (
                      <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                        <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-line font-sans">
                          {displayDesc}
                        </div>
                        {isLongDesc && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDescIds((prev) =>
                                prev.includes(job.id)
                                  ? prev.filter((id) => id !== job.id)
                                  : [...prev, job.id]
                              )
                            }
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                          >
                            {isDescExpanded ? (
                              <>
                                <span>Show concise summary</span>
                                <ChevronUp className="w-3 h-3" />
                              </>
                            ) : (
                              <>
                                <span>Read full job description</span>
                                <ChevronDown className="w-3 h-3" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })()}

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
                      const portalLink = getSingleRelevantPortalLink(job);
                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Single Relevant Portal Link */}
                          <a
                            href={portalLink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                          >
                            <span>{portalLink.label}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
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

