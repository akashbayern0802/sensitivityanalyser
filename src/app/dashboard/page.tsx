import Link from 'next/link';
import {
  TrendingUp,
  FileText,
  MessageSquare,
  Eye,
  ArrowRight,
  CheckCircle2,
  Circle,
  CalendarDays,
  Users,
  Zap,
  BarChart3,
} from 'lucide-react';
import prisma from '@/lib/db';
import { ChecklistClient } from './checklist-client';

const MOCK_USER_ID = 'user_mock_id';

async function getDashboardStats() {
  try {
    // Ensure the mock user exists
    const user = await prisma.user.upsert({
      where: { id: MOCK_USER_ID },
      update: {},
      create: { id: MOCK_USER_ID, name: 'User', email: 'user@example.com' },
    });

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // this Monday

    const [
      latestSnapshot,
      draftsThisWeek,
      totalDrafts,
      commentsTotal,
      influencerCount,
      weeklyPlanCount,
    ] = await Promise.all([
      // Latest analytics snapshot for visibility score & profile views
      prisma.analyticsSnapshot.findFirst({
        where: { userId: MOCK_USER_ID },
        orderBy: { weekStart: 'desc' },
      }),
      // Content drafts created this week
      prisma.contentDraft.count({
        where: { userId: MOCK_USER_ID, createdAt: { gte: weekStart } },
      }),
      // All-time drafts
      prisma.contentDraft.count({ where: { userId: MOCK_USER_ID } }),
      // All-time comment logs
      prisma.commentLog.count({ where: { userId: MOCK_USER_ID } }),
      // Discovered influencers
      prisma.influencer.count(),
      // Weekly plans generated
      prisma.weeklyPlan.count({ where: { userId: MOCK_USER_ID } }),
    ]);

    return {
      userName: user.name || 'User',
      visibilityScore: latestSnapshot?.visibilityScore ?? 0,
      profileViews: latestSnapshot?.profileViews ?? 0,
      draftsThisWeek,
      totalDrafts,
      commentsTotal,
      influencerCount,
      weeklyPlanCount,
      hasProfile: !!(user.targetRole || user.interests !== '[]'),
      hasAnalytics: !!latestSnapshot,
    };
  } catch {
    return {
      userName: 'User',
      visibilityScore: 0,
      profileViews: 0,
      draftsThisWeek: 0,
      totalDrafts: 0,
      commentsTotal: 0,
      influencerCount: 0,
      weeklyPlanCount: 0,
      hasProfile: false,
      hasAnalytics: false,
    };
  }
}

import { AlertsWidget } from './alerts-widget';

