'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar, Loader2, Sparkles, FileText, MessageSquare,
  Clock, RefreshCw, ParkingCircle, ChevronDown, Zap,
  TrendingUp, Users, BookOpen,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PostItem {
  day: string;
  time: string;
  format: string;
  topic: string;
  angle: string;
  archetype?: string;
  whyThisTime?: string;
}

interface EngagementItem {
  day: string;
  time: string;
  targetRole: string;
  goal: string;
}

interface WeeklyPlan {
  mode: 'weekly';
  focusTopic: string;
  goldenHoursInsight: string;
  recruiterStrategy: string;
  posts: PostItem[];
  engagement: EngagementItem[];
}

interface MonthlyPlan {
  mode: 'monthly';
  overallTheme: string;
  goldenHoursInsight: string;
  recruiterStrategy: string;
  weeks: { weekNumber: number; weekTheme: string; posts: PostItem[]; engagement: EngagementItem[] }[];
}

type Plan = WeeklyPlan | MonthlyPlan;

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const ARCHETYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  AUTHORITY_BUILDER: { label: 'Authority Builder', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <TrendingUp className="w-3 h-3" /> },
  NETWORK_ACTIVATOR: { label: 'Network Activator', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: <Users className="w-3 h-3" /> },
  EXPERIENCE_SHARE: { label: 'Experience Share', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: <BookOpen className="w-3 h-3" /> },
  ENGAGEMENT_SPRINT: { label: 'Engagement Sprint', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: <MessageSquare className="w-3 h-3" /> },
};

