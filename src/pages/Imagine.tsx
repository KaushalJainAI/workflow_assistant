import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bot,
  Check,
  Clock3,
  Film,
  Headphones,
  Image as ImageIcon,
  Layers3,
  Mic,
  Music4,
  Palette,
  Play,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Video,
  Wand2,
  Waves,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../api/client';
import PageHeader from '../components/layout/PageHeader';
import Select from '../components/ui/Select';
import { cn } from '../lib/utils';

type Mode = 'image' | 'video' | 'audio';

interface Skill {
  id: string;
  title: string;
  content: string;
}

interface ModelOption {
  id: string;
  name: string;
  description: string;
  accent: string;
  icon: LucideIcon;
}

interface ModeConfig {
  title: string;
  subtitle: string;
  promptLabel: string;
  promptPlaceholder: string;
  previewLabel: string;
  timelineLabel: string;
  referencesLabel: string;
  heroMetric: string;
  accentClass: string;
  icon: LucideIcon;
}

const modeConfigs: Record<Mode, ModeConfig> = {
  image: {
    title: 'Image Editing Studio',
    subtitle: 'Retouch, restyle, composite, and generate stills with production-grade controls.',
    promptLabel: 'Edit Brief',
    promptPlaceholder: 'Describe the visual change: lighting, composition, cleanup, upscale, style transfer, or object edits.',
    previewLabel: 'Canvas Preview',
    timelineLabel: 'Variation Board',
    referencesLabel: 'Reference Images',
    heroMetric: '4 variants ready',
    accentClass: 'from-orange-500/20 via-amber-500/10 to-transparent',
    icon: ImageIcon,
  },
  video: {
    title: 'Video Editing Suite',
    subtitle: 'Shape motion, timing, framing, and scene continuity for short-form video generation and edits.',
    promptLabel: 'Scene Direction',
    promptPlaceholder: 'Describe the shot, motion changes, transitions, pacing, camera moves, or clip cleanup you want.',
    previewLabel: 'Stage Monitor',
    timelineLabel: 'Storyboard Timeline',
    referencesLabel: 'Scene Assets',
    heroMetric: '12s sequence mapped',
    accentClass: 'from-sky-500/20 via-cyan-500/10 to-transparent',
    icon: Video,
  },
  audio: {
    title: 'Audio Editing Lab',
    subtitle: 'Build narration, music beds, stems, and mastered mixes with mode-aware controls.',
    promptLabel: 'Audio Direction',
    promptPlaceholder: 'Describe the voice, arrangement, mood, instrumentation, mastering, or restoration change you need.',
    previewLabel: 'Wave Monitor',
    timelineLabel: 'Track Arrangement',
    referencesLabel: 'Reference Audio',
    heroMetric: 'Stereo mix prepared',
    accentClass: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    icon: Headphones,
  },
};

const modelsByMode: Record<Mode, ModelOption[]> = {
  image: [
    { id: 'dalle-3', name: 'DALL-E 3', description: 'Reliable prompt fidelity for commercial comps.', accent: 'bg-orange-500/10 text-orange-500', icon: Sparkles },
    { id: 'midjourney', name: 'Midjourney v6', description: 'Strong artistic styling and editorial looks.', accent: 'bg-fuchsia-500/10 text-fuchsia-500', icon: Palette },
    { id: 'sdxl', name: 'Stable Diffusion XL', description: 'Flexible open workflow for fast iteration.', accent: 'bg-blue-500/10 text-blue-500', icon: Zap },
  ],
  video: [
    { id: 'runway-gen3', name: 'Runway Gen-3', description: 'Polished cinematic motion and realism.', accent: 'bg-sky-500/10 text-sky-500', icon: Film },
    { id: 'luma-dream', name: 'Luma Dream Machine', description: 'Good for spatially coherent clips.', accent: 'bg-cyan-500/10 text-cyan-500', icon: Video },
    { id: 'kling-ai', name: 'Kling AI', description: 'Longer beats and story progression.', accent: 'bg-indigo-500/10 text-indigo-500', icon: Activity },
  ],
  audio: [
    { id: 'suno-v3', name: 'Suno v3.5', description: 'Song concepts and stylized structure.', accent: 'bg-emerald-500/10 text-emerald-500', icon: Music4 },
    { id: 'udio', name: 'Udio', description: 'Detailed musical texture and layering.', accent: 'bg-teal-500/10 text-teal-500', icon: Waves },
    { id: 'elevenlabs', name: 'ElevenLabs', description: 'Strong speech synthesis and narration.', accent: 'bg-lime-500/10 text-lime-500', icon: Mic },
  ],
};