export default async function DashboardHome() {
  const stats = await getDashboardStats();

  const statCards = [
    {
      label: 'Visibility Score',
      value: stats.visibilityScore > 0 ? `${Math.round(stats.visibilityScore)}` : '—',
      suffix: stats.visibilityScore > 0 ? '/100' : '',
      sub: stats.hasAnalytics ? 'From latest analytics snapshot' : 'Log stats in Analytics',
      icon: TrendingUp,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      href: '/dashboard/analytics',
    },
    {
      label: 'Posts This Week',
      value: String(stats.draftsThisWeek),
      suffix: '',
      sub: `${stats.totalDrafts} total drafts`,
      icon: FileText,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      href: '/dashboard/content',
    },
    {
      label: 'Comments Logged',
      value: String(stats.commentsTotal),
      suffix: '',
      sub: 'Via Influencer Radar',
      icon: MessageSquare,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      href: '/dashboard/influencers',
    },
    {
      label: 'Profile Views',
      value: stats.profileViews > 0 ? String(stats.profileViews) : '—',
      suffix: '',
      sub: stats.hasAnalytics ? 'Last logged week' : 'Log stats in Analytics',
      icon: Eye,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      href: '/dashboard/analytics',
    },
  ];

  const checklistItems = [
    {
      id: 'llm',
      label: 'Set up your LLM provider',
      sub: 'Configure your preferred AI model in Settings',
      href: '/dashboard/settings',
      linkLabel: 'Setup',
      // checked client-side via localStorage
      serverChecked: false,
    },
    {
      id: 'profile',
      label: 'Add profile information',
      sub: 'Tell the AI about your role and expertise',
      href: '/dashboard/settings',
      linkLabel: 'Add',
      serverChecked: stats.hasProfile,
    },
    {
      id: 'plan',
      label: 'Generate your first weekly plan',
      sub: 'Get an AI-curated content strategy',
      href: '/dashboard/strategy',
      linkLabel: 'Start',
      serverChecked: stats.weeklyPlanCount > 0,
    },
    {
      id: 'post',
      label: 'Create your first post',
      sub: `${stats.totalDrafts} draft${stats.totalDrafts !== 1 ? 's' : ''} created`,
      href: '/dashboard/content',
      linkLabel: 'Create',
      serverChecked: stats.totalDrafts > 0,
    },
  ];

  const completedCount = checklistItems.filter((i) => i.serverChecked).length;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Welcome back, {stats.userName} 👋
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Here&apos;s what&apos;s happening with your LinkedIn visibility.
          </p>
        </div>
        {/* Activity summary badge */}
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full text-sm text-indigo-700 shrink-0">
          <Zap className="w-4 h-4" />
          <span>
            <strong>{stats.influencerCount}</strong> influencers tracked ·{' '}
            <strong>{stats.weeklyPlanCount}</strong> plans generated
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="relative overflow-hidden rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 transition-all hover:shadow-md hover:ring-indigo-200 group"
          >
            <dt>
              <div className={`absolute rounded-md ${card.iconBg} p-3`}>
                <card.icon className={`h-6 w-6 ${card.iconColor}`} aria-hidden="true" />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-gray-500">{card.label}</p>
            </dt>
            <dd className="ml-16 pb-1 sm:pb-2">
              <p className="text-2xl font-semibold text-gray-900">
                {card.value}
                {card.suffix && (
                  <span className="text-sm text-gray-400 font-normal">{card.suffix}</span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-1 group-hover:text-indigo-500 transition-colors">
                {card.sub}
              </p>
            </dd>
          </Link>
        ))}
      </div>

      {/* Morning Brief — Cross-Pollination Alerts */}
      <AlertsWidget />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-5">
            <h3 className="text-base font-semibold leading-6 text-gray-900">Quick Actions</h3>
          </div>
          <div className="px-6 py-5 space-y-3">
            {[
              {
                href: '/dashboard/strategy',
                icon: CalendarDays,
                iconBg: 'bg-indigo-100',
                iconColor: 'text-indigo-700',
                hoverBorder: 'hover:border-indigo-300 hover:bg-indigo-50/50',
                arrowHover: 'group-hover:text-indigo-600',
                label: 'Generate Weekly Plan',
                sub: 'Plan your content for maximum engagement',
              },
              {
                href: '/dashboard/content',
                icon: FileText,
                iconBg: 'bg-blue-100',
                iconColor: 'text-blue-700',
                hoverBorder: 'hover:border-blue-300 hover:bg-blue-50/50',
                arrowHover: 'group-hover:text-blue-600',
                label: 'Create Post',
                sub: 'Draft an AI-assisted LinkedIn post',
              },
              {
                href: '/dashboard/influencers',
                icon: Users,
                iconBg: 'bg-purple-100',
                iconColor: 'text-purple-700',
                hoverBorder: 'hover:border-purple-300 hover:bg-purple-50/50',
                arrowHover: 'group-hover:text-purple-600',
                label: 'Find Influencers',
                sub: 'Discover top voices in your niche',
              },
              {
                href: '/dashboard/analytics',
                icon: BarChart3,
                iconBg: 'bg-green-100',
                iconColor: 'text-green-700',
                hoverBorder: 'hover:border-green-300 hover:bg-green-50/50',
                arrowHover: 'group-hover:text-green-600',
                label: 'Log Weekly Stats',
                sub: 'Track your LinkedIn visibility growth',
              },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={`group flex items-center justify-between p-4 rounded-lg border border-gray-200 ${action.hoverBorder} transition-colors`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 ${action.iconBg} rounded-lg ${action.iconColor}`}>
                    <action.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{action.label}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{action.sub}</p>
                  </div>
                </div>
                <ArrowRight className={`w-5 h-5 text-gray-400 ${action.arrowHover} transition-colors`} />
              </Link>
            ))}
          </div>
        </div>

        {/* Getting Started Checklist — client component reads localStorage for LLM check */}
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold leading-6 text-gray-900">Getting Started</h3>
              <p className="mt-1 text-sm text-gray-500">Complete these steps to unlock full potential</p>
            </div>
            <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
              {completedCount}/4
            </span>
          </div>
          {/* Client wrapper handles the LLM provider check from localStorage */}
          <ChecklistClient items={checklistItems} />
        </div>
      </div>
    </div>
  );
}
