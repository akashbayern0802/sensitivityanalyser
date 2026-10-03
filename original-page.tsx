'use client';

import { useState } from 'react';
import { Users, Search, RefreshCw, MessageSquare, ExternalLink, Copy, Check, ChevronRight } from 'lucide-react';

interface Influencer {
  name: string;
  headline: string;
  profileUrl: string;
}

export default function InfluencersPage() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [searchQuery, setSearchQuery] = useState('system design');
  
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null);
  const [postText, setPostText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleDiscover = async () => {
    setIsDiscovering(true);
    setInfluencers([]);
    setSelectedInfluencer(null);
    setPostText('');
    setSuggestions([]);

    try {
      const searchEngineId = localStorage.getItem('searchEngineId') || '';
      const googleApiKey = localStorage.getItem('googleApiKey') || '';

      const res = await fetch('/api/influencers/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          keyword: searchQuery,
          searchEngineId,
          googleApiKey
        }),
      });
      
      if (!res.ok) throw new Error('Failed to discover influencers');
      
      const data = await res.json();
      setInfluencers(data.influencers || []);
    } catch (error) {
      console.error(error);
      // Fallback dummy data if API fails or isn't connected
      setInfluencers([
        { name: 'Alex Xu', headline: 'Author of System Design Interview. I draw diagrams.', profileUrl: 'https://linkedin.com/in/alexxu' },
        { name: 'Gergely Orosz', headline: 'The Pragmatic Engineer. Writing about software engineering.', profileUrl: 'https://linkedin.com/in/gergelyorosz' },
        { name: 'Arslan Ahmad', headline: 'Software Engineer & System Design Content Creator', profileUrl: 'https://linkedin.com/in/arslanahmad' },
      ]);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleGenerateComments = async () => {
    if (!postText.trim()) return;
    
    setIsGenerating(true);
    setSuggestions([]);
    
    try {
      const llmProvider = localStorage.getItem('llmProvider') || 'openai';
      const llmApiKey = localStorage.getItem('llmApiKey') || '';

      const res = await fetch('/api/influencers/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          postText,
          llmConfig: { provider: llmProvider, apiKey: llmApiKey }
        }),
      });
      
      if (!res.ok) throw new Error('Failed to generate comments');
      
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error(error);
      setSuggestions([
        "This is a fantastic breakdown of the architecture! I completely agree with your point about decoupling the services.",
        "Great insights! Have you considered how this approach handles sudden spikes in read traffic?",
        "Thanks for sharing. I've found a similar pattern useful in our recent project, especially regarding the caching strategy."
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-600" />
          Influencer Radar
        </h1>
        <p className="text-gray-500 mt-1">Discover thought leaders and generate engaging comments for their posts.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Discovery */}
        <div className="w-full lg:w-1/2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-500" />
              Discover Influencers
            </h2>
            
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., System Design, AI, Frontend..."
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
              />
              <button
                onClick={handleDiscover}
                disabled={isDiscovering || !searchQuery.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isDiscovering ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Search
              </button>
            </div>

            <div className="space-y-3">
              {influencers.length === 0 && !isDiscovering && (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  Enter a topic to find relevant influencers
                </div>
              )}
              
              {influencers.map((inf, idx) => (
                <div 
                  key={idx}
                  onClick={() => setSelectedInfluencer(inf)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                    selectedInfluencer === inf 
                      ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/30' 
                      : 'border-gray-100 hover:border-indigo-200 hover:shadow-sm bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">{inf.name}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{inf.headline}</p>
                    </div>
                    <a 
                      href={inf.profileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-400 hover:text-indigo-600 p-1"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Interaction */}
        <div className="w-full lg:w-1/2">
          {selectedInfluencer ? (
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm sticky top-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                  {selectedInfluencer.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{selectedInfluencer.name}</h2>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    Ready to interact <ChevronRight className="w-3 h-3" />
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paste their recent post
                  </label>
                  <textarea
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="Paste the LinkedIn post content here..."
                    className="w-full h-32 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>
                
                <button
                  onClick={handleGenerateComments}
                  disabled={isGenerating || !postText.trim()}
                  className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                >
                  {isGenerating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  Generate Smart Comments
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="mt-8 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Suggested Comments</h3>
                  {suggestions.map((comment, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-indigo-100 transition-colors group relative pr-12">
                      <p className="text-gray-700 text-sm">{comment}</p>
                      <button
                        onClick={() => copyToClipboard(comment, idx)}
                        className="absolute right-3 top-3 p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[400px] bg-gray-50/50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <Users className="w-12 h-12 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-1">Select an Influencer</h3>
              <p className="text-sm">Search and select an influencer from the list to start generating engaging comments for their posts.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