const imageAspectOptions = ['1:1', '4:5', '3:2', '16:9', '9:16'];
const imageStyleOptions = ['Photoreal', 'Editorial', 'Product', 'Illustration', 'Cinematic'];
const videoDurationOptions = ['6 sec', '12 sec', '20 sec'];
const videoMotionOptions = ['Subtle', 'Balanced', 'Dynamic', 'Aggressive'];
const audioFormatOptions = ['Voiceover', 'Song', 'Ambient', 'Podcast', 'Sound Design'];
const audioVoiceOptions = ['Echo-1', 'Nova', 'Alloy', 'Onyx'];
const qualityOptions = ['Draft', 'Studio', 'Production'];

const waveformHeights = [28, 52, 34, 68, 44, 78, 56, 38, 64, 46, 82, 32, 58, 40, 72, 36, 49, 66, 41, 74, 54, 35, 62, 48];
const storyboardFrames = ['Hook', 'Reveal', 'Motion', 'Detail', 'Climax', 'Outro'];
const audioTracks = ['Lead Vox', 'Harmony', 'Bass', 'Atmos', 'FX'];
const imageVariations = ['Base', 'Lighting', 'Texture', 'Delivery'];

function formatFileSize(file: File) {
  if (file.size < 1024 * 1024) {
    return `${Math.max(1, Math.round(file.size / 1024))} KB`;
  }
  return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
}

