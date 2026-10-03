'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar, Loader2, Sparkles, FileText, MessageSquare,
  Clock, Target, TrendingUp, ChevronRight, Zap, CalendarDays
} from 'lucide-react';

//  "  "  Types  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 

interface PostItem {
  day: string;
  time: string;
  format: string;
  topic: string;
  angle: string;
  whyThisTime?: string;
}

interface EngagementItem {
  day: string;
  time: string;
  targetRole: string;
  goal: string;
}

interface WeekData {
  weekNumber: number;
  weekTheme: string;
  posts: PostItem[];
  engagement: EngagementItem[];
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
  weeks: WeekData[];
}

type Plan = WeeklyPlan | MonthlyPlan;

//  "  "  Helpers  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 

const FORMAT_COLORS: Record<string, string> = {
  text: 'bg-blue-100 text-blue-700',
  listicle: 'bg-purple-100 text-purple-700',
  story: 'bg-amber-100 text-amber-700',
  carousel: 'bg-green-100 text-green-700',
  poll: 'bg-rose-100 text-rose-700',
};

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function PostCard({ post, onGenerate }: { post: PostItem; onGenerate: (post: PostItem) => void }) {
  return (
    <div className="bg-white rounded-xl border border-blue-100 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FORMAT_COLORS[post.format] || 'bg-gray-100 text-gray-700'}`}>
          {post.format}
        </span>
        <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
          <Clock className="w-3 h-3" />
          {post.time}
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-800 mb-1">{post.topic}</p>
      <p className="text-xs text-gray-500 italic mb-3">{post.angle}</p>
      {post.whyThisTime && (
        <p className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg mb-3">
              {post.whyThisTime}
        </p>
      )}
      <button
        onClick={() => onGenerate(post)}
        className="w-full text-xs font-semibold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1"
      >
        <FileText className="w-3.5 h-3.5" />
        Write this post
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function EngagementCard({ eng }: { eng: EngagementItem }) {
  return (
    <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
            '  Comment
        </span>
        <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3" />
          {eng.time}
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-800 mb-1">Target: {eng.targetRole}</p>
      <p className="text-xs text-gray-500">{eng.goal}</p>
    </div>
  );
}

function WeekColumn({ day, posts, engagement, onGenerate }: {
  day: string;
  posts: PostItem[];
  engagement: EngagementItem[];
  onGenerate: (p: PostItem) => void;
}) {
  const items = posts.filter(p => p.day === day);
  const engItems = engagement.filter(e => e.day === day);
  const isEmpty = !items.length && !engItems.length;

  return (
    <div className="w-[220px] shrink-0">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
        {day}
      </div>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-24 rounded-xl border border-dashed border-gray-200 text-gray-300 text-xs">
          Rest day
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p, i) => <PostCard key={i} post={p} onGenerate={onGenerate} />)}
          {engItems.map((e, i) => <EngagementCard key={i} eng={e} />)}
        </div>
      )}
    </div>
  );
}

//  "  "  Main Page  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 

