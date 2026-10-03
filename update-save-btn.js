const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/influencers/page.tsx', 'utf8');

if (!code.includes('BookmarkPlus')) {
  code = code.replace("import {", "import {\n  BookmarkPlus,\n  BookmarkCheck,");
}

let targetBtnRegex = /<button[\s\S]*?onClick=\{\(\) => handleToggleSave\(inf\)\}[\s\S]*?<\/button>/g;

let newBtn = `
                      <button
                        onClick={() => handleToggleSave(inf)}
                        className={\`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border \${savedInfluencers.some(s => s.id === inf.id) || (inf as any).isSaved ? 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'}\`}
                        title="Toggle Qualified Status"
                      >
                        {savedInfluencers.some(s => s.id === inf.id) || (inf as any).isSaved ? (
                          <>
                            <BookmarkCheck className="w-4 h-4" />
                            Saved
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="w-4 h-4 text-gray-400" />
                            Save
                          </>
                        )}
                      </button>
`;

code = code.replace(targetBtnRegex, newBtn.trim());
fs.writeFileSync('src/app/dashboard/influencers/page.tsx', code);