const FORMAT_EMOJI: Record<string, string> = {
  carousel: '🎠', listicle: '📋', text: '✍️', story: '📖', poll: '📊',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getModelConfig() {
  if (typeof window === 'undefined') return { provider: 'openai', modelId: 'gpt-4o-mini' };
  
  const provider = localStorage.getItem('sa_provider') || 'openai';
  return {
    provider,
    modelId: localStorage.getItem('sa_model') || 'gpt-4o-mini',
    apiKey: localStorage.getItem(`sa_apiKey_${provider}`) || '',
    awsSecretKey: provider === 'amazon-bedrock' ? (localStorage.getItem('sa_awsSecretKey_amazon-bedrock') || '') : '',
    ollamaBaseUrl: localStorage.getItem('sa_baseUrl') || '',
    bedrockRegion: localStorage.getItem('sa_region') || ''
  };
}

function getUserProfile() {
  if (typeof window === 'undefined') return {};
  try {
    const interests = JSON.parse(localStorage.getItem('sa_interests') || '[]');
    return {
      name: localStorage.getItem('sa_name') || '',
      linkedinUrl: localStorage.getItem('sa_linkedinUrl') || '',
      targetRole: localStorage.getItem('sa_targetRole') || '',
      targetLocation: localStorage.getItem('sa_location') || '',
      interests,
    };
  } catch {
    return {
      name: localStorage.getItem('sa_name') || '',
      linkedinUrl: localStorage.getItem('sa_linkedinUrl') || '',
      targetRole: localStorage.getItem('sa_targetRole') || '',
      targetLocation: localStorage.getItem('sa_location') || '',
      interests: [],
    };
  }
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function KanbanCard({
  item, type, onDraft, onSwap, onMoveTo, isSwapping, allDays,
}: {
  item: PostItem | EngagementItem;
  type: 'post' | 'engagement';
  onDraft?: () => void;
  onSwap?: () => void;
  onMoveTo?: (day: string) => void;
  isSwapping?: boolean;
  allDays: string[];
}) {
  const [hovered, setHovered] = useState(false);
  const [showDayMenu, setShowDayMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowDayMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const post = type === 'post' ? (item as PostItem) : null;
  const eng = type === 'engagement' ? (item as EngagementItem) : null;
  const archetype = post?.archetype || (type === 'engagement' ? 'ENGAGEMENT_SPRINT' : 'AUTHORITY_BUILDER');
  const archetypeConf = ARCHETYPE_CONFIG[archetype] || ARCHETYPE_CONFIG.AUTHORITY_BUILDER;

  return (
    <div
      className={`group relative rounded-xl border bg-white shadow-sm transition-all duration-200 cursor-default
        ${archetypeConf.border}
        ${hovered ? 'shadow-md -translate-y-0.5' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowDayMenu(false); }}
    >
      {/* Compact view */}
      <div className="p-3">
        <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-2 ${archetypeConf.bg} ${archetypeConf.color}`}>
          {archetypeConf.icon}
          {archetypeConf.label}
        </div>
        <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">
          {post ? `${FORMAT_EMOJI[post.format] || '📝'} ${post.topic}` : `🎯 ${eng!.targetRole}`}
        </p>
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400">
          <Clock className="w-2.5 h-2.5" />
          {item.time}
        </div>
      </div>

      {/* Hover-expanded detail + actions */}
      <div className={`overflow-hidden transition-all duration-300 ${hovered ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-3 pb-1 max-h-40 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full pr-1">
          <p className="text-[11px] text-gray-500 italic border-t border-gray-100 pt-2 leading-relaxed">
            {post ? post.angle : eng!.goal}
          </p>
          {post?.whyThisTime && (
            <p className="text-[10px] text-indigo-700 mt-2 bg-indigo-50 px-2 py-1.5 rounded text-left leading-relaxed">
              ⏰ {post.whyThisTime}
            </p>
          )}
        </div>

        <div className="px-3 pb-3 flex items-center gap-1.5 mt-2 flex-wrap border-t border-gray-50 pt-2">
          {onDraft && (
            <button
              onClick={(e) => { e.stopPropagation(); onDraft(); }}
              className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <FileText className="w-3 h-3" /> Draft
            </button>
          )}
          {onSwap && (
            <button
              onClick={(e) => { e.stopPropagation(); onSwap(); }}
              disabled={isSwapping}
              className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {isSwapping ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Swap
            </button>
          )}
          {onMoveTo && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowDayMenu(!showDayMenu); }}
                className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Calendar className="w-3 h-3" />
                Move
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
              {showDayMenu && (
                <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 min-w-[130px]">
                  {['Parking Lot', ...allDays.filter(d => d !== item.day)].map(d => (
                    <button
                      key={d}
                      onClick={(e) => { e.stopPropagation(); onMoveTo(d); setShowDayMenu(false); }}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                    >
                      {d === 'Parking Lot' ? '🅿️ Parking Lot' : d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Day Column ───────────────────────────────────────────────────────────────

function DayColumn({
  day, posts, engagement, onDraft, onSwap, onMoveTo, swappingId, isToday,
}: {
  day: string;
  posts: PostItem[];
  engagement: EngagementItem[];
  onDraft: (p: PostItem) => void;
  onSwap: (p: PostItem, idx: number) => void;
  onMoveTo: (item: PostItem | EngagementItem, type: 'post' | 'engagement', targetDay: string) => void;
  swappingId: string | null;
  isToday: boolean;
}) {
  const isEmpty = posts.length === 0 && engagement.length === 0;
  return (
    <div className={`flex flex-col flex-1 min-w-[170px] max-w-[210px] rounded-2xl p-3 ${isToday ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'bg-gray-50'}`}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className={`text-xs font-bold uppercase tracking-wide ${isToday ? 'text-indigo-700' : 'text-gray-500'}`}>{day}</h3>
        {isToday && <span className="text-[9px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">TODAY</span>}
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {posts.map((p, i) => (
          <KanbanCard
            key={`post-${day}-${i}`}
            item={p}
            type="post"
            onDraft={() => onDraft(p)}
            onSwap={() => onSwap(p, i)}
            onMoveTo={(target) => onMoveTo(p, 'post', target)}
            isSwapping={swappingId === `${day}-post-${i}`}
            allDays={DAYS}
          />
        ))}
        {engagement.map((e, i) => (
          <KanbanCard
            key={`eng-${day}-${i}`}
            item={e}
            type="engagement"
            onMoveTo={(target) => onMoveTo(e, 'engagement', target)}
            allDays={DAYS}
          />
        ))}
        {isEmpty && (
          <div className="flex-1 flex items-center justify-center min-h-[70px] rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-[10px] text-gray-300">Free day</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 360 Brew Health Bar ──────────────────────────────────────────────────────

function BrewHealthBar({ posts }: { posts: PostItem[] }) {
  const has = (a: string) => posts.some(p => p.archetype === a);
  const items = [
    { key: 'AUTHORITY_BUILDER', label: 'Authority Builder', done: has('AUTHORITY_BUILDER') },
    { key: 'NETWORK_ACTIVATOR', label: 'Network Activator', done: has('NETWORK_ACTIVATOR') },
    { key: 'EXPERIENCE_SHARE', label: 'Experience Share', done: has('EXPERIENCE_SHARE') },
  ];
  const score = items.filter(i => i.done).length;
  return (
    <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3 flex-wrap">
      <div className="flex items-center gap-2 shrink-0">
        <Zap className={`w-4 h-4 ${score === 3 ? 'text-amber-500' : 'text-gray-300'}`} />
        <span className="text-xs font-bold text-gray-700">360 Brew Diet</span>
      </div>
      <div className="flex items-center gap-4 flex-1 flex-wrap">
        {items.map(item => (
          <div key={item.key} className={`flex items-center gap-1.5 text-[11px] font-medium ${item.done ? 'text-green-700' : 'text-gray-400'}`}>
            <span>{item.done ? '✅' : '⬜'}</span>
            {item.label}
          </div>
        ))}
      </div>
      {score < 3 && (
        <p className="text-[10px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg shrink-0">
          ⚠️ Incomplete — lower algorithmic reach
        </p>
      )}
      {score === 3 && (
        <p className="text-[10px] text-green-700 bg-green-50 px-2.5 py-1 rounded-lg shrink-0">
          🚀 Full diet — max algorithmic reach!
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StrategyPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'weekly' | 'monthly'>('weekly');
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [swappingId, setSwappingId] = useState<string | null>(null);

  // Kanban state
  const [boardPosts, setBoardPosts] = useState<Record<string, PostItem[]>>({});
  const [boardEngagement, setBoardEngagement] = useState<Record<string, EngagementItem[]>>({});
  const [parkingPosts, setParkingPosts] = useState<PostItem[]>([]);
  const [parkingEngagement, setParkingEngagement] = useState<EngagementItem[]>([]);

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  // Fetch plan on mount
  useEffect(() => {
    const fetchPlan = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/strategy', { cache: 'no-store' });
        const data = await res.json();
        if (data.success && data.plan) {
          const parsed = JSON.parse(data.plan.planData);
          setPlan({ ...parsed, mode: parsed.mode || 'weekly' });
          if (parsed.mode) setMode(parsed.mode);
        }
      } catch (err) {
        console.error('Failed to load plan', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlan();
  }, []);

  // Populate board when plan changes
  useEffect(() => {
    if (!plan) return;
    const posts = plan.mode === 'weekly' ? plan.posts : (plan.weeks?.[0]?.posts || []);
    const engagement = plan.mode === 'weekly' ? plan.engagement : (plan.weeks?.[0]?.engagement || []);
    const postsMap: Record<string, PostItem[]> = {};
    const engMap: Record<string, EngagementItem[]> = {};
    const parkPosts: PostItem[] = [];
    const parkEng: EngagementItem[] = [];

    DAYS.forEach(d => { postsMap[d] = []; engMap[d] = []; });

    posts.forEach(p => {
      if (p.day === 'Parking Lot') {
        parkPosts.push(p);
      } else {
        const d = DAYS.includes(p.day) ? p.day : 'Monday';
        postsMap[d].push(p);
      }
    });

    engagement.forEach(e => {
      if (e.day === 'Parking Lot') {
        parkEng.push(e);
      } else {
        const d = DAYS.includes(e.day) ? e.day : 'Tuesday';
        engMap[d].push(e);
      }
    });

    setBoardPosts(postsMap);
    setBoardEngagement(engMap);
    setParkingPosts(parkPosts);
    setParkingEngagement(parkEng);
  }, [plan]);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const modelConfig = getModelConfig();
      const userProfile = getUserProfile();
      const res = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelConfig, userProfile, mode, feedback: feedback.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Generation failed');
      setPlan({ ...data.data, mode: data.mode || mode });
      setFeedback('');
      setShowFeedback(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [mode, feedback]);

  const handleDraft = (post: PostItem) => {
    const params = new URLSearchParams({ topic: post.topic, format: post.format, angle: post.angle || '' });
    router.push(`/dashboard/content?${params.toString()}`);
  };

  const handleSwap = async (post: PostItem, day: string, idx: number) => {
    const key = `${day}-post-${idx}`;
    setSwappingId(key);
    try {
      const modelConfig = getModelConfig();
      const userProfile = getUserProfile();
      const res = await fetch('/api/strategy/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelConfig,
          userProfile,
          rejectedTopic: post.topic,
          archetype: post.archetype || 'AUTHORITY_BUILDER',
          day,
          format: post.format,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setBoardPosts(prev => {
        const updated = { ...prev };
        updated[day] = updated[day].map((p, i) => i === idx ? data.idea : p);
        return updated;
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSwappingId(null);
    }
  };

  const handleMoveTo = (item: PostItem | EngagementItem, type: 'post' | 'engagement', fromDay: string, targetDay: string) => {
    if (!plan) return;

    const newPlan = { ...plan };
    const itemsList = type === 'post' 
      ? (newPlan.mode === 'weekly' ? newPlan.posts : newPlan.weeks?.[0]?.posts) 
      : (newPlan.mode === 'weekly' ? newPlan.engagement : newPlan.weeks?.[0]?.engagement);

    if (!itemsList) return;

    // Find the exact item. If it's a post, match by topic. If engagement, match by goal.
    const idx = itemsList.findIndex((x: any) => 
      x.day === fromDay &&
      (type === 'post' ? x.topic === (item as PostItem).topic : x.goal === (item as EngagementItem).goal)
    );
    
    if (idx > -1) {
      itemsList[idx] = { ...itemsList[idx], day: targetDay };
      setPlan(newPlan);
      
      // Save the updated state to the backend silently
      fetch('/api/strategy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planData: newPlan }),
      }).catch(err => console.error("Failed to sync board state", err));
    }
  };

  const allBoardPosts = Object.values(boardPosts).flat();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Content Strategy</h1>
            <p className="text-sm text-gray-500 mt-0.5">360 Brew-optimised weekly plan · tailored to your profile & target role</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              {(['weekly', 'monthly'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${mode === m ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {m === 'weekly' ? 'This Week' : '4 Weeks'}
                </button>
              ))}
            </div>
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {plan ? 'Regenerate' : 'Generate Strategy'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
        )}

        {/* Empty State */}
        {!plan && !isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6">
              <Calendar className="w-10 h-10 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No strategy yet</h2>
            <p className="text-gray-500 text-sm max-w-md mb-8">
              Click &quot;Generate Strategy&quot; and the AI builds a 360 Brew-optimised Kanban board based on your profile, target role, and areas of expertise.
            </p>
            <div className="flex items-center gap-6 mb-8 text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              {[
                { icon: <TrendingUp className="w-4 h-4 text-amber-500" />, label: 'Authority Builder', desc: 'Deep expert post to boost reach' },
                { icon: <Users className="w-4 h-4 text-purple-500" />, label: 'Network Activator', desc: 'Contrarian take to drive comments' },
                { icon: <BookOpen className="w-4 h-4 text-green-500" />, label: 'Experience Share', desc: 'Personal story recruiters love' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2">
                  <div className="mt-0.5">{item.icon}</div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">{item.label}</p>
                    <p className="text-[11px] text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Sparkles className="w-5 h-5" />
              Generate My 360 Brew Strategy
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Building your 360 Brew strategy...</p>
            <p className="text-sm text-gray-400 mt-1">Analysing your target role, interests & IST golden hours</p>
          </div>
        )}

        {/* Plan Board */}
        {plan && !isLoading && (
          <>
            {/* Focus topic */}
            <div className="mb-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide mb-1">
                {plan.mode === 'weekly' ? "This Week's Focus" : '4-Week Theme'}
              </p>
              <p className="text-base font-semibold text-gray-900">
                {plan.mode === 'weekly' ? plan.focusTopic : plan.overallTheme}
              </p>
            </div>

            {/* 360 Brew Health */}
            <div className="mb-4">
              <BrewHealthBar posts={allBoardPosts} />
            </div>

            {/* Golden Hours + Recruiter Strategy */}
            {(plan.goldenHoursInsight || plan.recruiterStrategy) && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {plan.goldenHoursInsight && (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                    <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-1.5">⏰ Golden Hours (IST)</p>
                    <p className="text-xs text-amber-800 leading-relaxed">{plan.goldenHoursInsight}</p>
                  </div>
                )}
                {plan.recruiterStrategy && (
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                    <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide mb-1.5">🎯 Recruiter Strategy</p>
                    <p className="text-xs text-indigo-800 leading-relaxed">{plan.recruiterStrategy}</p>
                  </div>
                )}
              </div>
            )}

            {/* Hint */}
            <p className="text-[11px] text-gray-400 mb-3">
              💡 <strong>Hover</strong> over any card to see the full angle, then use <strong>Draft</strong>, <strong>Swap</strong>, or <strong>Move</strong> buttons.
            </p>

            {/* Kanban Board */}
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-3" style={{ minWidth: '1000px' }}>
                {DAYS.map(day => (
                  <DayColumn
                    key={day}
                    day={day}
                    posts={boardPosts[day] || []}
                    engagement={boardEngagement[day] || []}
                    onDraft={handleDraft}
                    onSwap={(p, idx) => handleSwap(p, day, idx)}
                    onMoveTo={(item, type, target) => handleMoveTo(item, type, day, target)}
                    swappingId={swappingId}
                    isToday={day === todayName}
                  />
                ))}

                {/* Parking Lot */}
                <div className="flex flex-col flex-1 min-w-[170px] max-w-[210px] rounded-2xl p-3 bg-gray-100 border-2 border-dashed border-gray-300">
                  <div className="flex items-center gap-2 mb-3">
                    <ParkingCircle className="w-3.5 h-3.5 text-gray-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Parking Lot</h3>
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    {parkingPosts.map((p, i) => (
                      <KanbanCard
                        key={`park-post-${i}`}
                        item={p}
                        type="post"
                        onDraft={() => handleDraft(p)}
                        onMoveTo={(target) => {
                          setParkingPosts(prev => prev.filter((_, j) => j !== i));
                          if (target !== 'Parking Lot') {
                            setBoardPosts(prev => ({ ...prev, [target]: [...(prev[target] || []), { ...p, day: target }] }));
                          }
                        }}
                        allDays={DAYS}
                      />
                    ))}
                    {parkingEngagement.map((e, i) => (
                      <KanbanCard
                        key={`park-eng-${i}`}
                        item={e}
                        type="engagement"
                        onMoveTo={(target) => {
                          setParkingEngagement(prev => prev.filter((_, j) => j !== i));
                          if (target !== 'Parking Lot') {
                            setBoardEngagement(prev => ({ ...prev, [target]: [...(prev[target] || []), { ...e, day: target }] }));
                          }
                        }}
                        allDays={DAYS}
                      />
                    ))}
                    {parkingPosts.length === 0 && parkingEngagement.length === 0 && (
                      <div className="flex-1 flex items-center justify-center min-h-[70px]">
                        <p className="text-[10px] text-gray-300 text-center">Move busy-day<br />cards here</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Feedback & Regenerate */}
            <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <button
                onClick={() => setShowFeedback(!showFeedback)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate with feedback
                <ChevronDown className={`w-4 h-4 transition-transform ${showFeedback ? 'rotate-180' : ''}`} />
              </button>
              {showFeedback && (
                <div className="mt-4 space-y-3">
                  <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder="e.g. Make the Authority Builder about AI in fintech regulation. Keep the Network Activator. Move engagement sprint to Thursday."
                    rows={3}
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={isLoading || !feedback.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Apply Feedback & Regenerate
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
