'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookMarked, Database, Zap, Trash2, Plus, RefreshCw, ShieldCheck } from 'lucide-react';

interface VaultItem {
  id: string;
  title: string;
  category: string;
  content: string;
  createdAt: string;
  chunks?: Array<{ id: string; chunkIndex: number; tokenCount: number }>;
}

export function KnowledgeVaultManager() {
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [radarChunksIndexed, setRadarChunksIndexed] = useState(0);
  const [vaultTitle, setVaultTitle] = useState('');
  const [vaultCategory, setVaultCategory] = useState('career_history');
  const [vaultContent, setVaultContent] = useState('');
  const [isAddingToVault, setIsAddingToVault] = useState(false);
  const [isIndexingRadar, setIsIndexingRadar] = useState(false);
  const [vaultMessage, setVaultMessage] = useState('');
  const [vaultStatus, setVaultStatus] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const loadVaultItems = useCallback(async () => {
    try {
      const [itemsRes, statusRes, auditRes] = await Promise.all([
        fetch('/api/vault/items'),
        fetch('/api/vault/ingest'),
        fetch('/api/vault/audit?limit=10'),
      ]);
      const itemsData = await itemsRes.json();
      if (itemsData.success && itemsData.items) {
        setVaultItems(itemsData.items);
      }
      const statusData = await statusRes.json();
      if (statusData.success) {
        setRadarChunksIndexed(statusData.radarChunksIndexed || 0);
      }
      const auditData = await auditRes.json();
      if (auditData.success && auditData.logs) {
        setAuditLogs(auditData.logs);
      }
    } catch (e) {
      console.error('Failed to load vault items:', e);
    }
  }, []);

  useEffect(() => {
    loadVaultItems();
  }, [loadVaultItems]);

  const handleAddToVault = async () => {
    if (!vaultTitle.trim() || !vaultContent.trim()) return;
    setIsAddingToVault(true);
    setVaultMessage('');
    try {
      const createRes = await fetch('/api/vault/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: vaultTitle.trim(),
          category: vaultCategory,
          content: vaultContent.trim(),
        }),
      });
      const createData = await createRes.json();
      if (!createData.success) {
        throw new Error(createData.error || 'Failed to add vault item');
      }

      // Trigger semantic chunking + embedding for the newly added item
      const ingestRes = await fetch('/api/vault/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: createData.item.id }),
      });
      const ingestData = await ingestRes.json();
      const chunksCreated = ingestData.results?.[0]?.chunks ?? 0;

      setVaultTitle('');
      setVaultContent('');
      setVaultMessage(`✔ Added "${createData.item.title}" and indexed ${chunksCreated} semantic chunk(s).`);
      await loadVaultItems();
    } catch (err: any) {
      setVaultMessage(`Error: ${err.message}`);
    } finally {
      setIsAddingToVault(false);
    }
  };

  const handleDeleteVaultItem = async (id: string) => {
    try {
      const res = await fetch(`/api/vault/items/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setVaultItems(prev => prev.filter(item => item.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete vault item:', e);
    }
  };

  const handleIndexRadarEvents = async () => {
    setIsIndexingRadar(true);
    setVaultStatus('');
    try {
      const res = await fetch('/api/vault/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indexRadarEvents: true }),
      });
      const data = await res.json();
      if (data.success) {
        const newlyIndexed = (data.results || []).reduce((acc: number, r: any) => acc + (r.chunks || 0), 0);
        setVaultStatus(`✔ Radar indexing complete: ${newlyIndexed} new chunk(s) embedded.`);
        await loadVaultItems();
      } else {
        setVaultStatus(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setVaultStatus(`Error: ${err.message}`);
    } finally {
      setIsIndexingRadar(false);
    }
  };

  const totalVaultChunks = vaultItems.reduce((sum, item) => sum + (item.chunks?.length || 0), 0);

  return (
    <section className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
      <div className="px-4 py-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-semibold leading-7 text-gray-900">
                Anti-Hallucination Knowledge Vault (RAG)
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <ShieldCheck className="w-3.5 h-3.5" /> 5-Layer Grounded
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Paste your verified career history, technical frameworks, case studies, or past high-performing posts. Content Studio and Comment Studio will strictly ground factual claims in this vault.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
              {totalVaultChunks} Vault Chunks · {radarChunksIndexed} Radar Chunks
            </span>
          </div>
        </div>

        {/* Add New Item Form */}
        <div className="bg-gray-50/70 rounded-xl border border-gray-200/80 p-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600" />
            Add Verified Dossier or Case Study
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Title / Reference Label</label>
              <input
                type="text"
                value={vaultTitle}
                onChange={e => setVaultTitle(e.target.value)}
                placeholder="e.g., Q3 2024 KYC Architecture Migration (42% Latency Drop)"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select
                value={vaultCategory}
                onChange={e => setVaultCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value="career_history">Career History &amp; Metrics</option>
                <option value="technical_framework">Technical Framework</option>
                <option value="case_study">Production Case Study</option>
                <option value="verified_post">Verified Post / Claim</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Verified Facts, Metrics &amp; Narrative (Markdown supported)
            </label>
            <textarea
              value={vaultContent}
              onChange={e => setVaultContent(e.target.value)}
              placeholder="Paste exact project details, real metrics, architectures, company names, and lessons learned. The AI will chunk, embed, and cite this source..."
              rows={6}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleAddToVault}
              disabled={isAddingToVault || !vaultTitle.trim() || !vaultContent.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAddingToVault ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isAddingToVault ? 'Chunking & Embedding...' : 'Add & Index into Vault'}
            </button>

            {vaultMessage && (
              <p className={`text-xs font-medium ${vaultMessage.startsWith('✔') ? 'text-emerald-600' : 'text-red-600'}`}>
                {vaultMessage}
              </p>
            )}
          </div>
        </div>

        {/* Vault Items List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              Indexed Knowledge Sources ({vaultItems.length})
            </h4>
            <button
              type="button"
              onClick={handleIndexRadarEvents}
              disabled={isIndexingRadar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
            >
              {isIndexingRadar ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {isIndexingRadar ? 'Indexing Radar...' : 'Also Index All Radar Events'}
            </button>
          </div>

          {vaultItems.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400">
              <BookMarked className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium text-gray-600">Your Knowledge Vault is empty</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Add your career history or case studies above to activate 98%+ verified generation.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {vaultItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between p-3.5 bg-white rounded-xl border border-gray-200 hover:border-indigo-200 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 truncate">{item.title}</span>
                      <span className="px-2 py-0.5 text-[11px] rounded-full bg-indigo-50 text-indigo-700 font-medium border border-indigo-100">
                        {item.category.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2 py-0.5 text-[11px] rounded-full bg-emerald-50 text-emerald-700 font-medium">
                        {item.chunks?.length ?? 0} chunks
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 font-mono">
                      {item.content}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteVaultItem(item.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    title="Remove from vault"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {vaultStatus && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-xs font-medium text-emerald-800">{vaultStatus}</p>
            </div>
          )}
        </div>

        {/* Hallucination Audit Logs (Faithfulness Scores) */}
        {auditLogs.length > 0 && (
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Recent Hallucination Audit Logs ({auditLogs.length})
              </h4>
              <span className="text-xs text-gray-500">Live Faithfulness Scoring</span>
            </div>

            <div className="space-y-2">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${
                        log.faithfulnessScore >= 0.95 ? 'bg-emerald-100 text-emerald-800' :
                        log.faithfulnessScore >= 0.7 ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        Faithfulness: {Math.round(log.faithfulnessScore * 100)}%
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 uppercase font-medium text-[10px]">
                        {log.generationType}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        log.status === 'passed' ? 'bg-emerald-50 text-emerald-700' :
                        log.status === 'remediated' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        Status: {log.status}
                      </span>
                    </div>
                    <span className="text-gray-400 text-[11px]">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-gray-600 line-clamp-1 italic">
                    &quot;{log.outputSnippet}&quot;
                  </p>

                  {Array.isArray(log.flaggedClaims) && log.flaggedClaims.length > 0 && (
                    <div className="pt-1">
                      <p className="text-[11px] font-medium text-red-600">
                        {log.flaggedClaims.length} unverified claim(s) flagged/stripped by critic:
                      </p>
                      <ul className="list-disc list-inside text-gray-500 text-[10px] pl-1">
                        {log.flaggedClaims.slice(0, 2).map((claim: string, idx: number) => (
                          <li key={idx} className="truncate">{claim}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

