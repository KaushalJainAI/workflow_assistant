import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Wand2, 
  Play, 
  Clock, 
  History,
  Image as ImageIcon,
  Video,
  Volume2,
  Mic,
  Camera,
  Layers,
  Zap,
  ChevronDown,
  X,
  Film,
  Maximize2,
  Move,
  RefreshCcw,
  Plus,
  Sliders,
  Music,
  Activity,
  Waves,
  Headphones,
  FastForward,
  Cpu,
  Layout,
  Palette,
  Timer
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import apiClient from '../api/client';
import { MediaPreview } from '../components/chat/MediaPreview';

interface Skill {
  id: string;
  title: string;
  content: string;
}

interface ModelOption {
  id: string;
  name: string;
  description: string;
  icon: any;
}

export default function Imagine() {
  const [mode, setMode] = useState<'image' | 'video' | 'audio'>('video');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [magicRefine, setMagicRefine] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Categorization / Shared Params
  const [quality, setQuality] = useState('Professional');
  const [duration, setDuration] = useState(10);
  
  // Image Specific
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [imageStyle, setImageStyle] = useState('Photorealistic');
  
  // Video Specific
  const [motionStrength, setMotionStrength] = useState(5);
  const [pan, setPan] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [roll, setRoll] = useState(0);
  const [audioSync, setAudioSync] = useState(true);
  
  // Audio Specific
  const [bpm, setBpm] = useState(120);
  const [audioStyle, setAudioStyle] = useState('Cinematic');
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [voiceProfile, setVoiceProfile] = useState('Echo-1');
  
  // Skills
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  
  // Media Uploads
  const [refImages, setRefImages] = useState<File[]>([]);
  const [refAudio, setRefAudio] = useState<File | null>(null);

  // Model Options Mapping
  const modelsByMode: Record<string, ModelOption[]> = {
    image: [
      { id: 'dalle-3', name: 'DALL-E 3', description: 'Advanced photorealism & detail', icon: Cpu },
      { id: 'midjourney', name: 'Midjourney v6', description: 'Artistic mastery & style', icon: Palette },
      { id: 'sdxl', name: 'Stable Diffusion XL', description: 'High-speed open generation', icon: Zap }
    ],
    video: [
      { id: 'runway-gen3', name: 'Runway Gen-3', description: 'Hyper-realistic cinematic motion', icon: Film },
      { id: 'luma-dream', name: 'Luma Dream Machine', description: 'Spatial consistency & physics', icon: Move },
      { id: 'kling-ai', name: 'Kling AI', description: 'Extended duration storytelling', icon: Timer },
      { id: 'sora-draft', name: 'Sora (Draft)', description: 'World-scale synthesis', icon: Sparkles }
    ],
    audio: [
      { id: 'suno-v3', name: 'Suno v3.5', description: 'Full song composition with lyrics', icon: Music },
      { id: 'udio', name: 'Udio', description: 'High-fidelity audio architecture', icon: Activity },
      { id: 'elevenlabs', name: 'ElevenLabs', description: 'Professional voice & narration', icon: Mic }
    ]
  };

  const currentModels = modelsByMode[mode];

  useEffect(() => {
    setSelectedModel(currentModels[0].id);
  }, [mode]);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const response = await apiClient.get('/skills/search/', { params: { tab: 'mine' } });
        setSkills(response.data.results || []);
      } catch (error) {
        console.error('Failed to fetch skills:', error);
      }
    };
    fetchSkills();
  }, []);

  const handleSkillInjection = (skillId: string) => {
    const skill = skills.find(s => s.id === skillId);
    if (skill) {
      setPrompt(prev => `${prev} ${skill.content}`.trim());
      toast.success(`Injected skill: ${skill.title}`);
    }
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt to begin imagining');
      return;
    }
    setIsLoading(true);
    toast.info(`Using ${modelsByMode[mode].find(m => m.id === selectedModel)?.name} to synthesize...`);
    
    setTimeout(() => {
      setIsLoading(false);
      toast.success(`${mode.charAt(0).toUpperCase() + mode.slice(1)} generated successfully`);
    }, 4000);
  };

  const handleFileUpload = (type: string, files: FileList | null) => {
    if (!files) return;
    const file = files[0];
    switch(type) {
        case 'image': if (refImages.length < 4) setRefImages(prev => [...prev, file]); break;
        case 'audio': setRefAudio(file); break;
    }
  };

  // Custom Dropdown Component
  const CustomDropdown = ({ 
    label, 
    value, 
    onChange, 
    options, 
    icon: Icon, 
    className,
    isModelSelector = false
  }: { 
    label: string, 
    value: string, 
    onChange: (val: string) => void, 
    options: (string | ModelOption)[], 
    icon: any,
    className?: string,
    isModelSelector?: boolean
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const displayValue = isModelSelector 
      ? (options as ModelOption[]).find(m => m.id === value)?.name || value 
      : value;

    return (
      <div className={cn("space-y-2 relative", className)} ref={dropdownRef}>
        {label && <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40 px-1">{label}</label>}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full h-11 bg-background/50 backdrop-blur-md border border-border/40 rounded-xl px-4 flex items-center justify-between group transition-all",
            "hover:bg-accent/30 hover:border-primary/30",
            isOpen && "border-primary/50 ring-2 ring-primary/10"
          )}
        >
          <div className="flex items-center gap-3">
             <Icon className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
             <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80">{displayValue}</span>
          </div>
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground/40 transition-transform duration-300", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-card/95 backdrop-blur-2xl border border-border/60 rounded-xl p-1.5 shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200 origin-top">
             <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {options.map((opt) => {
                  const optId = typeof opt === 'string' ? opt : opt.id;
                  const optName = typeof opt === 'string' ? opt : opt.name;
                  const optDesc = typeof opt === 'string' ? null : opt.description;
                  const isSelected = value === optId;
                  
                  return (
                    <button
                      key={optId}
                      onClick={() => {
                        onChange(optId);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex flex-col items-start px-3 py-2.5 rounded-lg transition-all mb-0.5 last:mb-0",
                        isSelected 
                          ? "bg-primary/20 text-primary" 
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[9px] font-black uppercase tracking-widest">{optName}</span>
                        {isSelected && <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      {optDesc && <span className="text-[7px] font-medium opacity-60 normal-case mt-0.5">{optDesc}</span>}
                    </button>
                  );
                })}
             </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative font-sans">
      {/* Premium Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(var(--primary-rgb),0.08),transparent_50%)] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden h-full z-10">
        
        {/* Left Sidebar - Configuration */}
        <aside className="w-[450px] border-r border-border/40 bg-card/10 backdrop-blur-3xl overflow-y-auto custom-scrollbar p-6 space-y-8 glass">
          
          {/* Global Mode Switcher */}
          <div className="space-y-4">
             <div className="flex items-center justify-between gap-2">
                <div className="flex p-1 bg-muted/40 rounded-xl border border-border/40 w-full">
                    {[
                        { id: 'image', icon: <ImageIcon className="w-3.5 h-3.5" />, label: 'Image' },
                        { id: 'video', icon: <Video className="w-3.5 h-3.5" />, label: 'Video' },
                        { id: 'audio', icon: <Headphones className="w-3.5 h-3.5" />, label: 'Audio' }
                    ].map(m => (
                        <button 
                            key={m.id}
                            onClick={() => setMode(m.id as any)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                mode === m.id ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {m.icon}
                            {m.label}
                        </button>
                    ))}
                </div>
             </div>
             
             {/* Model Selector - MODE AWARE */}
             <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 px-1">Engine Selection</h3>
                <CustomDropdown 
                    label=""
                    value={selectedModel}
                    onChange={setSelectedModel}
                    options={currentModels}
                    icon={Cpu}
                    isModelSelector
                />
             </div>
          </div>

          {/* Unified Prompting Container */}
          <div className="space-y-6">
             <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                   <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Creative Manifest</label>
                   <div className="w-40">
                      <CustomDropdown 
                          label=""
                          value={selectedSkillId ? (skills.find(s => s.id === selectedSkillId)?.title || '+ Inject Skill') : '+ Inject Skill'}
                          onChange={(skillTitle) => {
                            const skill = skills.find(s => s.title === skillTitle);
                            if (skill) {
                              setSelectedSkillId(skill.id);
                              handleSkillInjection(skill.id);
                            }
                          }}
                          options={skills.map(s => s.title)}
                          icon={Sparkles}
                          className="space-y-0"
                      />
                   </div>
                </div>
                <div className="relative group">
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={`Describe your vision for ${selectedModel || mode}...`}
                        className="w-full min-h-[120px] bg-background/40 border border-border/40 rounded-[1.5rem] p-5 focus:ring-1 focus:ring-primary/30 outline-none resize-none text-sm leading-relaxed placeholder:text-muted-foreground/20 font-medium transition-all group-hover:border-primary/20"
                    />
                </div>
             </div>

             <div className="flex items-center justify-between px-1">
                <button 
                    onClick={() => setMagicRefine(!magicRefine)}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all",
                        magicRefine ? "bg-purple-500/10 border-purple-500/40 text-purple-500 shadow-sm" : "bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Wand2 className={cn("w-3.5 h-3.5", magicRefine && "animate-pulse")} />
                    Magic Refine
                </button>
                <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-muted-foreground/40" />
                    <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">History</span>
                </div>
             </div>
          </div>

          {/* MODE-SPECIFIC CONFIGURATION */}
          <div className="space-y-8 pt-4">
             <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Quantum Calibration</h3>
                <Sliders className="w-3.5 h-3.5 text-primary/40" />
             </div>

             {/* IMAGE CONFIG */}
             {mode === 'image' && (
                <div className="grid grid-cols-2 gap-4">
                    <CustomDropdown 
                        label="Aspect Ratio"
                        value={aspectRatio}
                        onChange={setAspectRatio}
                        options={['16:9', '9:16', '1:1', '4:3', '21:9']}
                        icon={Maximize2}
                    />
                    <CustomDropdown 
                        label="Visual Style"
                        value={imageStyle}
                        onChange={setImageStyle}
                        options={['Photorealistic', 'Digital Art', 'Oil Painting', 'Abstract', 'Cinematic', 'Sketched']}
                        icon={Palette}
                    />
                    <CustomDropdown 
                        label="Quality"
                        value={quality}
                        onChange={setQuality}
                        options={['Draft', 'Standard', 'HD', 'Super+']}
                        icon={Zap}
                    />
                </div>
             )}

             {/* VIDEO CONFIG */}
             {mode === 'video' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <CustomDropdown 
                            label="Duration"
                            value={`${duration}s`}
                            onChange={(v) => setDuration(parseInt(v))}
                            options={['5s', '10s', '15s']}
                            icon={Clock}
                        />
                        <CustomDropdown 
                            label="FPS / Quality"
                            value={quality}
                            onChange={setQuality}
                            options={['Standard', 'Professional', 'Director Cut']}
                            icon={Zap}
                        />
                    </div>
                    <div className="space-y-4 bg-muted/20 rounded-2xl p-4">
                        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground/60">
                            <span className="uppercase tracking-widest">Motion Amplitude</span>
                            <span className="text-primary">{motionStrength}</span>
                        </div>
                        <input type="range" min="1" max="10" step="1" value={motionStrength} onChange={(e) => setMotionStrength(parseInt(e.target.value))} className="w-full accent-primary h-1 bg-background/40 rounded-full" />
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2">
                            {[
                                { label: 'Pan', val: pan, set: setPan, icon: <Move className="w-3 h-3" /> },
                                { label: 'Tilt', val: tilt, set: setTilt, icon: <ChevronDown className="w-3 h-3" /> },
                                { label: 'Zoom', val: zoom, set: setZoom, icon: <Maximize2 className="w-3 h-3" /> },
                                { label: 'Roll', val: roll, set: setRoll, icon: <RefreshCcw className="w-3 h-3" /> }
                            ].map(ctrl => (
                                <div key={ctrl.label} className="space-y-1.5">
                                     <div className="flex items-center justify-between text-[7px] font-black uppercase tracking-widest text-muted-foreground/40">
                                        <div className="flex items-center gap-1">{ctrl.icon}<span>{ctrl.label}</span></div>
                                        <span>{ctrl.val}</span>
                                     </div>
                                     <input type="range" min="-10" max="10" step="1" value={ctrl.val} onChange={(e) => ctrl.set(parseInt(e.target.value))} className="w-full accent-primary/60 h-0.5 bg-background/40 rounded-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
             )}

             {/* AUDIO CONFIG */}
             {mode === 'audio' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <CustomDropdown 
                            label="Acoustic Style"
                            value={audioStyle}
                            onChange={setAudioStyle}
                            options={['Cinematic', 'Lo-Fi', 'Techno', 'Rock', 'Jazz', 'Epic']}
                            icon={Music}
                        />
                        <CustomDropdown 
                            label="Voice Architecture"
                            value={voiceProfile}
                            onChange={setVoiceProfile}
                            options={['Echo-1', 'Nova-2', 'Atlas', 'Luna']}
                            icon={Mic}
                        />
                    </div>
                    <div className="space-y-4 bg-muted/20 rounded-2xl p-4">
                        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground/60">
                            <span className="uppercase tracking-widest">Tempo (BPM)</span>
                            <span className="text-primary">{bpm}</span>
                        </div>
                        <input type="range" min="40" max="220" step="1" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))} className="w-full accent-primary h-1 bg-background/40 rounded-full" />
                        
                        <div className="flex items-center justify-start gap-4 pt-2">
                           <div className="flex items-center gap-2">
                               <input type="checkbox" checked={isInstrumental} onChange={() => setIsInstrumental(!isInstrumental)} className="w-3.5 h-3.5 rounded border-border/40 bg-background/40 accent-primary" />
                               <label className="text-[8px] font-black uppercase text-muted-foreground flex items-center gap-1.5"><Headphones className="w-3 h-3" />Instrumental</label>
                           </div>
                           <div className="flex items-center gap-2">
                               <input type="checkbox" checked={audioSync} onChange={() => setAudioSync(!audioSync)} className="w-3.5 h-3.5 rounded border-border/40 bg-background/40 accent-primary" />
                               <label className="text-[8px] font-black uppercase text-muted-foreground flex items-center gap-1.5"><Layout className="w-3 h-3" />Auto-Mastering</label>
                           </div>
                        </div>
                    </div>
                </div>
             )}
          </div>

          {/* UNIVERSAL REFERENCE HUB */}
          <div className="space-y-6 pt-4 border-t border-border/40">
             <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Reference Materials</h3>
                <Layers className="w-3.5 h-3.5 text-muted-foreground/20" />
             </div>

             <div className="space-y-4">
                {/* Reference Grid */}
                <div className="grid grid-cols-4 gap-3">
                   {mode === 'image' || mode === 'video' ? (
                     <>
                        {Array.from({ length: 4 }).map((_, i) => (
                           <div key={i} className="aspect-square bg-background/40 border border-dashed border-border/40 rounded-xl relative group transition-all hover:border-primary/40">
                                {refImages[i] ? (
                                    <>
                                        <img src={URL.createObjectURL(refImages[i])} className="w-full h-full object-cover rounded-xl" alt="Ref" />
                                        <button onClick={() => setRefImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-2.5 h-2.5" /></button>
                                    </>
                                ) : (
                                    <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                                        <Plus className="w-4 h-4 text-muted-foreground/20" />
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload('image', e.target.files)} />
                                    </label>
                                )}
                           </div>
                        ))}
                     </>
                   ) : (
                     <div className="col-span-4 aspect-video bg-background/40 border border-dashed border-border/40 rounded-2xl relative group transition-all hover:border-primary/40">
                         {refAudio ? (
                            <div className="flex flex-col items-center justify-center h-full p-4">
                                <Waves className="w-8 h-8 text-primary animate-pulse mb-2" />
                                <span className="text-[8px] font-bold text-primary truncate max-w-full px-4">{refAudio.name}</span>
                                <button onClick={() => setRefAudio(null)} className="mt-2 text-[8px] font-black uppercase text-red-500/60 hover:text-red-500">Remove</button>
                            </div>
                         ) : (
                            <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                                <Volume2 className="w-6 h-6 text-muted-foreground/20 mb-2" />
                                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">Upload Audio Reference</span>
                                <input type="file" className="hidden" accept="audio/*" onChange={(e) => handleFileUpload('audio', e.target.files)} />
                            </label>
                         )}
                     </div>
                   )}
                </div>
             </div>
          </div>

          {/* Action Hub */}
          <div className="pt-6">
             <button onClick={handleGenerate} disabled={isLoading} className={cn("w-full py-5 rounded-[2.5rem] flex items-center justify-center gap-4 transition-all font-black uppercase tracking-[0.3em] text-[11px] group relative overflow-hidden", isLoading ? "bg-muted cursor-not-allowed text-muted-foreground" : "bg-primary text-primary-foreground shadow-[0_20px_50px_rgba(var(--primary-rgb),0.3)] hover:scale-[1.01] active:scale-[0.99]")}>
                {isLoading ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer-fast" />
                    < Zap className="w-5 h-5 animate-spin" />
                    <span>SYNTHESIZING...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 group-hover:scale-125 transition-transform duration-500" />
                    <span>Initiate Neural Generation</span>
                  </>
                )}
             </button>
          </div>

        </aside>

        {/* Right Area - MODULAR CANVAS */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-black/10 relative">
            <div className="max-w-6xl mx-auto space-y-12 h-fit mb-20 text-foreground">
              
              {/* Specialized Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                 <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-[3px] h-10 bg-primary/40 rounded-full" />
                        <div>
                           <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary mb-1">Modular Hub • {selectedModel}</h2>
                           <h1 className="text-5xl font-black tracking-tighter uppercase leading-none italic">
                              {mode === 'image' && "Still Horizon"}
                              {mode === 'video' && "Continuum Flow"}
                              {mode === 'audio' && "Sound Architecture"}
                           </h1>
                        </div>
                    </div>
                    <p className="max-w-2xl text-muted-foreground/60 text-lg font-medium leading-relaxed">
                        {mode === 'image' && "Generate hyper-definition visuals with full artistic control over lighting, texture, and composition."}
                        {mode === 'video' && "Construct cinematic motion sequences with temporal consistency and advanced physics simulation."}
                        {mode === 'audio' && "Orchestrate high-fidelity acoustic masterworks, from ambient scores to professional narration."}
                    </p>
                 </div>
                 
                 <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2.5 px-6 py-3.5 bg-card/40 border border-border/40 hover:bg-muted/40 rounded-2xl text-[10px] font-black uppercase tracking-widest glass">
                        <History className="w-4 h-4 text-primary/60" />History
                    </button>
                    <button className="flex items-center gap-2.5 px-6 py-3.5 bg-primary/10 border border-primary/20 hover:bg-primary/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-primary glass">
                        <Activity className="w-4 h-4" />Live Synthesis
                    </button>
                 </div>
              </div>

              {/* DYNAMIC CANVAS AREA */}
              <div className="space-y-10">
                 
                 {/* 1. Preview Area */}
                 <div className="group relative">
                    <div className="absolute -inset-1.5 bg-gradient-to-br from-primary/20 via-purple-500/20 to-primary/20 rounded-[3rem] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                    <div className={cn(
                        "relative aspect-video bg-zinc-950 border border-border/40 rounded-[2.8rem] shadow-2xl overflow-hidden flex flex-col items-center justify-center transition-all duration-700 glass",
                        mode === 'image' && "aspect-[4/3] md:aspect-video",
                        mode === 'audio' && "aspect-video bg-[radial-gradient(circle_at_50%_120%,rgba(var(--primary-rgb),0.1),transparent)]"
                    )}>
                        {isLoading ? (
                            <div className="flex flex-col items-center gap-10 animate-in fade-in zoom-in-95 duration-1000">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary/40 blur-3xl rounded-full animate-pulse scale-150" />
                                    <div className="relative w-28 h-28 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center">
                                        <Zap className="w-10 h-10 text-primary animate-bounce fill-primary" />
                                    </div>
                                </div>
                                <h3 className="text-2xl font-black uppercase tracking-[0.4em] text-white">Synthesizing...</h3>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-8 text-muted-foreground/20">
                                {mode === 'audio' ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-12">
                                        <div className="flex items-center gap-3 h-32 w-full max-w-2xl px-12">
                                            {[1, 2, 4, 3, 6, 8, 10, 7, 5, 3, 2, 4, 6, 9, 7, 4, 2, 1].map((h, i) => (
                                                <div key={i} className="flex-1 rounded-full bg-primary/10 transition-all duration-500 group-hover:bg-primary/20" style={{ height: `${h * 10}%` }} />
                                            ))}
                                        </div>
                                        <div className="text-center space-y-4">
                                            <div className="w-16 h-16 bg-muted/20 border border-border/40 rounded-[1.5rem] flex items-center justify-center mx-auto">
                                                 <Music className="w-8 h-8 opacity-20" />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.6em] opacity-40">Acoustic Manifest Awaiting</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-32 h-32 border-2 border-dashed border-border/40 rounded-[2.5rem] flex items-center justify-center group-hover:scale-110 transition-all">
                                            {mode === 'video' ? <Film className="w-12 h-12" /> : <ImageIcon className="w-12 h-12" />}
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.6em] opacity-40">Input Manifest Awaiting</p>
                                    </>
                                )}
                            </div>
                        )}

                        {/* HUD OVERLAY - MODE AWARE */}
                        <div className="absolute top-8 left-8 flex flex-col gap-3">
                            <div className="px-3 py-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg text-[8px] font-black uppercase tracking-widest text-primary">Model: {selectedModel}</div>
                            {mode === 'video' && <div className="px-3 py-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg text-[8px] font-black uppercase tracking-widest text-white/60">Calib: {pan}P / {tilt}T / {zoom}Z</div>}
                            {mode === 'audio' && <div className="px-3 py-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg text-[8px] font-black uppercase tracking-widest text-white/60">BPM: {bpm} • Mono/Stereo</div>}
                        </div>
                    </div>

                    <div className="absolute bottom-[-24px] left-1/2 -translate-x-1/2 flex items-center gap-8 px-10 py-5 bg-card/80 backdrop-blur-2xl border border-border/40 rounded-[2rem] shadow-2xl glass transition-all duration-500 group-hover:translate-y-[-10px]">
                        <button className="text-muted-foreground/40 hover:text-primary transition-colors cursor-pointer"><FastForward className="w-5 h-5 -scale-x-100" /></button>
                        <button className="w-12 h-12 bg-primary border border-primary-foreground/20 rounded-full flex items-center justify-center text-primary-foreground hover:scale-110 active:scale-95 transition-all shadow-[0_10px_30px_rgba(var(--primary-rgb),0.3)]">
                           <Play className="w-5 h-5 ml-1" fill="currentColor" />
                        </button>
                        <button className="text-muted-foreground/40 hover:text-primary transition-colors cursor-pointer"><FastForward className="w-5 h-5" /></button>
                    </div>
                 </div>

                 {/* 2. Specialized Timeline / Waveform / Gallery */}
                 <div className="pt-10 space-y-4">
                    {mode === 'video' && (
                        <div className="space-y-4 bg-muted/10 border border-border/40 rounded-[2.5rem] p-8 glass">
                           <div className="flex items-center justify-between px-2">
                               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Sequence Storyboard</h3>
                               <div className="flex gap-2">
                                   <div className="px-2 py-1 bg-primary/10 rounded text-[8px] font-black text-primary">00:00:15</div>
                                   <div className="px-2 py-1 bg-muted/40 rounded text-[8px] font-black text-muted-foreground/60">30 FPS</div>
                               </div>
                           </div>
                           <div className="grid grid-cols-6 gap-4 h-32">
                                 {[...Array(6)].map((_, i) => (
                                     <div key={i} className="relative overflow-hidden group transition-all" style={{ opacity: i < 4 ? 1 : 0.4 }}>
                                         <MediaPreview 
                                           url="" 
                                           type="video" 
                                           title={`Sequence ${i+1}`} 
                                           className="w-full h-full"
                                         />
                                     </div>
                                 ))}
                           </div>
                        </div>
                    )}

                    {mode === 'audio' && (
                        <div className="space-y-4 bg-muted/10 border border-border/40 rounded-[2.5rem] p-8 glass">
                           <div className="flex items-center justify-between px-2">
                               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Acoustic Timeline</h3>
                               <div className="flex items-center gap-6">
                                   <div className="flex -space-x-2">
                                       {Array.from({length: 4}).map((_, i) => <div key={i} className="w-6 h-6 rounded-full border-2 border-background bg-muted-foreground/20" />)}
                                   </div>
                                   <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">Mastering Active</span>
                               </div>
                           </div>
                           <div className="h-24 bg-background/40 border border-border/40 rounded-2xl p-4 flex flex-col justify-center gap-4 relative overflow-hidden group">
                                <div className="absolute left-[30%] top-0 bottom-0 w-[1px] bg-primary/40 z-10" />
                                <div className="flex items-center gap-1 h-8 opacity-40">
                                    {Array.from({length: 80}).map((_, i) => <div key={i} className="flex-1 bg-border/40 rounded-full" style={{ height: `${Math.random() * 100}%` }} />)}
                                </div>
                                <div className="flex items-center gap-1 h-4 opacity-20">
                                    {Array.from({length: 80}).map((_, i) => <div key={i} className="flex-1 bg-primary/40 rounded-full" style={{ height: `${Math.random() * 100}%` }} />)}
                                </div>
                           </div>
                        </div>
                    )}

                    {mode === 'image' && (
                        <div className="space-y-4 bg-muted/10 border border-border/40 rounded-[2.5rem] p-8 glass">
                           <div className="flex items-center justify-between px-2">
                               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Variation Manifest</h3>
                               <div className="flex gap-2 text-[8px] font-black uppercase text-muted-foreground/40 tracking-widest">
                                   <span>Resolution: 1024 x 1024</span>
                                   <span>•</span>
                                   <span>HD Rendering</span>
                               </div>
                           </div>
                           <div className="grid grid-cols-4 gap-6 h-32">
                                 {[1, 2, 3, 4].map((i) => (
                                     <div key={i} className="relative group transition-all">
                                         <MediaPreview 
                                           url="" 
                                           type="image" 
                                           title={`Variation ${i}`} 
                                           className="w-full h-full"
                                         />
                                     </div>
                                 ))}
                           </div>
                        </div>
                    )}
                 </div>

              </div>

              {/* Mode Specific Feature Cards - RE-ENGINEERED */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
                 {mode === 'image' && (
                    <>
                        <div className="p-8 rounded-[2.8rem] border border-border/40 space-y-5 glass glass-hover relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Palette className="w-20 h-20" /></div>
                           <ImageIcon className="w-10 h-10 text-primary/60" />
                           <h3 className="text-sm font-black uppercase tracking-[0.2em]">Neural Textures</h3>
                           <p className="text-xs text-muted-foreground/60 leading-relaxed">Advanced latent diffusion for hyper-precise skin, fabric, and atmospheric rendering.</p>
                        </div>
                        <div className="p-8 rounded-[2.8rem] border border-border/40 space-y-5 glass glass-hover relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Layers className="w-20 h-20" /></div>
                           <Sparkles className="w-10 h-10 text-primary/60" />
                           <h3 className="text-sm font-black uppercase tracking-[0.2em]">Global Illumination</h3>
                           <p className="text-xs text-muted-foreground/60 leading-relaxed">Realistic light transport and ray-traced shadows for stunning visual fidelity.</p>
                        </div>
                        <div className="p-8 rounded-[2.8rem] border border-border/40 space-y-5 glass glass-hover relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Cpu className="w-20 h-20" /></div>
                           <Maximize2 className="w-10 h-10 text-primary/60" />
                           <h3 className="text-sm font-black uppercase tracking-[0.2em]">Style Manifest</h3>
                           <p className="text-xs text-muted-foreground/60 leading-relaxed">Direct model-level style injection from professional artistic engines.</p>
                        </div>
                    </>
                 )}
                 {mode === 'video' && (
                    <>
                        <div className="p-8 rounded-[2.8rem] border border-border/40 space-y-5 glass glass-hover relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Timer className="w-20 h-20" /></div>
                           <Film className="w-10 h-10 text-primary/60" />
                           <h3 className="text-sm font-black uppercase tracking-[0.2em]">Temporal Logic</h3>
                           <p className="text-xs text-muted-foreground/60 leading-relaxed">Physically accurate motion vectors and temporal coherence between keyframes.</p>
                        </div>
                        <div className="p-8 rounded-[2.8rem] border border-border/40 space-y-5 glass glass-hover relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Camera className="w-20 h-20" /></div>
                           <Move className="w-10 h-10 text-primary/60" />
                           <h3 className="text-sm font-black uppercase tracking-[0.2em]">Spatial Flow</h3>
                           <p className="text-xs text-muted-foreground/60 leading-relaxed">Infinite 3D camera control allowing for professional Hollywood pan-and-tilt shots.</p>
                        </div>
                        <div className="p-8 rounded-[2.8rem] border border-border/40 space-y-5 glass glass-hover relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Activity className="w-20 h-20" /></div>
                           <Cpu className="w-10 h-10 text-primary/60" />
                           <h3 className="text-sm font-black uppercase tracking-[0.2em]">Physics Engine</h3>
                           <p className="text-xs text-muted-foreground/60 leading-relaxed">Simulated world physics for fluid, gravity, and object collision synthesis.</p>
                        </div>
                    </>
                 )}
                 {mode === 'audio' && (
                    <>
                        <div className="p-8 rounded-[2.8rem] border border-border/40 space-y-5 glass glass-hover relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Waves className="w-20 h-20" /></div>
                           <Music className="w-10 h-10 text-primary/60" />
                           <h3 className="text-sm font-black uppercase tracking-[0.2em]">Harmonic Scale</h3>
                           <p className="text-xs text-muted-foreground/60 leading-relaxed">Neural multi-track orchestration for complex instrumental arrangements.</p>
                        </div>
                        <div className="p-8 rounded-[2.8rem] border border-border/40 space-y-5 glass glass-hover relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Headphones className="w-20 h-20" /></div>
                           <Activity className="w-10 h-10 text-primary/60" />
                           <h3 className="text-sm font-black uppercase tracking-[0.2em]">Acoustic DNA</h3>
                           <p className="text-xs text-muted-foreground/60 leading-relaxed">High-fidelity voice cloning and emotional tone mapping for narration.</p>
                        </div>
                        <div className="p-8 rounded-[2.8rem] border border-border/40 space-y-5 glass glass-hover relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Layout className="w-20 h-20" /></div>
                           <Cpu className="w-10 h-10 text-primary/60" />
                           <h3 className="text-sm font-black uppercase tracking-[0.2em]">Neural Mastering</h3>
                           <p className="text-xs text-muted-foreground/60 leading-relaxed">Automated volume normalization, EQ, and spatial audio mastering.</p>
                        </div>
                    </>
                 )}
              </div>

            </div>
        </main>

      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--primary-rgb), 0.1); border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(var(--primary-rgb), 0.3); }
        .glass { background: rgba(var(--card), 0.05); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
        @keyframes shimmer-fast { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-shimmer-fast { animation: shimmer-fast 1.5s infinite; }
      `}</style>
    </div>
  );
}
