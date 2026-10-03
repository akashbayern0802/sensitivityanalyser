const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/influencers/page.tsx', 'utf8');

// The hooks are currently at the top, causing 'used before declaration'.
// We need to move them down below the last useState.

// 1. Remove the bad block
let badBlock = `
  const [activeTab, setActiveTab] = useState<'discover' | 'saved'>('discover');
  const [savedInfluencers, setSavedInfluencers] = useState<Influencer[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

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

  useEffect(() => {
    sessionStorage.setItem('sa_influencers_state', JSON.stringify({
      infs: influencers, query: searchQuery, ctry: country, lastQ: lastQuery, activeN: activeNiche
    }));
  }, [influencers, searchQuery, country, lastQuery, activeNiche]);

  const fetchSaved = async () => {
    setIsLoadingSaved(true);
    try {
      const res = await fetch('/api/influencers/saved');
      const data = await res.json();
      if (data.success) setSavedInfluencers(data.influencers);
    } catch (e) {}
    setIsLoadingSaved(false);
  };
  useEffect(() => { fetchSaved(); }, []);

  const handleToggleSave = async (inf) => {
    const isCurrentlySaved = savedInfluencers.some(s => s.id === inf.id) || inf.isSaved;
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
code = code.replace(badBlock, '');

// 2. Insert at the correct spot
let correctBlock = `
  const [activeTab, setActiveTab] = useState<'discover' | 'saved'>('discover');
  const [savedInfluencers, setSavedInfluencers] = useState<Influencer[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

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

  useEffect(() => {
    sessionStorage.setItem('sa_influencers_state', JSON.stringify({
      infs: influencers, query: searchQuery, ctry: country, lastQ: lastQuery, activeN: activeNiche
    }));
  }, [influencers, searchQuery, country, lastQuery, activeNiche]);

  const fetchSaved = async () => {
    setIsLoadingSaved(true);
    try {
      const res = await fetch('/api/influencers/saved');
      const data = await res.json();
      if (data.success) setSavedInfluencers(data.influencers);
    } catch (e) {}
    setIsLoadingSaved(false);
  };
  useEffect(() => { fetchSaved(); }, []);

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
        if (!isCurrentlySaved) setSavedInfluencers(prev => [data.influencer, ...prev]);
        else setSavedInfluencers(prev => prev.filter(s => s.id !== inf.id));
        setInfluencers(prev => prev.map(p => p.id === inf.id ? { ...p, isSaved: !isCurrentlySaved } : p));
      }
    } catch(e) {}
  };
`;
let targetInsertion = `  const runDiscovery = async`;
code = code.replace(targetInsertion, correctBlock + '\n' + targetInsertion);

fs.writeFileSync('src/app/dashboard/influencers/page.tsx', code);
