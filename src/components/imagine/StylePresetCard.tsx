import React from 'react';
import { cn } from '../../lib/utils';

interface StylePreset {
  id: string;
  name: string;
  image: string;
}

interface StylePresetCardProps {
  preset: StylePreset;
  isActive: boolean;
  onClick: () => void;
}

export function StylePresetCard({ preset, isActive, onClick }: StylePresetCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center gap-2 p-2 rounded-2xl transition-all duration-300 w-full",
        isActive 
          ? "bg-primary/10 ring-1 ring-primary/40 shadow-sm" 
          : "hover:bg-muted"
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
        <img 
          src={preset.image} 
          alt={preset.name} 
          className={cn(
            "h-full w-full object-cover transition-transform duration-500",
            isActive ? "scale-110" : "group-hover:scale-105"
          )}
        />
        <div className={cn(
          "absolute inset-0 bg-black/20 transition-opacity duration-300",
          isActive ? "opacity-0" : "opacity-0 group-hover:opacity-100"
        )} />
      </div>
      <span className={cn(
        "text-[10px] font-bold uppercase tracking-widest",
        isActive ? "text-primary" : "text-muted-foreground"
      )}>
        {preset.name}
      </span>
    </button>
  );
}