export default function StrategyPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'weekly' | 'monthly'>('weekly');
  const [activeWeek, setActiveWeek] = useState(0);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    fetch('/api/strategy')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.plan?.planData) {
          const raw = JSON.parse(data.plan.planData);
          if (raw) setPlan({ ...raw, mode: raw.mode || 'weekly' });
        }
      })
      .catch(err => console.error('Error fetching plan', err))
      .finally(() => setIsLoading(false));
  }, []);

  const getLLMConfig = () => {
    const provider = localStorage.getItem('sa_provider') || 'openai';
    return {
      provider,
      modelId: localStorage.getItem('sa_model') || 'gpt-4o-mini',
      apiKey: localStorage.getItem(`sa_apiKey_${provider}`) || '',
      ollamaBaseUrl: localStorage.getItem('sa_baseUrl') || '',
      bedrockRegion: localStorage.getItem('sa_region') || ''
    };
  };

  const generateStrategy = async (currentFeedback?: string) => {
    setIsGenerating(true);
    setError('');

    try {
      const profileRes = await fetch('/api/profile');
      const profileData = profileRes.ok ? await profileRes.json() : {};
      const userProfile = profileData.user || {};

      const payload: any = {
        modelConfig: getLLMConfig(),
        userProfile,
        mode,
      };

      if (currentFeedback) {
        payload.feedback = currentFeedback;
        if (plan) payload.previousPlan = JSON.stringify(plan);
      }

      const res = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Generation failed');

      setPlan({ ...data.data, mode });
      setActiveWeek(0);
      if (currentFeedback) setFeedback('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePost = (post: PostItem) => {
    const params = new URLSearchParams({ topic: post.topic, format: post.format, angle: post.angle });
    router.push(`/dashboard/content?${params.toString()}`);
  };

  //  "  "  Render  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 

  const isWeekly = (p: Plan): p is WeeklyPlan => p.mode === 'weekly';
  const isMonthly = (p: Plan): p is MonthlyPlan => p.mode === 'monthly';

  const currentWeekData = plan && isMonthly(plan) ? plan.weeks[activeWeek] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            Content Strategy
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            AI-crafted plan with Golden Hours to get noticed by talent recruiters.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setMode('weekly')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'weekly' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setMode('monthly')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'monthly' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Monthly
            </button>
          </div>

          <button
            onClick={() => generateStrategy()}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-60 shadow-sm"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating   </>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate {mode === 'monthly' ? 'Monthly' : 'Weekly'} Plan</>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              {error}
        </div>
      )}

      {/* Generating state */}
      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="font-medium">AI is crafting your recruiter-visibility strategy   </p>
          <p className="text-sm text-gray-400">Calculating Golden Hours    Building your narrative arc    Targeting the right audiences</p>
        </div>
      )}

      {/* Empty state */}
      {!isGenerating && !isLoading && !plan && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-4">
          <CalendarDays className="w-16 h-16 text-gray-200" />
          <p className="text-lg font-semibold text-gray-600">No strategy yet</p>
          <p className="text-sm text-center max-w-sm">
            Generate a <strong>Weekly</strong> plan for your next 5 days, or a <strong>Monthly</strong> plan to build recruiter awareness over 4 weeks.
          </p>
          <button
            onClick={() => generateStrategy()}
            className="mt-2 flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate your first strategy
          </button>
        </div>
      )}

      {/* Plan display */}
      {!isGenerating && plan && (
        <>
          {/* Golden Hours + Recruiter Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-800 mb-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Golden Hours for You
              </div>
              <p className="text-sm text-amber-700 leading-relaxed">
                {plan.goldenHoursInsight || 'Regenerate the plan to get your personalised Golden Hours advice.'}
              </p>
                            <div className="mt-3 pt-3 border-t border-amber-200 grid grid-cols-2 gap-2 text-xs text-amber-700">
                <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Posts: Tue-Thu 8-9:30 AM IST</div>
                <div className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Comments: 12:30-1:30 PM IST</div>
                <div className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Evening: 6:30-8 PM IST</div>
                <div className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Avoid: Fri 3 PM+, weekends</div>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-800 mb-2">
                <Target className="w-4 h-4 text-indigo-500" />
                Why This Gets Recruiters to Find You
              </div>
              <p className="text-sm text-indigo-700 leading-relaxed">
                {plan.recruiterStrategy || 'Regenerate the plan to see exactly how these topics map to Indian recruiter searches.'}
              </p>
            </div>
          </div>

          {/* Weekly plan */}
          {isWeekly(plan) && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-sm font-semibold text-gray-500 bg-white px-3">
                  Focus: {plan.focusTopic}
                </span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>

              <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
                <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#c7d2fe transparent' }}>
                  {DAY_ORDER.map(day => (
                    <WeekColumn
                      key={day}
                      day={day}
                      posts={plan.posts}
                      engagement={plan.engagement}
                      onGenerate={handleGeneratePost}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Monthly plan */}
          {isMonthly(plan) && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-sm font-semibold text-gray-500 bg-white px-3">
                  Month Theme: {plan.overallTheme}
                </span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>

              {/* Week tabs */}
              <div className="flex gap-2 overflow-x-auto">
                {plan.weeks.map((w, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveWeek(i)}
                    className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      activeWeek === i
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    Week {w.weekNumber}
                    <span className={`ml-2 text-xs font-normal ${activeWeek === i ? 'text-indigo-200' : 'text-gray-400'}`}>
                      {w.weekTheme}
                    </span>
                  </button>
                ))}
              </div>

              {currentWeekData && (
                <>
                  <div className="text-sm text-gray-600 font-medium px-1">
                    Theme: <span className="text-indigo-700">{currentWeekData.weekTheme}</span>
                  </div>
                  <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
                    <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#c7d2fe transparent' }}>
                      {DAY_ORDER.map(day => (
                        <WeekColumn
                          key={day}
                          day={day}
                          posts={currentWeekData.posts}
                          engagement={currentWeekData.engagement}
                          onGenerate={handleGeneratePost}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Refine Strategy UI */}
          <div className="mt-8 bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              Refine this strategy with AI
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g. Make it more focused on FinTech, or less about coding..."
                className="flex-1 rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5 px-4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && feedback.trim()) {
                    generateStrategy(feedback.trim());
                  }
                }}
              />
              <button
                onClick={() => generateStrategy(feedback.trim())}
                disabled={!feedback.trim() || isGenerating}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 transition-colors shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                Refine Plan
              </button>
            </div>
            <p className="text-xs text-indigo-400 mt-2 ml-1">
              The AI will read your feedback and generate a revised {mode} plan.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
