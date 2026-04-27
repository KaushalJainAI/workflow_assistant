import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  ImageIcon, 
  Video, 
  Headphones, 
  Wand2, 
  Upload, 
  X, 
  ChevronDown,
  Download,
  Share2,
  Trash2,
  Maximize2,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../api/client';
import { cn } from '../lib/utils';

type Mode = 'image' | 'video' | 'audio';

interface Result {
  id: string;
  url: string;
  type: Mode;
  prompt: string;
  timestamp: Date;
}

export default function Imagine() {
  const [mode, setMode] = useState<Mode>('image');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [showSettings, setShowMore] = useState(false);
  
  // Settings
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [model, setModel] = useState('dalle-3');

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    const id = Math.random().toString(36).substring(7);
    
    // Simulate generation
    setTimeout(() => {
      const newResult: Result = {
        id,
        url: mode === 'image' 
          ? `https://images.unsplash.com/photo-1707343843437-caacff5cfa74?q=80&w=1000&auto=format&fit=crop` 
          : 'https://cdn.pixabay.com/vimeo/843132714/clouds-171123.mp4?width=1280&hash=5a9d8c8c5c',
        type: mode,
        prompt,
        timestamp: new Date()
      };
      setResults(prev => [newResult, ...prev]);
      setIsLoading(false);
      setPrompt('');
      toast.success('Generation complete');
    }, 3000);
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground font-sans selection:bg-primary/20">
      {/* Top Navigation - Minimalist Tabs */}
      <div className="flex items-center justify-center pt-8 pb-4">
        <div className="flex p-1 bg-muted/50 rounded-full border border-border/40">
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

      {/* Main Action Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
          
          {/* Hero Prompt Box */}
          <div className="space-y-6">
            <div className="relative group">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`Describe the ${mode} you want to create...`}
                className="w-full min-h-[140px] p-6 text-xl bg-card border-2 border-border/40 rounded-[32px] outline-none focus:border-primary/40 transition-all resize-none shadow-sm placeholder:text-muted-foreground/30"
              />
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <button 
                  onClick={() => setShowMore(!showSettings)}
                  className="p-3 rounded-2xl bg-muted/50 hover:bg-muted border border-border/50 text-muted-foreground transition-colors"
                >
                  <Wand2 size={20} />
                </button>
                <button
                  disabled={isLoading || !prompt.trim()}
                  onClick={handleGenerate}
                  className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-black text-sm uppercase tracking-wider hover:shadow-xl hover:shadow-primary/20 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isLoading ? (
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {isLoading ? 'Dreaming...' : 'Imagine'}
                </button>
              </div>
            </div>

            {/* Quick Settings Bar */}
            {showSettings && (
              <div className="flex flex-wrap items-center gap-4 p-6 bg-card border border-border/40 rounded-[24px] animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Engine</label>
                  <div className="flex gap-2">
                    {['dalle-3', 'sdxl', 'midjourney'].map(m => (
                      <button 
                        key={m}
                        onClick={() => setModel(m)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                          model === m ? "bg-primary/10 border-primary/40 text-primary" : "border-border/60 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-8 w-px bg-border/40 mx-2" />
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aspect</label>
                  <div className="flex gap-2">
                    {['1:1', '16:9', '9:16', '4:5'].map(a => (
                      <button 
                        key={a}
                        onClick={() => setAspectRatio(a)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                          aspectRatio === a ? "bg-primary/10 border-primary/40 text-primary" : "border-border/60 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results Gallery */}
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Recent Creations</h3>
              <span className="text-[10px] font-bold text-muted-foreground/50">{results.length} results</span>
            </div>

            {results.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-20 opacity-20 grayscale">
                <ImageIcon size={64} strokeWidth={1} />
                <p className="mt-4 text-sm font-medium tracking-tight">Your imagination is empty. Start typing.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {isLoading && (
                <div className="aspect-video rounded-[32px] bg-muted/30 border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-4 animate-pulse">
                  <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Generating...</span>
                </div>
              )}
              
              {results.map((res) => (
                <div key={res.id} className="group relative bg-card border border-border/40 rounded-[32px] overflow-hidden hover:shadow-2xl transition-all duration-500">
                  <div className="aspect-video overflow-hidden bg-black/5">
                    {res.type === 'image' ? (
                      <img src={res.url} alt={res.prompt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <video src={res.url} autoPlay loop muted className="w-full h-full object-cover" />
                    )}
                  </div>
                  
                  {/* Hover Actions */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 duration-300">
                    <button className="p-2.5 bg-background/90 backdrop-blur rounded-xl border border-border/50 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors shadow-lg">
                      <Download size={18} />
                    </button>
                    <button className="p-2.5 bg-background/90 backdrop-blur rounded-xl border border-border/50 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors shadow-lg">
                      <Share2 size={18} />
                    </button>
                    <button className="p-2.5 bg-background/90 backdrop-blur rounded-xl border border-border/50 text-foreground hover:bg-destructive hover:text-white transition-colors shadow-lg">
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="p-6 space-y-3">
                    <p className="text-sm font-medium leading-relaxed line-clamp-2 text-foreground/80 italic">"{res.prompt}"</p>
                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        <span className="px-2 py-0.5 bg-muted rounded">{res.type}</span>
                        <span>•</span>
                        <span>{res.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <button className="text-primary hover:underline text-[10px] font-black uppercase tracking-widest">Details</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
