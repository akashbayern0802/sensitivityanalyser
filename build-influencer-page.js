const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/influencers/page.tsx', 'utf8');

// Replace the start of the component state
let stateReplacement = `
export default function InfluencersPage() {
  const [activeTab, setActiveTab] = useState<'discover' | 'saved'>('discover');
  
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [savedInfluencers, setSavedInfluencers] = useState<Influencer[]>([]);
  
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNiche, setActiveNiche] = useState<string | null>(null);
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null);
  const [error, setError] = useState('');
  const [country, setCountry] = useState('');
  const [lastQuery, setLastQuery] = useState('');

  // 1. Recover state on mount
  useEffect(() => {
    const cached = sessionStorage.getItem('sa_influencers_state');
    if (cached) {
      try {
        const { infs, query, ctry, lastQ, activeN } = JSON.parse(cached);
        if (infs) setInfluencers(infs);
        if (query) setSearchQuery(query);
        if (ctry) setCountry(ctry);
        if (lastQ) setLastQuery(lastQ);
        if (activeN) setActiveNiche(activeN);
      } catch(e) {}
    }
  }, []);

  // 2. Persist state changes
  useEffect(() => {
    sessionStorage.setItem('sa_influencers_state', JSON.stringify({
      infs: influencers,
      query: searchQuery,
      ctry: country,
      lastQ: lastQuery,
      activeN: activeNiche
    }));
  }, [influencers, searchQuery, country, lastQuery, activeNiche]);

  // Fetch saved on mount
  const fetchSaved = async () => {
    setIsLoadingSaved(true);
    try {
      const res = await fetch('/api/influencers/saved');
      const data = await res.json();
      if (data.success) {
        setSavedInfluencers(data.influencers);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  useEffect(() => {
    fetchSaved();
  }, []);

  const handleToggleSave = async (inf: Influencer) => {
    const isCurrentlySaved = savedInfluencers.some(s => s.id === inf.id) || (inf as any).isSaved;
    try {
      const res = await fetch('/api/influencers/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inf.id, isSaved: !isCurrentlySaved })
      });
      const data = await res.json();
      if (data.success) {
        // Optimistically update
        if (!isCurrentlySaved) {
          setSavedInfluencers(prev => [data.influencer, ...prev]);
        } else {
          setSavedInfluencers(prev => prev.filter(s => s.id !== inf.id));
        }
        
        // Update in discovery list too
        setInfluencers(prev => prev.map(p => p.id === inf.id ? { ...p, isSaved: !isCurrentlySaved } : p));
      }
    } catch(e) { console.error(e); }
  };
`;
code = code.replace(/export default function InfluencersPage\(\) \{[\s\S]*?const runDiscovery = async/, stateReplacement + '\n  const runDiscovery = async');

// Add tabs UI above the Content Studio Header (or inside it)
let tabsUI = `
      {/* Header and Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Influencer Radar
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Discover top industry voices and craft engaging comments.
          </p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab('discover')}
            className={\`px-4 py-2 rounded-lg text-sm font-semibold transition-all \${activeTab === 'discover' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}\`}
          >
            Discover
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={\`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 \${activeTab === 'saved' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}\`}
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

      {activeTab === 'discover' ? (
        <>
`;
code = code.replace(/<div className="mb-6">\s*<h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">[\s\S]*?<\/p>\s*<\/div>/, tabsUI);

// Now wrap the rest of the return body up to the CommentDrawer with `</>` and ` : <> SAVED VIEW </>`
let endMarker = `      {/* Comment Drawer */}`;
let savedView = `
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {savedInfluencers.length} Saved Voices
            </h2>
          </div>
          
          {isLoadingSaved ? (
            <div className="animate-pulse flex gap-4">
               <div className="h-24 bg-gray-200 rounded-xl w-full" />
            </div>
          ) : savedInfluencers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
              <Check className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-base font-medium text-gray-500">No qualified influencers yet</p>
              <p className="text-sm mt-1 max-w-sm text-center">Discover new industry voices and save them to build your core engagement list.</p>
              <button onClick={() => setActiveTab('discover')} className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-700 font-medium rounded-lg hover:bg-indigo-100 transition-colors text-sm">
                Go to Discovery
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedInfluencers.map((inf, idx) => (
                <div
                  key={inf.id || idx}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex gap-3 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                          {inf.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">
                            {inf.name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                            {inf.headline}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleToggleSave(inf)}
                        className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-full transition-colors shrink-0"
                        title="Remove from Qualified"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-gray-50 mt-4">
                      <button
                        onClick={() => setSelectedInfluencer(inf)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Comment Studio
                      </button>

                      <a
                        href={inf.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Open LinkedIn Profile"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comment Drawer */}`;

code = code.replace(endMarker, savedView);

// Add the Save button to the Discover cards
// Need to find this exact block:
let actionButtonsRegex = /<button\s+onClick=\{\(\) => setSelectedInfluencer\(inf\)\}/;
let saveButtonCode = `
                    <button
                      onClick={() => handleToggleSave(inf)}
                      className={\`p-2 rounded-lg transition-colors shrink-0 \${savedInfluencers.some(s => s.id === inf.id) || (inf as any).isSaved ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}\`}
                      title="Toggle Qualified Status"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => setSelectedInfluencer(inf)}`;
code = code.replace(new RegExp(actionButtonsRegex, 'g'), saveButtonCode);

// Inject useEffect into the imports if not present
if (!code.includes('useEffect')) {
  code = code.replace("import { useState } from 'react';", "import { useState, useEffect } from 'react';");
}

fs.writeFileSync('src/app/dashboard/influencers/page.tsx', code);
