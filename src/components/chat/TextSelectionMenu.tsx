import { useEffect, useState } from 'react';
import { Copy, Quote } from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

interface TextSelectionMenuProps {
  position: Position | null;
  onCopy: () => void;
  onReference: () => void;
  onClose: () => void;
}

export function TextSelectionMenu({ position, onCopy, onReference, onClose }: TextSelectionMenuProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (position) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [position]);

  useEffect(() => {
    // Listen for mousedown outside the menu or selection changes to close it
    const handleOutsideClick = () => {
      // Small timeout to allow the actual buttons to trigger their onClick events first
      setTimeout(() => {
         const selection = window.getSelection();
         if (!selection || selection.isCollapsed) {
            onClose();
         }
      }, 100);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  if (!position && !isVisible) return null;

  return (
    <div
      className={`fixed z-50 transition-all duration-200 ease-out origin-bottom ${
        isVisible && position ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
      }`}
      style={{
        left: position?.x || 0,
        top: position?.y || 0,
        transform: 'translate(-50%, -100%) translateY(-10px)',
      }}
    >
      <div className="flex items-center gap-1 p-1 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy
        </button>
        <div className="w-px h-4 bg-zinc-700 mx-1" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReference();
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
        >
          <Quote className="w-3.5 h-3.5" />
          Quote
        </button>
        
        {/* Downward pointing triangle (caret) */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-zinc-900/90" />
      </div>
    </div>
  );
}
