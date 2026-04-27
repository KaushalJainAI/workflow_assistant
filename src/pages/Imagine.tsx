import { useState } from 'react';
import { 
  Sparkles, 
  ImageIcon, 
  Video, 
  Headphones, 
  Wand2, 
  Download,
  Share2,
  Trash2,
  Settings2,
  History,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { StylePresetCard } from '../components/imagine/StylePresetCard';
import { Lightbox } from '../components/imagine/Lightbox';
import apiClient from '../api/client';
import { useEffect } from 'react';

const STYLE_PRESETS = [
  { id: 'none', name: 'Original', image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=200&auto=format&fit=crop' },
  { id: 'cinematic', name: 'Cinematic', image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=200&auto=format&fit=crop' },
  { id: 'anime', name: 'Anime', image: 'https://images.unsplash.com/photo-1578632292335-df3abbb0d586?q=80&w=200&auto=format&fit=crop' },
  { id: 'digital-art', name: 'Digital Art', image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop' },
  { id: '3d-render', name: '3D Render', image: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=200&auto=format&fit=crop' },
];

type Mode = 'image' | 'video' | 'audio';
type Status = 'pending' | 'processing' | 'completed' | 'failed';

interface Result {
  id: string;
  url: string;
  type: Mode;
  prompt: string;
  status: Status;
  error?: string;
  timestamp: Date;
}

export default function Imagine() {
  const [mode, setMode] = useState<Mode>('image');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  // Settings
  const [model, setModel] = useState('dalle-3');
  const [selectedStyle, setSelectedStyle] = useState('none');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [seed, setSeed] = useState<number | string>('');
  const [resolution, setResolution] = useState('1024x1024');
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Mode Specific Settings
  const [duration, setDuration] = useState('5s');
  const [motionIntensity, setMotionIntensity] = useState(5);
  const [fps, setFps] = useState(24);
  const [voice, setVoice] = useState('alloy');
  const [speed, setSpeed] = useState(1.0);
  
  // Backend Capabilities State
  const [capabilities, setCapabilities] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [capsRes, histRes] = await Promise.all([
          apiClient.get('/imagine/capabilities/'),
          apiClient.get('/imagine/')
        ]);
        setCapabilities(capsRes.data);
        
        // Transform backend results to frontend format
        const transformedResults = histRes.data.results.map((r: any) => ({
          id: r.id.toString(),
          url: r.output_url,
          type: r.type,
          prompt: r.prompt,
          status: r.status,
          error: r.error_message,
          timestamp: new Date(r.created_at)
        }));
        setResults(transformedResults);
      } catch (err) {
        console.error('Failed to fetch imagine data:', err);
      }
    };
    fetchData();
  }, []);

  // Set default model when mode or capabilities change
  useEffect(() => {
    if (capabilities?.[mode] && capabilities[mode].length > 0) {
      const currentModelExists = capabilities[mode].find((m: any) => m.id === model);
      if (!currentModelExists) {
        setModel(capabilities[mode][0].id);
      }
    }
  }, [mode, capabilities]);

  // Polling for pending results
  useEffect(() => {
    const pendingResults = results.filter(r => r.status === 'pending' || r.status === 'processing');
    if (pendingResults.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const updatedResults = [...results];
        let hasChanges = false;

        await Promise.all(pendingResults.map(async (pending) => {
          const res = await apiClient.get(`/imagine/${pending.id}/`);
          if (res.data.status !== pending.status) {
            const index = updatedResults.findIndex(r => r.id === pending.id);
            if (index !== -1) {
              updatedResults[index] = {
                ...updatedResults[index],
                status: res.data.status,
                url: res.data.output_url,
                error: res.data.error_message
              };
              hasChanges = true;
            }
          }
        }));

        if (hasChanges) {
          setResults(updatedResults);
        }
      } catch (err) {
        console.error('Polling failed:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [results]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    
    try {
      const response = await apiClient.post('/imagine/', {
        type: mode,
        prompt: prompt,
        negative_prompt: negativePrompt,
        model: model,
        resolution: resolution,
        duration: duration,
        seed: seed || undefined,
        motion_intensity: motionIntensity,
        fps: fps,
        voice: voice,
        speed: speed
      });

      const newResult: Result = {
        id: response.data.id.toString(),
        url: response.data.output_url,
        type: response.data.type,
        prompt: response.data.prompt,
        status: response.data.status,
        error: response.data.error_message,
        timestamp: new Date(response.data.created_at)
      };

      setResults(prev => [newResult, ...prev]);
      setPrompt('');
      if (newResult.status === 'completed') {
        toast.success('Generation complete');
      } else {
        toast.info('Generation started...');
      }
    } catch (err) {
      console.error('Generation failed:', err);
      toast.error('Failed to generate. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-background text-foreground font-sans selection:bg-primary/20 overflow-hidden">
      {/* Left Sidebar - Style Presets */}
      <div className="w-64 border-r border-border/40 bg-card/30 hidden lg:flex flex-col">
        <div className="p-6 border-b border-border/40">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Zap size={14} className="text-primary" />
            Style Library
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="grid grid-cols-2 gap-3">
            {STYLE_PRESETS.map(preset => (
              <StylePresetCard 
                key={preset.id}
                preset={preset}
                isActive={selectedStyle === preset.id}
                onClick={() => setSelectedStyle(preset.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation - Minimalist Tabs */}
        <div className="flex items-center justify-center pt-8 pb-4 border-b border-border/10">
          <div className="flex p-1 bg-muted/30 rounded-full border border-border/40">
            {[
              { id: 'image', icon: ImageIcon, label: 'Images' },
              { id: 'video', icon: Video, label: 'Video' },
              { id: 'audio', icon: Headphones, label: 'Audio' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setMode(t.id as Mode)}
                className={cn(
                  "flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold transition-all",
                  mode === t.id 
                    ? "bg-background text-foreground shadow-sm border border-border/50" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
            
            {/* Hero Prompt Box */}
            <div className="space-y-6">
              <div className="relative group">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Describe the ${mode} you want to create...`}
                  className="w-full min-h-[160px] p-8 text-xl bg-card border-2 border-border/40 rounded-[40px] outline-none focus:border-primary/40 transition-all resize-none shadow-sm placeholder:text-muted-foreground/20 leading-relaxed"
                />
                <div className="absolute bottom-6 right-6 flex items-center gap-3">
                  <button 
                    onClick={() => toast.info('Prompt refinement logic would go here')}
                    title="Improve Prompt"
                    className="p-3.5 rounded-2xl bg-muted/50 hover:bg-muted border border-border/50 text-muted-foreground hover:text-primary transition-all"
                  >
                    <Wand2 size={20} />
                  </button>
                  <button
                    disabled={isLoading || !prompt.trim()}
                    onClick={handleGenerate}
                    className="flex items-center gap-3 px-10 py-4 bg-primary text-primary-foreground rounded-[24px] font-black text-sm uppercase tracking-widest hover:shadow-2xl hover:shadow-primary/20 disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles size={18} />
                    )}
                    {isLoading ? 'Dreaming...' : 'Imagine'}
                  </button>
                </div>
              </div>

              {/* Resolution Quick Toggle - Hidden for Audio */}
              {mode !== 'audio' && capabilities?.[mode] && (
                <div className="flex items-center gap-2 px-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Size:</span>
                  {(capabilities[mode].find((m: any) => m.id === model)?.resolutions || ['1024x1024']).map((res: string) => (
                    <button
                      key={res}
                      onClick={() => setResolution(res)}
                      className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                        resolution === res ? "bg-primary/10 border-primary/40 text-primary" : "border-border/40 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              )}

              {/* Length/Duration Toggle - For Video and Audio */}
              {(mode === 'video' || mode === 'audio') && capabilities?.[mode] && (
                <div className="flex items-center gap-2 px-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Length:</span>
                  {(capabilities[mode].find((m: any) => m.id === model)?.durations || ['5s', '10s']).map((d: string) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                        duration === d ? "bg-primary/10 border-primary/40 text-primary" : "border-border/40 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Results Gallery */}
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                  <History size={16} className="text-muted-foreground" />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Recent Creations</h3>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground/50">{results.length} results</span>
              </div>

              {results.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center py-20 opacity-20 grayscale">
                  <ImageIcon size={64} strokeWidth={1} />
                  <p className="mt-4 text-sm font-medium tracking-tight">Your imagination is empty. Start typing.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-20">
                {isLoading && (
                  <div className="aspect-square rounded-[40px] bg-muted/30 border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-4 animate-pulse">
                    <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Generating...</span>
                  </div>
                )}
                
                {results.map((res) => (
                  <div 
                    key={res.id} 
                    className="group relative bg-card border border-border/40 rounded-[40px] overflow-hidden hover:shadow-2xl transition-all duration-500"
                  >
                    <div className="aspect-square overflow-hidden bg-black/5 cursor-zoom-in relative" onClick={() => {
                      if (res.status === 'completed') {
                        setSelectedResult(res);
                        setIsLightboxOpen(true);
                      }
                    }}>
                      {res.status === 'completed' ? (
                        res.type === 'image' ? (
                          <img src={res.url} alt={res.prompt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                          <video src={res.url} autoPlay loop muted className="w-full h-full object-cover" />
                        )
                      ) : res.status === 'failed' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-destructive/5 text-destructive p-8 text-center">
                          <Trash2 size={48} strokeWidth={1} className="mb-4" />
                          <p className="text-xs font-bold uppercase tracking-widest mb-2">Generation Failed</p>
                          <p className="text-[10px] opacity-70 line-clamp-3">{res.error || 'Unknown error occurred'}</p>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20 animate-pulse">
                          <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-bounce">Dreaming...</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Hover Actions */}
                    <div className="absolute top-6 right-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 duration-300">
                      {res.status === 'completed' && (
                        <>
                          <button className="p-3 bg-background/90 backdrop-blur rounded-2xl border border-border/50 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors shadow-lg">
                            <Download size={18} />
                          </button>
                          <button className="p-3 bg-background/90 backdrop-blur rounded-2xl border border-border/50 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors shadow-lg">
                            <Share2 size={18} />
                          </button>
                        </>
                      )}
                      <button className="p-3 bg-background/90 backdrop-blur rounded-2xl border border-border/50 text-foreground hover:bg-destructive hover:text-white transition-colors shadow-lg">
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="p-8 space-y-4">
                      <p className="text-sm font-medium leading-relaxed line-clamp-2 text-foreground/80 italic">"{res.prompt}"</p>
                      <div className="flex items-center justify-between pt-4 border-t border-border/40">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          <span className="px-2 py-0.5 bg-muted rounded">{res.type}</span>
                          <span>•</span>
                          <span>{res.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedResult(res);
                            setIsLightboxOpen(true);
                          }}
                          className="text-primary hover:underline text-[10px] font-black uppercase tracking-widest"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Advanced Controls */}
      <div className="w-80 border-l border-border/40 bg-card/30 hidden xl:flex flex-col">
        <div className="p-6 border-b border-border/40">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Settings2 size={14} className="text-primary" />
            Advanced
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          {/* Engine Selection */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Generation Engine</label>
            <div className="grid grid-cols-1 gap-2">
              {(capabilities?.[mode] || []).map((m: any) => (
                <button 
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={cn(
                    "w-full px-4 py-3 rounded-2xl text-xs font-bold border text-left transition-all flex items-center justify-between",
                    model === m.id ? "bg-primary/10 border-primary/40 text-primary shadow-sm" : "border-border/60 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <div className="flex flex-col">
                    <span>{m.name}</span>
                    <span className="text-[8px] opacity-50 font-medium uppercase tracking-tighter">{m.provider}</span>
                  </div>
                  {model === m.id && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Specific Advanced Controls */}
          {mode === 'video' && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Motion Intensity</label>
                  <span className="text-xs font-bold text-primary">{motionIntensity}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={motionIntensity}
                  onChange={(e) => setMotionIntensity(parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">FPS</label>
                <div className="grid grid-cols-3 gap-2">
                  {[24, 30, 60].map(f => (
                    <button
                      key={f}
                      onClick={() => setFps(f)}
                      className={cn(
                        "px-3 py-2 rounded-xl text-[10px] font-bold border transition-all",
                        fps === f ? "bg-primary/10 border-primary/40 text-primary" : "border-border/40 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {f} FPS
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {mode === 'audio' && (
            <>
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Voice Profile</label>
                <div className="grid grid-cols-2 gap-2">
                  {(capabilities?.[mode]?.find((m: any) => m.id === model)?.voices || []).map((v: string) => (
                    <button
                      key={v}
                      onClick={() => setVoice(v)}
                      className={cn(
                        "px-3 py-2 rounded-xl text-[10px] font-bold border transition-all uppercase",
                        voice === v ? "bg-primary/10 border-primary/40 text-primary" : "border-border/40 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Playback Speed</label>
                  <span className="text-xs font-bold text-primary">{speed}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </>
          )}

          {/* Negative Prompt - Hidden for Audio */}
          {mode !== 'audio' && (
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Negative Prompt</label>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="What to exclude (e.g. text, blurry, low quality)..."
                className="w-full min-h-[100px] p-4 text-xs bg-muted/30 border border-border/40 rounded-2xl outline-none focus:border-primary/40 transition-all resize-none placeholder:text-muted-foreground/30 leading-relaxed"
              />
            </div>
          )}

          {/* Seed */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Seed</label>
              <button 
                onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                className="text-[10px] font-bold text-primary hover:underline"
              >
                Randomize
              </button>
            </div>
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Auto-generated"
              className="w-full px-4 py-3 text-xs bg-muted/30 border border-border/40 rounded-2xl outline-none focus:border-primary/40 transition-all"
            />
          </div>
        </div>
      </div>

      <Lightbox 
        isOpen={isLightboxOpen} 
        onClose={() => setIsLightboxOpen(false)} 
        result={selectedResult} 
      />
    </div>
  );
}
