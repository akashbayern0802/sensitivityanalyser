const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/influencers/page.tsx', 'utf8');

let badFn = `  const handleToggleSave = async (inf: Influencer) => {
    const isCurrentlySaved = savedInfluencers.some(s => s.id === inf.id) || (inf as any).isSaved;
    try {
      const res = await fetch('/api/influencers/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inf.id, isSaved: !isCurrentlySaved })
      });
      const data = await res.json();
      if (data.success) {
        if (!isCurrentlySaved) setSavedInfluencers(prev => [data.influencer, ...prev]);
        else setSavedInfluencers(prev => prev.filter(s => s.id !== inf.id));
        setInfluencers(prev => prev.map(p => p.id === inf.id ? { ...p, isSaved: !isCurrentlySaved } : p));
      }
    } catch(e) {}
  };`;

let goodFn = `  const handleToggleSave = async (inf: Influencer) => {
    const isCurrentlySaved = savedInfluencers.some(s => s.id === inf.id) || (inf as any).isSaved;
    
    if (!inf.id) {
      alert("Error: Influencer ID is missing. Please refresh the page and try again.");
      return;
    }
    
    // Optimistic UI Update
    if (!isCurrentlySaved) setSavedInfluencers(prev => [inf, ...prev]);
    else setSavedInfluencers(prev => prev.filter(s => s.id !== inf.id));
    setInfluencers(prev => prev.map(p => p.id === inf.id ? { ...p, isSaved: !isCurrentlySaved } : p));
    
    try {
      const res = await fetch('/api/influencers/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inf.id, isSaved: !isCurrentlySaved })
      });
      const data = await res.json();
      if (!data.success) {
        alert("Failed to save: " + (data.error || "Unknown error"));
        // Revert (lazy reload for simplicity if error occurs)
        fetchSaved();
      }
    } catch(e: any) {
      alert("Network error: " + e.message);
      fetchSaved();
    }
  };`;

code = code.replace(badFn, goodFn);
fs.writeFileSync('src/app/dashboard/influencers/page.tsx', code);
