import { 
  Video, 
  FileText, 
  ExternalLink, 
  Play, 
  Globe2 
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';

interface MediaPreviewProps {
  url: string;
  type?: 'image' | 'video' | 'pdf' | 'link';
  title?: string;
  source?: string;
  thumbnail?: string;
  className?: string;
  compact?: boolean;
}

export function MediaPreview({ url, type, title, source, thumbnail, className, compact }: MediaPreviewProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  // Detection logic if type is missing
  const detectedType = type || (() => {
    const lower = url.toLowerCase();
    // Common image extensions
    if (lower.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/)) return 'image';
    // Video platforms and extensions
    if (
      lower.match(/\.(mp4|webm|ogg)$/) || 
      lower.includes('youtube.com') || 
      lower.includes('youtu.be') || 
      lower.includes('vimeo.com')
    ) return 'video';
    // Document types
    if (lower.match(/\.pdf$/)) return 'pdf';
    return 'link';
  })();

  const domain = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return source || 'Link';
    }
  })();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const resolvedThumbnail = thumbnailFailed ? '' : (thumbnail || '');
  const hasThumbnail = !!resolvedThumbnail || detectedType === 'image' || (detectedType === 'video' && (url.includes('youtube.com') || url.includes('youtu.be')));
  const isCompact = compact || (!hasThumbnail && detectedType === 'link');

  return (
    <div 
      onClick={handleClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md flex flex-col",
        isCompact ? "h-auto" : "h-full",
        className
      )}
    >
      {/* Dynamic Content Thumbnail */}
      {!isCompact && (
        <div className="aspect-video relative overflow-hidden bg-muted/20 shrink-0">
          {(resolvedThumbnail || detectedType === 'image') && (
            <img 
              src={resolvedThumbnail || url} 
              alt={title || "Preview"} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                if (detectedType === 'link') {
                  setThumbnailFailed(true);
                  return;
                }
                (e.target as HTMLImageElement).src = `https://placehold.co/600x400/101010/ffffff?text=Preview+Unavailable`;
              }}
            />
          )}
          
          {detectedType === 'video' && !thumbnail && (
            <div className="w-full h-full flex items-center justify-center bg-slate-900/10">
              {/* Try to get YouTube thumbnail if applicable */}
              {url.includes('youtube.com') || url.includes('youtu.be') ? (
                (() => {
                  const vid = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
                  return vid ? (
                    <img 
                      src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`}
                      className="w-full h-full object-cover"
                      alt="Video Preview"
                    />
                  ) : <Video className="w-8 h-8 text-primary/40" />;
                })()
              ) : (
                <Video className="w-8 h-8 text-primary/40 group-hover:text-primary/60 transition-colors" />
              )}
            </div>
          )}

          {detectedType === 'pdf' && !thumbnail && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-red-500/5">
              <FileText className="w-10 h-10 text-red-500/20 group-hover:text-red-500/40 transition-colors" />
              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[8px] font-semibold text-red-600 ">
                PDF
              </div>
            </div>
          )}

          {detectedType === 'link' && !resolvedThumbnail && (
            <div className="w-full h-full flex items-center justify-center bg-blue-500/5">
              <div className="relative w-14 h-14 rounded-2xl bg-background/60 border border-border/40 flex items-center justify-center overflow-hidden">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
                  alt=""
                  className="w-8 h-8"
                  onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                />
                <Globe2 className="absolute w-6 h-6 text-blue-500/30" />
              </div>
            </div>
          )}

          {/* Hover Play Button Overlay for Videos */}
          {detectedType === 'video' && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/5">
               <div className="w-10 h-10 rounded-full bg-primary/25 backdrop-blur-md flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/40 transition-all duration-300 ring-1 ring-white/20">
                 <Play className="w-4 h-4 text-white fill-white ml-0.5" />
               </div>
             </div>
          )}

          {/* Hover Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </div>
      )}

      {/* Info Footer */}
      <div className={cn(
        "p-2.5 flex-1 flex flex-col justify-between min-w-0",
        isCompact && "py-3"
      )}>
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-1.5">
            <span className={cn(
               "text-[9px] font-semibold  text-muted-foreground/30",
               detectedType === 'image' && "group-hover:text-emerald-500",
               detectedType === 'video' && "group-hover:text-purple-500",
               detectedType === 'pdf' && "group-hover:text-red-500",
               detectedType === 'link' && "group-hover:text-blue-500"
            )}>
              {detectedType}
            </span>
            <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/20 group-hover:text-primary transition-colors shrink-0" />
          </div>
          <h4 className={cn(
            "font-bold leading-tight text-foreground/70 group-hover:text-foreground transition-colors line-clamp-2",
            isCompact ? "text-[13px]" : "text-[12px]"
          )}>
            {title || domain}
          </h4>
        </div>
        
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
             <img 
               src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
               alt="" 
               className="w-2.5 h-2.5"
               onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
             />
          </div>
          <p className="text-[10px] font-medium text-muted-foreground/40 truncate">
            {domain}
          </p>
        </div>
      </div>
    </div>
  );
}
