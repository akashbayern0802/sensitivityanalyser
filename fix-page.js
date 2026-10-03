const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/influencers/page.tsx', 'utf8');

let tabsUI = `
      {/* Header and Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Influencer Radar
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Discover thought leaders and craft high-signal comments — powered by Gemini 3.8 Flash with live Google Search.
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

code = code.replace(/\{\/\*\s*Page header\s*\*\/\}[\s\S]*?(?=\{\/\*\s*Niche chips\s*\*\/})/, tabsUI);
fs.writeFileSync('src/app/dashboard/influencers/page.tsx', code);
