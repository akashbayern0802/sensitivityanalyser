'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, EyeOff, UploadCloud, X, Save, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react';

// ─── LinkedIn CSV Import component ───────────────────────────────────────────

interface ImportResult {
  name: string | null;
  headline: string | null;
  location: string | null;
  skillCount: number;
  positionCount: number;
  educationCount: number;
  skills?: string[];
}

interface LinkedInImportProps {
  onImportSuccess: (result: { name?: string; headline?: string; location?: string; linkedinUrl?: string; skills?: string[] }) => void;
}

function LinkedInImport({ onImportSuccess }: LinkedInImportProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const csvFiles = Array.from(newFiles).filter(f => f.name.toLowerCase().endsWith('.csv'));
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...csvFiles.filter(f => !names.has(f.name))];
    });
    setResult(null);
    setError('');
  }, []);

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name));

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleImport = async () => {
    if (!files.length) return;
    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));

      const res = await fetch('/api/profile/import', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.error || 'Import failed');

      setResult(data.extracted);
      onImportSuccess({
        name: data.extracted.name || undefined,
        headline: data.extracted.headline || undefined,
        location: data.extracted.location || undefined,
        linkedinUrl: data.extracted.linkedinUrl || undefined,
        skills: data.extracted.skills || [],
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const SUPPORTED = ['profile', 'position', 'skill', 'education'];
  const getFileStatus = (name: string) => {
    const lower = name.toLowerCase();
    return SUPPORTED.some(k => lower.includes(k)) ? 'supported' : 'unknown';
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
          isDragging
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40'
        }`}
      >
        <UploadCloud className={`h-10 w-10 mb-3 ${isDragging ? 'text-indigo-500' : 'text-gray-300'}`} />
        <p className="text-sm font-medium text-gray-700">
          <span className="text-indigo-600">Click to select</span> or drag &amp; drop CSV files
        </p>
        <p className="text-xs text-gray-400 mt-1">Profile.csv · Positions.csv · Skills.csv · Education.csv</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv"
          className="sr-only"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* Selected files list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map(f => (
            <li key={f.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white border border-gray-100">
              <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="flex-1 text-sm text-gray-700 truncate">{f.name}</span>
              {getFileStatus(f.name) === 'unknown' && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">unrecognised</span>
              )}
              <button onClick={(e) => { e.stopPropagation(); removeFile(f.name); }} className="text-gray-300 hover:text-red-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Error */}
      {error && (
        <div className="flex gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Success summary */}
      {result && (
        <div className="p-4 bg-green-50 border border-green-100 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Import successful — profile fields updated below
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-green-700 pt-1">
            {result.name && <span>✓ Name: <strong>{result.name}</strong></span>}
            {result.headline && <span>✓ Headline imported</span>}
            {result.location && <span>✓ Location: <strong>{result.location}</strong></span>}
            {result.skillCount > 0 && <span>✓ <strong>{result.skillCount}</strong> skills saved</span>}
            {result.positionCount > 0 && <span>✓ <strong>{result.positionCount}</strong> positions saved</span>}
            {result.educationCount > 0 && <span>✓ <strong>{result.educationCount}</strong> education entries saved</span>}
          </div>
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={handleImport}
        disabled={!files.length || uploading}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
        ) : (
          <><UploadCloud className="w-4 h-4" /> Import {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'CSV files'}</>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  gemini: ['gemini-3.1-flash-preview', 'gemini-3.1-pro-preview', 'gemini-2.0-flash', 'gemini-2.0-flash'],
  claude: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  'bedrock-mantle': [
    'openai.gpt-oss-120b',
    'anthropic.claude-haiku-4-5',
    'anthropic.claude-sonnet-4-5',
    'anthropic.claude-3-5-haiku-20241022-v1:0',
    'google.gemma-4-26b-a4b',
    'meta.llama3-1-70b-instruct-v1:0',
  ],
  'amazon-bedrock': [
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'anthropic.claude-3-5-haiku-20241022-v1:0',
    'amazon.nova-pro-v1:0',
    'amazon.nova-lite-v1:0',
    'meta.llama3-1-70b-instruct-v1:0',
  ],
  'google-vertex': [
    'gemini-3.8-flash',
    'gemini-2.0-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
  ],
  ollama: ['llama3.2', 'mistral', 'qwen2.5', 'deepseek-r1']
};

export default function SettingsPage() {
  const [isMounted, setIsMounted] = useState(false);

  // LLM Config
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState(PROVIDER_MODELS['openai'][0]);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModels, setCustomModels] = useState<Record<string, string[]>>({});
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434/v1');
  const [region, setRegion] = useState('us-east-1');
  const [awsSecretKey, setAwsSecretKey] = useState('');
  const [showAwsSecretKey, setShowAwsSecretKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Profile
  const [name, setName] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [location, setLocation] = useState('');
  const [interestInput, setInterestInput] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [importedSkills, setImportedSkills] = useState<string[]>([]);

  // Data Sources
  const [scanMode, setScanMode] = useState('manual');
  const [brightDataKey, setBrightDataKey] = useState('');
  const [scanTime, setScanTime] = useState('09:00');
  const [maxInfluencers, setMaxInfluencers] = useState('20');

  useEffect(() => {
    // Load from backend API and localStorage on mount
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setName(data.user.name || '');
            setLinkedinUrl(data.user.linkedinUrl || '');
            setTargetRole(data.user.targetRole || '');
            setLocation(data.user.targetLocation || '');
            try {
              setInterests(JSON.parse(data.user.interests || '[]'));
            } catch(e){}
            // Provider and model from server
            if (data.user.llmProvider) setProvider(data.user.llmProvider);
            if (data.user.llmModel) setModel(data.user.llmModel);
            // Load imported LinkedIn skills from Profile table
            try {
              const profileSkills = JSON.parse(data.user.profile?.skills || '[]');
              if (Array.isArray(profileSkills) && profileSkills.length) {
                setImportedSkills(profileSkills);
              }
            } catch(e){}
          }
        }
      } catch (e) {
        console.error("Failed to fetch profile", e);
      }
      let loadedCustomModels: Record<string, string[]> = {};
      try {
        const savedCustomModels = localStorage.getItem('sa_customModels');
        if (savedCustomModels) {
          loadedCustomModels = JSON.parse(savedCustomModels);
          setCustomModels(loadedCustomModels);
        }
      } catch (e) {}

      const savedProvider = localStorage.getItem('sa_provider') || 'openai';
      setProvider(savedProvider);
      
      const savedModel = localStorage.getItem('sa_model');
      if (savedModel) {
        setModel(savedModel);
        const isBuiltIn = PROVIDER_MODELS[savedProvider]?.includes(savedModel);
        const isSavedCustom = loadedCustomModels[savedProvider]?.includes(savedModel);
        if (!isBuiltIn && !isSavedCustom) {
          setIsCustomModel(true);
        }
      } else {
        setModel(PROVIDER_MODELS[savedProvider][0]);
      }
      
      setApiKey(localStorage.getItem(`sa_apiKey_${savedProvider}`) || '');
      if (savedProvider === 'amazon-bedrock') {
        setAwsSecretKey(localStorage.getItem('sa_awsSecretKey_amazon-bedrock') || '');
      }
      setBaseUrl(localStorage.getItem('sa_baseUrl') || 'http://localhost:11434/v1');
      setRegion(localStorage.getItem('sa_region') || 'us-east-1');
// Loaded from API above

      setScanMode(localStorage.getItem('sa_scanMode') || 'manual');
      setBrightDataKey(localStorage.getItem('sa_brightDataKey') || '');
      setScanTime(localStorage.getItem('sa_scanTime') || '09:00');
      setMaxInfluencers(localStorage.getItem('sa_maxInfluencers') || '20');
    };
    loadSettings();
    setIsMounted(true);
  }, []);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    setProvider(newProvider);
    setModel(PROVIDER_MODELS[newProvider][0]);
    setIsCustomModel(false);
    
    // Load the saved API key for the newly selected provider
    setApiKey(localStorage.getItem(`sa_apiKey_${newProvider}`) || '');
    if (newProvider === 'amazon-bedrock') {
      setAwsSecretKey(localStorage.getItem('sa_awsSecretKey_amazon-bedrock') || '');
    }
  };

  const addInterest = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && interestInput.trim()) {
      e.preventDefault();
      if (!interests.includes(interestInput.trim())) {
        setInterests([...interests, interestInput.trim()]);
      }
      setInterestInput('');
    }
  };

  const removeInterest = (indexToRemove: number) => {
    setInterests(interests.filter((_, index) => index !== indexToRemove));
  };

  const handleSave = async () => {
    // Save profile to database
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          linkedinUrl,
          targetRole,
          targetLocation: location,
          interests,
          llmProvider: provider,
          llmModel: model
        })
      });
    } catch (e) {
      console.error('Failed to save profile', e);
    }

    localStorage.setItem('sa_provider', provider);
    localStorage.setItem('sa_model', model);
    
    // Save the key strictly for this provider
    localStorage.setItem(`sa_apiKey_${provider}`, apiKey);
    if (provider === 'amazon-bedrock') {
      localStorage.setItem('sa_awsSecretKey_amazon-bedrock', awsSecretKey);
    }
    localStorage.setItem('sa_baseUrl', baseUrl);
    localStorage.setItem('sa_region', region);
    
    localStorage.setItem('sa_name', name);
    localStorage.setItem('sa_linkedinUrl', linkedinUrl);
    localStorage.setItem('sa_targetRole', targetRole);
    localStorage.setItem('sa_location', location);
    localStorage.setItem('sa_interests', JSON.stringify(interests));

    localStorage.setItem('sa_scanMode', scanMode);
    localStorage.setItem('sa_brightDataKey', brightDataKey);
    localStorage.setItem('sa_scanTime', scanTime);
    localStorage.setItem('sa_maxInfluencers', maxInfluencers);
    
    // Notify other components (like layout badge)
    window.dispatchEvent(new Event('sa_settings_updated'));
    
    alert('Settings saved successfully!');
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('Validating connection...');

    if (provider === 'gemini') {
      if (!apiKey.trim()) {
        setTestStatus('failed');
        setTestMessage('Please enter a Google Gemini API key.');
        return;
      }
      try {
        // Just verify the API key by listing models instead of querying a specific preview model ID
        // which might return 404 on the v1beta endpoint even if the model works for generation.
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
        if (res.ok) {
          setTestStatus('success');
          setTestMessage(`Successfully connected to Gemini API!`);
        } else {
          const errorData = await res.json().catch(() => ({}));
          setTestStatus('failed');
          setTestMessage(errorData.error?.message || `API Error: ${res.status} ${res.statusText}`);
        }
      } catch (err: any) {
        setTestStatus('failed');
        setTestMessage('Network error connecting to Gemini API.');
      }
    } else if (provider === 'groq') {
      if (!apiKey.trim()) {
        setTestStatus('failed');
        setTestMessage('Please enter a Groq API key.');
        return;
      }
      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey.trim()}` }
        });
        if (res.ok) {
          setTestStatus('success');
          setTestMessage('Successfully connected to Groq Cloud API!');
        } else {
          setTestStatus('failed');
          setTestMessage('Invalid Groq API key.');
        }
      } catch (err: any) {
        setTestStatus('failed');
        setTestMessage('Network error connecting to Groq API.');
      }
    } else if (provider === 'ollama') {
      try {
        const res = await fetch(`${baseUrl.replace(/\/v1\/?$/, '')}/api/tags`);
        if (res.ok) {
          const data = await res.json();
          setTestStatus('success');
          setTestMessage(`Connected to Ollama! Found ${data.models?.length || 0} local models.`);
        } else {
          setTestStatus('failed');
          setTestMessage('Ollama server reachable but returned an error.');
        }
      } catch (err: any) {
        setTestStatus('failed');
        setTestMessage('Could not reach Ollama at ' + baseUrl + '. Ensure Ollama is running.');
      }
    } else if (provider === 'openai') {
      if (!apiKey.trim()) {
        setTestStatus('failed');
        setTestMessage('Please enter an OpenAI API key.');
        return;
      }
      try {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey.trim()}` }
        });
        if (res.ok) {
          setTestStatus('success');
          setTestMessage(`Successfully connected to OpenAI API! Model: ${model}`);
        } else {
          setTestStatus('failed');
          setTestMessage('Invalid OpenAI API key.');
        }
      } catch (err: any) {
        setTestStatus('failed');
        setTestMessage('Network error connecting to OpenAI API.');
      }
    } else if (provider === 'google-vertex') {
      setTestStatus('success');
      setTestMessage('Google Vertex AI configured. Ready using ' + (apiKey.trim() ? 'entered API key' : 'GOOGLE_VERTEX_API_KEY from .env') + '.');
    } else {
      // Fallback for others
      setTestStatus('success');
      setTestMessage(`Simulated connection to ${provider} successful.`);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="max-w-4xl space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="mt-1 text-sm text-gray-500">Manage your LLM configuration, profile, and data sources.</p>
      </div>

      {/* LLM Configuration */}
      <section className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
        <div className="px-4 py-6 sm:p-8">
          <h3 className="text-base font-semibold leading-7 text-gray-900">LLM Configuration</h3>
          <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
            
            <div className="sm:col-span-3">
              <label htmlFor="provider" className="block text-sm font-medium leading-6 text-gray-900">Provider</label>
              <div className="mt-2">
                <select
                  id="provider"
                  value={provider}
                  onChange={handleProviderChange}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                >
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="google-vertex">Google Vertex AI</option>
                  <option value="claude">Anthropic Claude</option>
                  <option value="groq">Groq</option>
                  <option value="bedrock-mantle">Amazon Bedrock Mantle</option>
                  <option value="amazon-bedrock">Amazon Bedrock Runtime</option>
                  <option value="ollama">Ollama (Local)</option>
                </select>
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="model" className="block text-sm font-medium leading-6 text-gray-900">Model</label>
              <div className="mt-2">
                {isCustomModel ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="Enter custom model ID..."
                      className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        if (model.trim()) {
                          const updated = { ...customModels };
                          if (!updated[provider]) updated[provider] = [];
                          if (!updated[provider].includes(model.trim())) {
                            updated[provider] = [...updated[provider], model.trim()];
                          }
                          setCustomModels(updated);
                          localStorage.setItem('sa_customModels', JSON.stringify(updated));
                          setIsCustomModel(false);
                        }
                      }} 
                      className="text-sm text-white bg-indigo-600 px-3 py-1.5 rounded-md hover:bg-indigo-500"
                    >
                      Add
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { setIsCustomModel(false); setModel(PROVIDER_MODELS[provider]?.[0] || ''); }} 
                      className="text-sm text-indigo-600 px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Reset
                    </button>
                  </div>
                ) : (
                  <select
                    id="model"
                    value={model}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setIsCustomModel(true);
                        setModel('');
                      } else {
                        setModel(e.target.value);
                      }
                    }}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    {PROVIDER_MODELS[provider]?.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    {customModels[provider]?.map((m) => (
                      <option key={m} value={m}>{m} (Custom)</option>
                    ))}
                    <option value="custom">Other (Custom Model)...</option>
                  </select>
                )}
              </div>
            </div>

            {provider === 'ollama' ? (
              <div className="sm:col-span-6">
                <label htmlFor="baseUrl" className="block text-sm font-medium leading-6 text-gray-900">Base URL</label>
                <div className="mt-2">
                  <input
                    type="text"
                    id="baseUrl"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
            ) : (
              <div className="sm:col-span-6 grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
                <div className={provider === 'amazon-bedrock' ? 'sm:col-span-3' : 'sm:col-span-6'}>
                  <label htmlFor="apiKey" className="block text-sm font-medium leading-6 text-gray-900">
                    {provider === 'amazon-bedrock' ? 'AWS Access Key ID' : 'API Key'}
                  </label>
                  <div className="relative mt-2">
                    <input
                      type={showApiKey ? "text" : "password"}
                      id="apiKey"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="block w-full rounded-md border-0 py-1.5 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      placeholder={
                        provider === 'amazon-bedrock' 
                          ? 'Enter Access Key ID' 
                          : provider === 'google-vertex' 
                            ? 'Enter Vertex API Key or leave blank to use .env' 
                            : 'Enter your API key'
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500"
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {provider === 'google-vertex' && (
                    <p className="mt-1 text-xs text-gray-500">
                      Leave empty to use <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">GOOGLE_VERTEX_API_KEY</code> from your <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">.env</code> file.
                    </p>
                  )}
                </div>

                {provider === 'amazon-bedrock' && (
                  <div className="sm:col-span-3">
                    <label htmlFor="awsSecretKey" className="block text-sm font-medium leading-6 text-gray-900">
                      AWS Secret Access Key
                    </label>
                    <div className="relative mt-2">
                      <input
                        type={showAwsSecretKey ? "text" : "password"}
                        id="awsSecretKey"
                        value={awsSecretKey}
                        onChange={(e) => setAwsSecretKey(e.target.value)}
                        className="block w-full rounded-md border-0 py-1.5 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        placeholder="Enter Secret Access Key"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAwsSecretKey(!showAwsSecretKey)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500"
                      >
                        {showAwsSecretKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(provider === 'bedrock-mantle' || provider === 'amazon-bedrock') && (
              <div className="sm:col-span-3">
                <label htmlFor="region" className="block text-sm font-medium leading-6 text-gray-900">AWS Region</label>
                <div className="mt-2">
                  <input
                    type="text"
                    id="region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <button
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
            {testStatus !== 'idle' && (
              <span className={`text-sm font-medium ${testStatus === 'success' ? 'text-green-600' : testStatus === 'failed' ? 'text-red-600' : 'text-gray-500'}`}>
                {testMessage}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Profile Section */}
      <section className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
        <div className="px-4 py-6 sm:p-8">
          <h3 className="text-base font-semibold leading-7 text-gray-900">Profile Information</h3>
          <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
            
            <div className="sm:col-span-3">
              <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-900">Full Name</label>
              <div className="mt-2">
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="linkedinUrl" className="block text-sm font-medium leading-6 text-gray-900">LinkedIn URL</label>
              <div className="mt-2">
                <input
                  type="url"
                  id="linkedinUrl"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="targetRole" className="block text-sm font-medium leading-6 text-gray-900">Target Role</label>
              <div className="mt-2">
                <input
                  type="text"
                  id="targetRole"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g., Senior Software Engineer"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="location" className="block text-sm font-medium leading-6 text-gray-900">Target Location</label>
              <div className="mt-2">
                <input
                  type="text"
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Bangalore, India"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div className="sm:col-span-6">
              <label htmlFor="interests" className="block text-sm font-medium leading-6 text-gray-900">Areas of Interest</label>
              <p className="text-xs text-gray-500 mt-1 mb-2">Type an interest and press Enter to add.</p>
              <div className="mt-2 flex flex-wrap gap-2 mb-3">
                {interests.map((interest, idx) => (
                  <span key={idx} className="inline-flex items-center gap-x-1.5 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700">
                    {interest}
                    <button type="button" onClick={() => removeInterest(idx)} className="group relative -mr-1 h-4 w-4 rounded-full hover:bg-indigo-200">
                      <span className="sr-only">Remove</span>
                      <X size={14} className="text-indigo-700" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                id="interests"
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyDown={addInterest}
                placeholder="e.g., Artificial Intelligence"
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Imported LinkedIn Skills — read-only display */}
      {importedSkills.length > 0 && (
        <section className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
          <div className="px-4 py-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold leading-7 text-gray-900">LinkedIn Skills</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Imported from your Skills.csv — used by the AI to personalise your comments.
                </p>
              </div>
              <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                {importedSkills.length} skills
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {importedSkills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                >
                  {skill}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4">
              To update these skills, re-import your Skills.csv from the Import Profile Data section below.
            </p>
          </div>
        </section>
      )}

      {/* Data Sources */}
      <section className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
        <div className="px-4 py-6 sm:p-8">
          <h3 className="text-base font-semibold leading-7 text-gray-900">Data Sources & Scanning</h3>
          
          <div className="mt-6 space-y-6">
            <fieldset>
              <legend className="text-sm font-medium leading-6 text-gray-900">Scanning Mode</legend>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-x-3">
                  <input
                    id="scan-manual"
                    name="scanMode"
                    type="radio"
                    value="manual"
                    checked={scanMode === 'manual'}
                    onChange={(e) => setScanMode(e.target.value)}
                    className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <label htmlFor="scan-manual" className="block text-sm font-medium leading-6 text-gray-900">
                    Manual only (paste post URLs)
                  </label>
                </div>
                <div className="flex items-center gap-x-3">
                  <input
                    id="scan-extension"
                    name="scanMode"
                    type="radio"
                    value="extension"
                    checked={scanMode === 'extension'}
                    onChange={(e) => setScanMode(e.target.value)}
                    className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <label htmlFor="scan-extension" className="block text-sm font-medium leading-6 text-gray-900">
                    Chrome Extension (passive feed capture)
                  </label>
                </div>
                <div className="flex items-center gap-x-3">
                  <input
                    id="scan-automated"
                    name="scanMode"
                    type="radio"
                    value="automated"
                    checked={scanMode === 'automated'}
                    onChange={(e) => setScanMode(e.target.value)}
                    className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <label htmlFor="scan-automated" className="block text-sm font-medium leading-6 text-gray-900">
                    Automated daily scan
                  </label>
                </div>
              </div>
            </fieldset>

            {scanMode === 'automated' && (
              <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6 pt-4 border-t border-gray-100">
                <div className="sm:col-span-6">
                  <div className="flex gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <div className="shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-indigo-800">Powered by Gemini Search Grounding</p>
                      <p className="text-xs text-indigo-600 mt-1">
                        Influencer discovery uses <strong>Gemini 3.8 Flash with native Google Search</strong> — no Google Custom Search API key or Engine ID needed. Simply enter a niche in the Influencer Radar and results are fetched live from the web.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label htmlFor="brightDataKey" className="block text-sm font-medium leading-6 text-gray-900">
                    Bright Data API Key <span className="text-gray-400 font-normal">(optional — for full article extraction)</span>
                  </label>
                  <div className="mt-2">
                    <input
                      type="password"
                      id="brightDataKey"
                      value={brightDataKey}
                      onChange={(e) => setBrightDataKey(e.target.value)}
                      placeholder="Leave blank to use RSS/GitHub summaries only"
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">Used by the Off-Platform Radar to extract full article content for AI synthesis.</p>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="scanTime" className="block text-sm font-medium leading-6 text-gray-900">Daily Scan Time</label>
                  <div className="mt-2">
                    <input
                      type="time"
                      id="scanTime"
                      value={scanTime}
                      onChange={(e) => setScanTime(e.target.value)}
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="maxInfluencers" className="block text-sm font-medium leading-6 text-gray-900">
                    Max Influencers to scan ({maxInfluencers})
                  </label>
                  <div className="mt-2">
                    <input
                      type="range"
                      id="maxInfluencers"
                      min="5"
                      max="50"
                      value={maxInfluencers}
                      onChange={(e) => setMaxInfluencers(e.target.value)}
                      className="block w-full mt-3 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Import Profile Data */}
      <section className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
        <div className="px-4 py-6 sm:p-8">
          <h3 className="text-base font-semibold leading-7 text-gray-900">Import Profile Data</h3>
          <p className="mt-1 text-sm text-gray-500 mb-2">
            Automatically populate your profile from a LinkedIn data export.
          </p>
          <ol className="text-xs text-gray-500 list-decimal list-inside mb-6 space-y-0.5">
            <li>Go to <strong>LinkedIn → Settings → Data Privacy → Get a copy of your data</strong></li>
            <li>Request <strong>Profile.csv, Positions.csv, Skills.csv</strong> (and optionally Education.csv)</li>
            <li>Download the ZIP and extract it</li>
            <li>Drop those CSV files below</li>
          </ol>
          <LinkedInImport
            onImportSuccess={({ name: n, headline, location: loc, skills: sk, linkedinUrl: lUrl }) => {
              if (n) setName(n);
              if (headline) setTargetRole(headline);
              if (loc) setLocation(loc);
              if (sk && sk.length) setImportedSkills(sk);
              if (lUrl) setLinkedinUrl(lUrl);
            }}
          />
        </div>
      </section>

      <div className="flex items-center justify-end gap-x-6">
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-x-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
        >
          <Save size={18} />
          Save Settings
        </button>
      </div>
    </div>
  );
}




