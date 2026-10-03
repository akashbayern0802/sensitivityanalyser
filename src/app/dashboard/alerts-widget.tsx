'use client';

import { useEffect, useState } from 'react';
import { Bell, Building2, ExternalLink, Users, ChevronRight, Loader2, Newspaper } from 'lucide-react';
import Link from 'next/link';

interface Alert {
  company: string;
  targetCount: number;
  coldCount: number;
  latestEvent: {
    id: string;
    title: string;
    url: string;
    summary: string;
    publishedAt: string | null;
  };
  events: Array<{ id: string; title: string; url: string; summary: string; publishedAt: string | null }>;
  targets: Array<{ id: string; name: string; status: string; linkedinUrl: string }>;
}

export function AlertsWidget() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(data => {
        if (data.success) setAlerts(data.alerts);
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-orange-500" />
          <h2 className="font-semibold text-gray-900">Morning Brief</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading alerts...
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-5 h-5 text-orange-500" />
          <h2 className="font-semibold text-gray-900">Morning Brief</h2>
        </div>
        <div className="flex flex-col items-center py-6 text-center">
          <Newspaper className="w-10 h-10 text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">No company news alerts yet.</p>
          <span className="text-xs text-gray-400 mt-1 block">
            Go to{' '}
            <Link href="/dashboard/radar" className="text-orange-500 hover:underline">Radar → Company Intel</Link>{' '}
            and click Scan Now.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-orange-500" />
          <h2 className="font-semibold text-gray-900">Morning Brief</h2>
          <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
            {alerts.length} alert{alerts.length > 1 ? 's' : ''}
          </span>
        </div>
        <Link
          href="/dashboard/radar"
          className="text-xs text-orange-600 hover:underline flex items-center gap-1"
        >
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="divide-y divide-gray-50">
        {alerts.slice(0, 4).map(alert => (
          <div key={alert.company} className="p-5 hover:bg-orange-50/30 transition-colors">
            {/* Company + targets row */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="font-semibold text-gray-900 text-sm truncate">{alert.company}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                <Users className="w-3.5 h-3.5" />
                <span>{alert.targetCount} target{alert.targetCount > 1 ? 's' : ''}</span>
                {alert.coldCount > 0 && (
                  <span className="ml-1 text-blue-600 font-medium">{alert.coldCount} cold</span>
                )}
              </div>
            </div>

            {/* Latest news headline */}
            <a
              href={alert.latestEvent.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-gray-700 hover:text-orange-700 transition-colors leading-snug mb-2 font-medium"
            >
              {alert.latestEvent.title}
            </a>

            {alert.latestEvent.summary && (
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">
                {alert.latestEvent.summary}
              </p>
            )}

            {/* CRM targets for this company */}
            <div className="flex items-center gap-2 flex-wrap">
              {alert.targets.slice(0, 3).map(target => (
                <a
                  key={target.id}
                  href={target.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors hover:border-indigo-400 ${
                    target.status === 'engaged' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                    target.status === 'connected' ? 'bg-green-50 border-green-200 text-green-700' :
                    target.status === 'cold' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                    'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-current opacity-20 flex items-center justify-center text-[10px] font-bold">{target.name.charAt(0)}</span>
                  {target.name.split(' ')[0]}
                  <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                </a>
              ))}
              {alert.targets.length > 3 && (
                <span className="text-xs text-gray-400">+{alert.targets.length - 3} more</span>
              )}
              <Link
                href="/dashboard/influencers"
                className="ml-auto text-xs text-indigo-600 hover:underline flex items-center gap-1"
              >
                Engage <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
