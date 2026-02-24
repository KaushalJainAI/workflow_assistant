
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Option {
  label: string;
  value: string;
  icon?: React.ReactNode;
  is_free?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  showSearch?: boolean;
}

export default function Select({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Select...', 
  className,
  icon,
  showSearch = false
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    
    // Default name/label match
    const matchesName = opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q);
    if (matchesName) return true;

    // Advanced filters
    if (q === 'free' && opt.is_free === true) return true;
    if (q === 'paid' && opt.is_free === false) return true;

    return false;
  });

  const selectedOption = options.find(opt => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-background/50 border border-input rounded-xl hover:bg-accent/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20",
          isOpen && "border-primary/50 ring-2 ring-primary/20",
          className
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          {selectedOption?.icon && <span className="text-foreground">{selectedOption.icon}</span>}
          <span className={cn(
            "text-sm font-medium truncate",
            !selectedOption && "text-muted-foreground"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 text-muted-foreground transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top p-1">
          {showSearch && (
            <div className="p-2 border-b border-border/10">
              <input
                type="text"
                autoFocus
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-muted/50 border-none px-3 py-1.5 rounded-lg text-xs focus:ring-1 focus:ring-primary/20 outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="max-h-[240px] overflow-auto py-1 custom-scrollbar">
            {filteredOptions.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors",
                    isSelected 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-foreground/80 hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    {option.icon}
                    <span>{option.label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 opacity-100" />}
                </button>
              );
            })}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No Results' : 'No options'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
