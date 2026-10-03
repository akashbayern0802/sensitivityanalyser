'use client';

import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, BarChart3, Plus, Activity, AlertCircle } from 'lucide-react';

interface Snapshot {
  id: string;
  weekStart: string;
  impressions: number | null;
  profileViews: number | null;
  searchAppearances: number | null;
  followerCount: number | null;
  ssiScore: number | null;
}

export default function AnalyticsPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    weekStart: new Date().toISOString().split('T')[0],
    impressions: '',
    profileViews: '',
    searchAppearances: '',
    followerCount: '',
    ssiScore: ''
  });

  const fetchSnapshots = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/analytics');
      if (!res.ok) throw new Error('Failed to fetch analytics data');
      const data = await res.json();
      setSnapshots(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      
      const payload = {
        weekStart: formData.weekStart,
        impressions: formData.impressions ? parseInt(formData.impressions, 10) : undefined,
        profileViews: formData.profileViews ? parseInt(formData.profileViews, 10) : undefined,
        searchAppearances: formData.searchAppearances ? parseInt(formData.searchAppearances, 10) : undefined,
        followerCount: formData.followerCount ? parseInt(formData.followerCount, 10) : undefined,
        ssiScore: formData.ssiScore ? parseFloat(formData.ssiScore) : undefined,
      };

      const res = await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to save analytics data');
      }

      await fetchSnapshots();
      setShowForm(false);
      setFormData({
        weekStart: new Date().toISOString().split('T')[0],
        impressions: '',
        profileViews: '',
        searchAppearances: '',
        followerCount: '',
        ssiScore: ''
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    }
  };

  const sortedSnapshots = [...snapshots].sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime());

  const latestSnapshot = sortedSnapshots.length > 0 ? sortedSnapshots[sortedSnapshots.length - 1] : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Analytics & Visibility Tracker
          </h1>
          <p className="text-gray-500 mt-1">Track your LinkedIn growth and optimize your strategy.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? <Activity className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {showForm ? 'Cancel Logging' : 'Log Weekly Stats'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Log New Snapshot</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Week Start</label>
              <input
                type="date"
                name="weekStart"
                required
                value={formData.weekStart}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Impressions</label>
              <input
                type="number"
                name="impressions"
                value={formData.impressions}
                onChange={handleInputChange}
                placeholder="e.g. 5000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile Views</label>
              <input
                type="number"
                name="profileViews"
                value={formData.profileViews}
                onChange={handleInputChange}
                placeholder="e.g. 150"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Appearances</label>
              <input
                type="number"
                name="searchAppearances"
                value={formData.searchAppearances}
                onChange={handleInputChange}
                placeholder="e.g. 45"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Follower Count</label>
              <input
                type="number"
                name="followerCount"
                value={formData.followerCount}
                onChange={handleInputChange}
                placeholder="e.g. 1200"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SSI Score</label>
              <input
                type="number"
                step="0.1"
                name="ssiScore"
                value={formData.ssiScore}
                onChange={handleInputChange}
                placeholder="e.g. 75.5"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex justify-end">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Save Stats
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : sortedSnapshots.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">No data yet</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Log your first week's stats to see your growth over time. Track impressions, profile views, and more.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="text-blue-600 font-medium hover:text-blue-700"
          >
            Log your first snapshot &rarr;
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Latest SSI Score" 
              value={latestSnapshot?.ssiScore} 
              icon={<TrendingUp className="text-purple-600 w-6 h-6" />}
              bgColor="bg-purple-100"
            />
            <StatCard 
              title="Followers" 
              value={latestSnapshot?.followerCount} 
              icon={<Activity className="text-blue-600 w-6 h-6" />}
              bgColor="bg-blue-100"
            />
            <StatCard 
              title="Profile Views" 
              value={latestSnapshot?.profileViews} 
              icon={<BarChart3 className="text-green-600 w-6 h-6" />}
              bgColor="bg-green-100"
            />
            <StatCard 
              title="Search App" 
              value={latestSnapshot?.searchAppearances} 
              icon={<BarChart3 className="text-orange-600 w-6 h-6" />}
              bgColor="bg-orange-100"
            />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">Visibility Trends</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sortedSnapshots} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="weekStart" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    stroke="#6B7280"
                    fontSize={12}
                    tickMargin={10}
                  />
                  <YAxis yAxisId="left" stroke="#6B7280" fontSize={12} tickMargin={10} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6B7280" fontSize={12} tickMargin={10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelFormatter={(val) => new Date(val as string).toLocaleDateString()}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="impressions" 
                    name="Impressions"
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="profileViews" 
                    name="Profile Views"
                    stroke="#10B981" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, bgColor }: { title: string, value: number | null | undefined, icon: React.ReactNode, bgColor: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${bgColor}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value !== null && value !== undefined ? value.toLocaleString() : '--'}</p>
      </div>
    </div>
  );
}