function Panel({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-[28px] border border-border/60 bg-card/75 p-5 shadow-sm backdrop-blur-xl', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          </div>
          {description && <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export default function Imagine() {
  const [mode, setMode] = useState<Mode>('image');
  const [selectedModel, setSelectedModel] = useState(modelsByMode.image[0].id);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [prompt, setPrompt] = useState('');
  const [magicRefine, setMagicRefine] = useState(true);
  const [quality, setQuality] = useState('Studio');
  const [isLoading, setIsLoading] = useState(false);

  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [imageStyle, setImageStyle] = useState('Photoreal');
  const [duration, setDuration] = useState('12 sec');
  const [motionProfile, setMotionProfile] = useState('Balanced');
  const [cameraMovement, setCameraMovement] = useState(56);
  const [audioFormat, setAudioFormat] = useState('Voiceover');
  const [voiceProfile, setVoiceProfile] = useState('Echo-1');
  const [mixEnergy, setMixEnergy] = useState(48);

  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [referenceAudio, setReferenceAudio] = useState<File[]>([]);
  const [referenceVideo, setReferenceVideo] = useState<File[]>([]);

  const config = modeConfigs[mode];
  const currentModels = modelsByMode[mode];
  const selectedModelData = currentModels.find((model) => model.id === selectedModel) ?? currentModels[0];

  useEffect(() => {
    setSelectedModel(modelsByMode[mode][0].id);
    setSelectedSkillId('');
  }, [mode]);

  useEffect(() => {
    let active = true;

    const fetchSkills = async () => {
      try {
        const response = await apiClient.get('/skills/search/', { params: { tab: 'mine' } });
        if (active) {
          setSkills(response.data.results || []);
        }
      } catch (error) {
        console.error('Failed to fetch skills:', error);
      }
    };

    fetchSkills();

    return () => {
      active = false;
    };
  }, []);

  const selectedReferences = useMemo(() => {
    if (mode === 'image') return referenceImages;
    if (mode === 'video') return referenceVideo;
    return referenceAudio;
  }, [mode, referenceAudio, referenceImages, referenceVideo]);

  const skillOptions = useMemo(
    () => skills.map((skill) => ({ value: skill.id, label: skill.title })),
    [skills]
  );

  const handleSkillSelect = (skillId: string) => {
    setSelectedSkillId(skillId);
    const skill = skills.find((item) => item.id === skillId);
    if (!skill) return;

    setPrompt((prev) => `${prev}\n${skill.content}`.trim());
    toast.success(`Added "${skill.title}" to the brief`);
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error('Add a prompt before starting the edit.');
      return;
    }

    setIsLoading(true);
    toast.info(`Preparing ${mode} edit with ${selectedModelData.name}`);

    window.setTimeout(() => {
      setIsLoading(false);
      toast.success(`${config.title} is ready for preview.`);
    }, 2200);
  };

  const handleReferenceUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming: File[] = Array.from(event.target.files ?? []);
    if (incoming.length === 0) return;

    if (mode === 'image') {
      setReferenceImages((prev) => [...prev, ...incoming].slice(0, 6));
    } else if (mode === 'video') {
      setReferenceVideo((prev) => [...prev, ...incoming].slice(0, 4));
    } else {
      setReferenceAudio((prev) => [...prev, ...incoming].slice(0, 5));
    }

    event.target.value = '';
  };

  const removeReference = (fileName: string) => {
    if (mode === 'image') {
      setReferenceImages((prev) => prev.filter((file) => file.name !== fileName));
    } else if (mode === 'video') {
      setReferenceVideo((prev) => prev.filter((file) => file.name !== fileName));
    } else {
      setReferenceAudio((prev) => prev.filter((file) => file.name !== fileName));
    }
  };

  const renderModeControls = () => {
    if (mode === 'image') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Aspect ratio</label>
            <Select
              value={aspectRatio}
              onChange={setAspectRatio}
              options={imageAspectOptions.map((option) => ({ label: option, value: option }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Style direction</label>
            <Select
              value={imageStyle}
              onChange={setImageStyle}
              options={imageStyleOptions.map((option) => ({ label: option, value: option }))}
            />
          </div>
        </div>
      );
    }

    if (mode === 'video') {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Sequence length</label>
              <Select
                value={duration}
                onChange={setDuration}
                options={videoDurationOptions.map((option) => ({ label: option, value: option }))}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Motion profile</label>
              <Select
                value={motionProfile}
                onChange={setMotionProfile}
                options={videoMotionOptions.map((option) => ({ label: option, value: option }))}
              />
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Camera movement</span>
              <span>{cameraMovement}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={cameraMovement}
              onChange={(event) => setCameraMovement(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Output type</label>
            <Select
              value={audioFormat}
              onChange={setAudioFormat}
              options={audioFormatOptions.map((option) => ({ label: option, value: option }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Voice profile</label>
            <Select
              value={voiceProfile}
              onChange={setVoiceProfile}
              options={audioVoiceOptions.map((option) => ({ label: option, value: option }))}
            />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Mix energy</span>
            <span>{mixEnergy}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={mixEnergy}
            onChange={(event) => setMixEnergy(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
        </div>
      </div>
    );
  };

  const renderPreview = () => {
    if (mode === 'audio') {
      return (
        <div className="relative flex h-full min-h-[360px] flex-col justify-between rounded-[30px] border border-white/10 bg-zinc-950 p-6 text-white">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/60">
            <span>{config.previewLabel}</span>
            <span>{selectedModelData.name}</span>
          </div>
          <div className="flex flex-1 items-center gap-2 py-8">
            {waveformHeights.map((height, index) => (
              <div
                key={`${height}-${index}`}
                className="flex-1 rounded-full bg-gradient-to-t from-emerald-500/40 via-cyan-400/70 to-white/90"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard label="Format" value={audioFormat} />
            <StatCard label="Voice" value={voiceProfile} />
            <StatCard label="Energy" value={`${mixEnergy}%`} />
          </div>
        </div>
      );
    }

    if (mode === 'video') {
      return (
        <div className="relative min-h-[360px] overflow-hidden rounded-[30px] border border-white/10 bg-zinc-950 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_40%),linear-gradient(135deg,rgba(2,6,23,0.9),rgba(15,23,42,0.94))]" />
          <div className="relative flex h-full flex-col justify-between p-6">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/65">
              <span>{config.previewLabel}</span>
              <span>{duration}</span>
            </div>
            <div className="space-y-6">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur">
                <Play className="ml-1 h-8 w-8 fill-white text-white" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <StatCard label="Motion" value={motionProfile} />
                <StatCard label="Camera" value={`${cameraMovement}%`} />
                <StatCard label="Quality" value={quality} />
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="relative min-h-[360px] overflow-hidden rounded-[30px] border border-white/10 bg-zinc-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.28),transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.96),rgba(9,9,11,0.92))]" />
        <div className="relative flex h-full flex-col justify-between p-6">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/65">
            <span>{config.previewLabel}</span>
            <span>{aspectRatio}</span>
          </div>
          <div className="mx-auto flex w-full max-w-[440px] flex-1 items-center justify-center py-8">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-br from-orange-300/30 via-rose-300/10 to-zinc-900">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.32),transparent_22%),radial-gradient(circle_at_70%_70%,rgba(251,191,36,0.18),transparent_26%)]" />
              <div className="absolute left-6 top-6 rounded-full bg-black/45 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/80">
                {imageStyle}
              </div>
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-black/35 p-4 backdrop-blur">
                <p className="text-sm font-medium text-white/85">Editable still composition with room for crop, cleanup, relight, and upscale passes.</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard label="Style" value={imageStyle} />
            <StatCard label="Aspect" value={aspectRatio} />
            <StatCard label="Quality" value={quality} />
          </div>
        </div>
      </div>
    );
  };

  const renderTimeline = () => {
    if (mode === 'video') {
      return (
        <div className="grid gap-3 md:grid-cols-6">
          {storyboardFrames.map((frame, index) => (
            <div key={frame} className="rounded-2xl border border-border/60 bg-background/70 p-3">
              <div className="mb-3 aspect-video rounded-xl bg-gradient-to-br from-sky-500/20 via-slate-900 to-slate-950" />
              <p className="text-xs font-semibold">{frame}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{index * 2}s - {index * 2 + 2}s</p>
            </div>
          ))}
        </div>
      );
    }

    if (mode === 'audio') {
      return (
        <div className="space-y-3">
          {audioTracks.map((track, index) => (
            <div key={track} className="grid grid-cols-[110px_1fr] items-center gap-3">
              <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-3 text-xs font-semibold">{track}</div>
              <div className="flex h-12 items-center gap-1 rounded-2xl border border-border/60 bg-background/70 px-3">
                {waveformHeights.slice(index * 4, index * 4 + 12).map((height, waveformIndex) => (
                  <div
                    key={`${track}-${waveformIndex}`}
                    className="flex-1 rounded-full bg-primary/55"
                    style={{ height: `${Math.max(18, height - index * 4)}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid gap-3 md:grid-cols-4">
        {imageVariations.map((variation) => (
          <div key={variation} className="rounded-2xl border border-border/60 bg-background/70 p-3">
            <div className="mb-3 aspect-square rounded-[20px] bg-gradient-to-br from-orange-500/20 via-rose-500/10 to-transparent" />
            <p className="text-xs font-semibold">{variation}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Version ready for compare view</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="relative h-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className={cn('absolute inset-x-0 top-0 h-[320px] bg-gradient-to-b', config.accentClass)} />
        <div className="absolute left-[-120px] top-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[-80px] top-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative flex h-full flex-col overflow-hidden">
        <PageHeader
          title="Imagine"
          subtitle="A polished workspace for image, video, and audio editing flows."
          icon={Sparkles}
          actions={(
            <button
              type="button"
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:scale-[1.01]"
            >
              <Wand2 className="h-4 w-4" />
              {isLoading ? 'Rendering...' : 'Run Edit'}
            </button>
          )}
        >
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Mode" value={config.title.split(' ')[0]} />
            <StatCard label="Engine" value={selectedModelData.name} />
            <StatCard label="Session" value={config.heroMetric} />
            <StatCard label="Quality" value={quality} />
          </div>
        </PageHeader>

        <div className="flex-1 overflow-auto p-4 lg:p-8">
          <div className="mx-auto max-w-[1600px]">
            <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
              {/* Unified Controls Sidebar */}
              <div className="flex flex-col gap-6">
                <Panel
                  title="Studio Controls"
                  description="Configure your workspace engine and medium settings."
                  icon={SlidersHorizontal}
                  className="sticky top-0"
                >
                  <div className="space-y-6">
                    {/* Mode Selector - Premium Tabs */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Workspace Mode</label>
                      <div className="flex rounded-2xl bg-background/50 p-1 border border-border/40">
                        <button
                          onClick={() => setMode('image')}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all",
                            mode === 'image' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          Image
                        </button>
                        <button
                          onClick={() => setMode('video')}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all",
                            mode === 'video' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          <Video className="h-3.5 w-3.5" />
                          Video
                        </button>
                        <button
                          onClick={() => setMode('audio')}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all",
                            mode === 'audio' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          <Headphones className="h-3.5 w-3.5" />
                          Audio
                        </button>
                      </div>
                    </div>

                    <div className="h-px bg-border/40" />

                    {/* Model & Quality */}
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-xs font-semibold text-foreground/70">Creative Engine</label>
                        <Select
                          value={selectedModel}
                          onChange={setSelectedModel}
                          options={currentModels.map((model) => ({
                            value: model.id,
                            label: model.name,
                            icon: <model.icon className="h-4 w-4" />,
                          }))}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold text-foreground/70">Rendering Quality</label>
                        <Select
                          value={quality}
                          onChange={setQuality}
                          options={qualityOptions.map((option) => ({ label: option, value: option }))}
                        />
                      </div>

                      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-center gap-2">
                          <Zap className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">{selectedModelData.name}</span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground/90 font-medium">{selectedModelData.description}</p>
                      </div>
                    </div>

                    <div className="h-px bg-border/40" />

                    {/* Dynamic Controls */}
                    <div className="space-y-4">
                      <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Medium Constraints</label>
                      {renderModeControls()}
                    </div>
                  </div>
                </Panel>

                <Panel
                  title="References"
                  description="Guide the AI with visual or audio anchors."
                  icon={Upload}
                >
                  <label className="group flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-border bg-background/40 px-4 py-8 text-center transition hover:border-primary/50 hover:bg-primary/5">
                    <div className="rounded-2xl bg-background p-3 text-primary shadow-sm border border-border group-hover:scale-110 transition-transform">
                      <Plus className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm font-bold tracking-tight">{config.referencesLabel}</p>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">JPG, PNG, MP4, or MP3</p>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept={mode === 'image' ? 'image/*' : mode === 'video' ? 'video/*' : 'audio/*'}
                      onChange={handleReferenceUpload}
                    />
                  </label>

                  <div className="mt-4 space-y-2">
                    {selectedReferences.map((file) => (
                      <div key={file.name} className="flex items-center justify-between rounded-xl border border-border/40 bg-background/50 px-3 py-2.5">
                        <div className="min-w-0 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            {mode === 'image' && <ImageIcon className="h-4 w-4" />}
                            {mode === 'video' && <Video className="h-4 w-4" />}
                            {mode === 'audio' && <Headphones className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="truncate text-xs font-bold">{file.name}</p>
                            <p className="text-[10px] text-muted-foreground font-medium">{formatFileSize(file)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeReference(file.name)}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Plus className="h-4 w-4 rotate-45" />
                        </button>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              {/* Main Canvas Area */}
              <div className="space-y-8">
                {/* Preview Section */}
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-sky-500/10 to-primary/20 rounded-[40px] blur-2xl opacity-50 group-hover:opacity-75 transition duration-1000" />
                  <section className="relative overflow-hidden rounded-[40px] border border-border/60 bg-card/80 shadow-2xl backdrop-blur-3xl">
                    <div className="p-6 flex items-center justify-between border-b border-border/40">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold tracking-tight">{config.previewLabel}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{selectedModelData.name} • {quality}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                          <Check className="h-3 w-3 text-emerald-500" />
                          Ready
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                          <Clock3 className="h-3 w-3" />
                          Sync On
                        </div>
                      </div>
                    </div>

                    <div className="p-8">
                      {renderPreview()}
                    </div>
                  </section>
                </div>

                {/* Creative Direction & Briefing */}
                <Panel
                  title="Creative Brief"
                  description="Instruct the AI on the stylistic and technical requirements."
                  icon={Bot}
                  className="bg-primary/[0.02] border-primary/10"
                >
                  <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
                    <div className="relative">
                      <textarea
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        placeholder={config.promptPlaceholder}
                        className="min-h-[200px] w-full rounded-[32px] border border-border/60 bg-background/60 p-6 text-base font-medium leading-relaxed outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/40"
                      />
                      <div className="absolute bottom-4 right-4 flex gap-2">
                        <button className="p-2 rounded-xl bg-background border border-border hover:border-primary transition-colors text-muted-foreground hover:text-primary">
                          <Sparkles className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Expert Skill</label>
                        <Select
                          value={selectedSkillId}
                          onChange={handleSkillSelect}
                          options={skillOptions}
                          placeholder="Select an anchor skill"
                        />
                      </div>

                      <div className="h-px bg-border/40" />

                      <button
                        type="button"
                        onClick={() => setMagicRefine((prev) => !prev)}
                        className={cn(
                          'flex w-full flex-col gap-3 rounded-[28px] border p-4 text-left transition-all duration-300',
                          magicRefine
                            ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border/60 bg-background/40 grayscale opacity-70'
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold tracking-tight">Magic Refine</span>
                          <div className={cn(
                            'h-2 w-2 rounded-full',
                            magicRefine ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)]' : 'bg-muted'
                          )} />
                        </div>
                        <p className="text-[11px] leading-relaxed font-medium text-muted-foreground">
                          Auto-restructures prompt for cleaner tokens and sharper output.
                        </p>
                      </button>
                    </div>
                  </div>
                </Panel>

                {/* Media Review Area */}
                <Panel
                  title={config.timelineLabel}
                  description="Review generated variations or sequence storyboards."
                  icon={Layers3}
                >
                  <div className="rounded-[32px] border border-border/40 bg-background/40 p-2">
                    {renderTimeline()}
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
