'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sparkles, Edit3, Image as ImageIcon, Copy, Check, Loader2, ArrowLeft, LayoutTemplate } from 'lucide-react';

function ContentStudioContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'generator' | 'editor'>('generator');
  
  // Generator State
  const [topic, setTopic] = useState('');
  const [format, setFormat] = useState('Text');
  const [angle, setAngle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generatorMode, setGeneratorMode] = useState<'topic' | 'url'>('topic');
  const [extractUrl, setExtractUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  
  // Editor State
  const [postBody, setPostBody] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [alignmentScore, setAlignmentScore] = useState<number | null>(null);
  const [alignmentFeedback, setAlignmentFeedback] = useState<string[]>([]);
  const [alignmentSuggestion, setAlignmentSuggestion] = useState('');
  const [isCheckingAlignment, setIsCheckingAlignment] = useState(false);

  // Carousel State
  const [carouselSlides, setCarouselSlides] = useState<Array<{id:number;title:string;body:string;isTitle?:boolean;isCta?:boolean}>>([]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleExportPdf = async () => {
    if (carouselSlides.length === 0) return;
    setIsExportingPdf(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [1080, 1080] });

      for (let i = 0; i < slideRefs.current.length; i++) {
        const el = slideRefs.current[i];
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 1, useCORS: true, width: 1080, height: 1080 });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 1080, 1080);
      }

      pdf.save('linkedin-carousel.pdf');
    } catch (e) {
      console.error('PDF export failed', e);
      alert('PDF export failed. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleRewrite = async () => {
    if (!feedback.trim()) return;
    setIsRewriting(true);
    setError('');
    try {
      const config = getLLMConfig();
      const response = await fetch('/api/content/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentBody: postBody, feedback, modelConfig: config }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to rewrite content');
      }
      const data = await response.json();
      setPostBody(data.rewrittenBody || '');
      setFeedback('');
    } catch (err: any) {
      setError(err.message || 'An error occurred during rewrite');
    } finally {
      setIsRewriting(false);
    }
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    setError('');
    try {
      const config = getLLMConfig();
      const response = await fetch('/api/content/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt, modelConfig: config }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate image');
      }
      const data = await response.json();
      setImageUrl(data.imageUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to generate image');
      alert(err.message || 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  useEffect(() => {
    const topicParam = searchParams.get('topic');
    const formatParam = searchParams.get('format');
    
    if (topicParam) setTopic(topicParam);
    if (formatParam) setFormat(formatParam);
  }, [searchParams]);

  const getLLMConfig = () => {
    const provider = localStorage.getItem('sa_provider') || 'openai';
    return {
      provider,
      modelId: localStorage.getItem('sa_model') || 'gpt-4o-mini',
      apiKey: localStorage.getItem(`sa_apiKey_${provider}`) || '',
      awsSecretKey: provider === 'amazon-bedrock' ? (localStorage.getItem('sa_awsSecretKey_amazon-bedrock') || '') : '',
      ollamaBaseUrl: localStorage.getItem('sa_baseUrl') || '',
      bedrockRegion: localStorage.getItem('sa_region') || ''
    };
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Topic is required');
      return;
    }
    
    setIsGenerating(true);
    setError('');
    
    try {
      const config = getLLMConfig();
      const response = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          format,
          angle,
          modelConfig: config
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate content');
      }

      const data = await response.json();
      setPostBody(data.draft?.body || data.content || '');
      setImagePrompt(data.draft?.imagePrompt || data.imagePrompt || '');

      // Parse carousel slides if format is carousel
      if (format.toLowerCase().includes('carousel') || format.toLowerCase().includes('slide')) {
        const { parseCarouselText } = await import('@/lib/carouselParser');
        const slides = parseCarouselText(data.draft?.body || '');
        setCarouselSlides(slides);
      } else {
        setCarouselSlides([]);
      }

      setActiveTab('editor');
    } catch (err: any) {
      setError(err.message || 'An error occurred during generation');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCheckAlignment = async () => {
    if (!postBody.trim()) return;
    setIsCheckingAlignment(true);
    try {
      const config = getLLMConfig();
      const res = await fetch('/api/content/align', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postBody, modelConfig: config }),
      });
      const data = await res.json();
      if (data.success) {
        setAlignmentScore(data.score);
        setAlignmentFeedback(data.feedback || []);
        setAlignmentSuggestion(data.suggestedEdits || '');
      }
    } catch (e) {
      console.error('Alignment check failed', e);
    } finally {
      setIsCheckingAlignment(false);
    }
  };

  const handleExtract = async () => {
    if (!extractUrl.trim()) return;
    setIsExtracting(true);
    setError('');
    try {
      const config = getLLMConfig();
      const res = await fetch('/api/content/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: extractUrl, modelConfig: config }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setPostBody(data.draft?.body || '');
      setImagePrompt(data.draft?.imagePrompt || '');
      setActiveTab('editor');
    } catch (err: any) {
      setError(err.message || 'Failed to extract content');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(postBody);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button 
            onClick={() => router.back()} 
            className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Content Studio</h1>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('generator')}
            className={`flex-1 py-4 px-6 text-center font-medium text-sm flex items-center justify-center transition-colors ${
              activeTab === 'generator'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generator
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex-1 py-4 px-6 text-center font-medium text-sm flex items-center justify-center transition-colors ${
              activeTab === 'editor'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Edit3 className="w-4 h-4 mr-2" />
            Editor
          </button>
        </div>

        <div className="p-6 md:p-8">
          {activeTab === 'generator' && (
            <div className="max-w-2xl mx-auto space-y-6">
              
              {/* Generator Mode Toggle */}
              <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                <button
                  onClick={() => { setGeneratorMode('topic'); setError(''); }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    generatorMode === 'topic' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  ✏️ Generate from Topic
                </button>
                <button
                  onClick={() => { setGeneratorMode('url'); setError(''); }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    generatorMode === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🔗 Extract from URL
                </button>
              </div>

              {generatorMode === 'topic' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Topic <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., 5 lessons learned from failing my first startup"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Format
                    </label>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-shadow"
                    >
                      <option value="Text">Standard Text Post</option>
                      <option value="Story">Personal Story</option>
                      <option value="Listicle">Listicle / Bullet points</option>
                      <option value="Actionable Tip">Actionable Tip</option>
                      <option value="Contrarian">Contrarian View</option>
                      <option value="Carousel Slides">Carousel / PDF Slides</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Angle / Tone (Optional)
                    </label>
                    <input
                      type="text"
                      value={angle}
                      onChange={(e) => setAngle(e.target.value)}
                      placeholder="e.g., Professional yet conversational, inspiring"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                    />
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !topic.trim()}
                    className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-lg mt-8"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Generate Post
                      </>
                    )}
                  </button>
                </>
              )}

              {generatorMode === 'url' && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-sm font-semibold text-blue-900 mb-1">💡 Knowledge Share Extractor</p>
                    <p className="text-xs text-blue-700">Paste any URL — GitHub PR, blog post, technical article, or industry report. The AI extracts 3 actionable insights and formats them as a 360 Brew-optimised educational post.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Source URL</label>
                    <input
                      type="url"
                      value={extractUrl}
                      onChange={(e) => setExtractUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
                      placeholder="https://github.com/owner/repo/pull/123 or https://blog.example.com/post"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                    />
                  </div>
                  {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
                  <button
                    onClick={handleExtract}
                    disabled={isExtracting || !extractUrl.trim()}
                    className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-lg"
                  >
                    {isExtracting ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Extracting... (~15 sec)</>
                    ) : (
                      <>🔗 Scan &amp; Extract Knowledge</>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Editor Section */}
              <div className="lg:col-span-3 space-y-6">

                {/* Carousel Preview — Feature 4 */}
                {carouselSlides.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700">🏗️ Carousel Preview ({carouselSlides.length} slides)</h3>
                      <button
                        onClick={handleExportPdf}
                        disabled={isExportingPdf}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {isExportingPdf ? <><Loader2 className="w-4 h-4 animate-spin" />Generating PDF...</> : <>📄 Export as LinkedIn PDF</>}
                      </button>
                    </div>

                    {/* Slide preview grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {carouselSlides.map((slide, i) => (
                        <div
                          key={slide.id}
                          className={`rounded-lg p-3 text-white text-xs font-medium aspect-square flex flex-col justify-between ${
                            i === 0 ? 'bg-gradient-to-br from-indigo-600 to-purple-700' :
                            i === 1 ? 'bg-gradient-to-br from-purple-600 to-pink-600' :
                            i === 2 ? 'bg-gradient-to-br from-blue-600 to-cyan-600' :
                            i === 3 ? 'bg-gradient-to-br from-emerald-600 to-teal-600' :
                            'bg-gradient-to-br from-orange-500 to-red-600'
                          }`}
                        >
                          <span className="text-white/50 text-[10px]">Slide {slide.id}</span>
                          <div>
                            {slide.title && <p className="font-bold leading-tight mb-1 text-[11px]">{slide.title.substring(0, 60)}{slide.title.length > 60 ? '...' : ''}</p>}
                            {slide.body && <p className="text-white/80 text-[10px] leading-snug">{slide.body.substring(0, 80)}{slide.body.length > 80 ? '...' : ''}</p>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Hidden full-resolution slides for PDF export */}
                    <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
                      {carouselSlides.map((slide, i) => (
                        <div
                          key={slide.id}
                          ref={el => { slideRefs.current[i] = el; }}
                          style={{
                            width: '1080px', height: '1080px', padding: '80px', boxSizing: 'border-box',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                            background: i === 0 ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' :
                                        i === 1 ? 'linear-gradient(135deg, #9333ea, #db2777)' :
                                        i === 2 ? 'linear-gradient(135deg, #2563eb, #0891b2)' :
                                        i === 3 ? 'linear-gradient(135deg, #059669, #0f766e)' :
                                                   'linear-gradient(135deg, #f97316, #dc2626)',
                            color: 'white', position: 'relative',
                          }}
                        >
                          {!slide.isTitle && (
                            <div style={{ position: 'absolute', top: '40px', right: '60px', fontSize: '18px', opacity: 0.6, fontWeight: 600 }}>{i + 1}</div>
                          )}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            {slide.title && <h2 style={{ fontSize: slide.isTitle ? '72px' : '52px', fontWeight: 800, lineHeight: 1.1, marginBottom: '32px', letterSpacing: '-1px' }}>{slide.title}</h2>}
                            {slide.body && <p style={{ fontSize: '34px', lineHeight: 1.5, opacity: 0.9 }}>{slide.body}</p>}
                          </div>
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '20px', opacity: 0.7 }}>Sensitivity Analyser</span>
                            <span style={{ fontSize: '18px', opacity: 0.4 }}>Swipe →</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Post Content
                    </label>
                    <span className={`text-xs ${postBody.length > 3000 ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                      {postBody.length} / 3000 characters
                    </span>
                  </div>
                  <textarea
                    value={postBody}
                    onChange={(e) => setPostBody(e.target.value)}
                    rows={12}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y transition-shadow"
                    placeholder="Write or edit your post here..."
                  />
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm mb-4">
                    {error}
                  </div>
                )}

                {/* AI Converse & Rewrite */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" /> Converse with AI
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="e.g. Make it punchier, tone it down, add a call to action..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleRewrite()}
                    />
                    <button
                      onClick={handleRewrite}
                      disabled={isRewriting || !feedback.trim()}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center whitespace-nowrap"
                    >
                      {isRewriting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Edit3 className="w-4 h-4 mr-2" />}
                      Rewrite
                    </button>
                  </div>
                </div>

                {/* Image Prompt & Generation */}
                {imagePrompt && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center text-indigo-800 mb-1 font-medium text-sm">
                          <ImageIcon className="w-4 h-4 mr-2" />
                          Suggested Image Prompt
                        </div>
                        <p className="text-xs text-indigo-900/70 italic">
                          {imagePrompt}
                        </p>
                      </div>
                      <button
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center whitespace-nowrap shrink-0"
                      >
                        {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ImageIcon className="w-4 h-4 mr-2" />}
                        {imageUrl ? 'Regenerate Image' : 'Generate Image'}
                      </button>
                    </div>

                    {imageUrl && (
                      <div className="border border-indigo-200/60 rounded-lg p-3 bg-white flex flex-col items-center gap-2 mt-2">
                        <img src={imageUrl} alt="Generated for post" className="max-h-72 rounded-md object-contain shadow-sm" />
                        <div className="flex gap-2">
                          <a
                            href={imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download="post-image.png"
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1 mt-1"
                          >
                            Open / Download Full Image
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Authority Alignment Checker */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                      <span>🎯</span> 360 Brew Alignment Score
                    </label>
                    <button
                      onClick={handleCheckAlignment}
                      disabled={isCheckingAlignment || !postBody.trim()}
                      className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      {isCheckingAlignment ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>✓</span>}
                      {isCheckingAlignment ? 'Analysing...' : 'Check Alignment'}
                    </button>
                  </div>

                  {alignmentScore !== null && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className={`text-3xl font-bold ${
                          alignmentScore >= 80 ? 'text-green-600' :
                          alignmentScore >= 50 ? 'text-amber-500' : 'text-red-500'
                        }`}>
                          {alignmentScore}
                        </div>
                        <div className="flex-1">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                alignmentScore >= 80 ? 'bg-green-500' :
                                alignmentScore >= 50 ? 'bg-amber-400' : 'bg-red-500'
                              }`}
                              style={{ width: `${alignmentScore}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {alignmentScore >= 80 ? '🟢 Strong alignment — 360 Brew will classify this as Expert Knowledge' :
                             alignmentScore >= 50 ? '🟡 Moderate — consider tightening the connection to your niche' :
                             '🔴 Low alignment — algorithm may suppress this post'}
                          </p>
                        </div>
                      </div>

                      {alignmentFeedback.length > 0 && (
                        <ul className="space-y-1">
                          {alignmentFeedback.map((f, i) => (
                            <li key={i} className="text-xs text-gray-600 flex gap-2">
                              <span className="text-gray-400 shrink-0">•</span>{f}
                            </li>
                          ))}
                        </ul>
                      )}

                      {alignmentSuggestion && (
                        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                          <p className="text-xs font-medium text-purple-800 mb-1">Suggested hook rewrite:</p>
                          <p className="text-xs text-purple-900 italic">{alignmentSuggestion}</p>
                          <button
                            onClick={() => {
                              const lines = postBody.split('\n');
                              const rest = lines.slice(3).join('\n');
                              setPostBody(alignmentSuggestion + '\n\n' + rest);
                              setAlignmentSuggestion('');
                              setAlignmentScore(null);
                            }}
                            className="mt-2 text-xs text-purple-600 hover:text-purple-800 font-medium"
                          >
                            Apply suggestion →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {alignmentScore === null && !isCheckingAlignment && (
                    <p className="text-xs text-gray-400">Run a check to see how well this post aligns with your professional identity on LinkedIn.</p>
                  )}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy to Clipboard
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Preview Section */}
              <div className="lg:col-span-2">
                <div className="sticky top-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <LayoutTemplate className="w-4 h-4 mr-2" />
                    LinkedIn Preview
                  </label>
                  
                  <div className="border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm">
                    {/* Mock LinkedIn Header */}
                    <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0"></div>
                      <div>
                        <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 w-32 bg-gray-100 rounded"></div>
                      </div>
                    </div>
                    
                    {/* Mock LinkedIn Body */}
                    <div className="p-4">
                      {postBody ? (
                        <div className="text-sm text-gray-800 whitespace-pre-wrap font-sans">
                          {postBody.length > 200 ? (
                            <>
                              {postBody.substring(0, 200)}...
                              <span className="text-gray-500 hover:text-blue-600 cursor-pointer block mt-1 font-medium">see more</span>
                            </>
                          ) : (
                            postBody
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="h-3 w-full bg-gray-100 rounded"></div>
                          <div className="h-3 w-5/6 bg-gray-100 rounded"></div>
                          <div className="h-3 w-4/6 bg-gray-100 rounded"></div>
                        </div>
                      )}
                    </div>
                    
                    {/* Mock LinkedIn Footer */}
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between">
                      <div className="h-4 w-12 bg-gray-200 rounded"></div>
                      <div className="h-4 w-12 bg-gray-200 rounded"></div>
                      <div className="h-4 w-12 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContentStudioPage() {
  return (
    <Suspense fallback={<div>Loading studio...</div>}>
      <ContentStudioContent />
    </Suspense>
  );
}






