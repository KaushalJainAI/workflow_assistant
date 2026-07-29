import { X, Download, Share2, Trash2 } from 'lucide-react';

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  result: {
    url: string;
    prompt: string;
    type: 'image' | 'video' | 'audio';
    timestamp: Date;
  } | null;
}

export function Lightbox({ isOpen, onClose, result }: LightboxProps) {
  if (!isOpen || !result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-background/95 backdrop-blur-xl animate-in fade-in duration-300">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-muted/50 hover:bg-muted text-foreground transition-colors z-[60]"
      >
        <X size={24} />
      </button>

      <div className="relative flex flex-col md:flex-row w-full max-w-6xl max-h-[90vh] bg-card border border-border/50 rounded-lg overflow-hidden shadow-2xl">
        {/* Media Container */}
        <div className="flex-1 bg-black/5 flex items-center justify-center overflow-hidden min-h-[40vh]">
          {result.type === 'image' ? (
            <img 
              src={result.url} 
              alt={result.prompt} 
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <video 
              src={result.url} 
              autoPlay 
              controls 
              className="max-w-full max-h-full object-contain" 
            />
          )}
        </div>

        {/* Sidebar Info */}
        <div className="w-full md:w-80 p-8 border-t md:border-t-0 md:border-l border-border/40 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-semibold  text-muted-foreground">Original prompt</label>
              <p className="text-sm font-medium leading-relaxed italic text-foreground/80">
                "{result.prompt}"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold  text-muted-foreground/50">Type</label>
                <div className="text-xs font-bold uppercase">{result.type}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold  text-muted-foreground/50">Time</label>
                <div className="text-xs font-bold">{result.timestamp.toLocaleTimeString()}</div>
              </div>
            </div>
          </div>

          <div className="pt-8 flex items-center gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-2xl text-xs font-bold hover:shadow-lg transition-all">
              <Download size={16} />
              Download
            </button>
            <button className="p-3 rounded-2xl bg-muted/50 hover:bg-muted border border-border/50 transition-colors">
              <Share2 size={18} />
            </button>
            <button className="p-3 rounded-2xl bg-muted/50 hover:bg-destructive hover:text-white border border-border/50 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
