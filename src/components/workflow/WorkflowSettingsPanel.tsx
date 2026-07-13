/**
 * Workflow Settings Panel
 * 
 * Panel for configuring workflow-level settings including supervision level.
 */

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Settings, Info, Zap, Search, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import apiClient from '../../api/client';

export type SupervisionLevel = 'error_only' | 'full' | 'none';

interface Skill {
  id: string;
  title: string;
}

interface WorkflowSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  supervisionLevel: SupervisionLevel;
  description: string;
  context: string;
  skills: Skill[];
  selectedSkills: string[];
  onSave: (description: string, context: string, supervisionLevel: SupervisionLevel, selectedSkills: string[]) => void;
}

const SUPERVISION_OPTIONS: {
  value: SupervisionLevel;
  label: string;
  description: string;
  warning?: string;
}[] = [
  {
    value: 'error_only',
    label: 'Error Only (Recommended)',
    description: 'Only handles errors during execution. Best balance of cost and safety.',
  },
  {
    value: 'full',
    label: 'Full Supervision',
    description: 'Monitors every step of execution. Enables pause/resume and detailed logging.',
    warning: 'Increases API costs and system overhead',
  },
  {
    value: 'none',
    label: 'No Supervision',
    description: 'Maximum performance. No orchestrator hooks are called.',
    warning: 'Errors will not be handled automatically',
  },
];

export default function WorkflowSettingsPanel({
  isOpen,
  onClose,
  supervisionLevel,
  description,
  context,
  skills,
  selectedSkills,
  onSave,
}: WorkflowSettingsPanelProps) {
  const [localDescription, setLocalDescription] = useState(description);
  const [localContext, setLocalContext] = useState(context);
  const [localSupervisionLevel, setLocalSupervisionLevel] = useState(supervisionLevel);
  const [localSelectedSkills, setLocalSelectedSkills] = useState<string[]>(selectedSkills);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    mine: Skill[];
    public: Skill[];
    isRecommendation?: boolean;
  }>({ mine: [], public: [] });

  // Sync local state with props when panel opens
  useEffect(() => {
    if (isOpen) {
      setLocalDescription(description);
      setLocalContext(context);
      setLocalSupervisionLevel(supervisionLevel);
      setLocalSelectedSkills(selectedSkills);
      setSearchQuery('');
      setIsDropdownOpen(false);
    }
  }, [isOpen, description, context, supervisionLevel, selectedSkills]);

  // Debounced Search Effect with Recommendation Logic
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const fetchResults = async (query: string) => {
          const [mineRes, publicRes] = await Promise.all([
            apiClient.get('/skills/search/', { params: { query, tab: 'mine', page_size: 5 } }),
            apiClient.get('/skills/search/', { params: { query, tab: 'public', page_size: 5 } })
          ]);
          return {
            mine: mineRes.data.results.map((s: any) => ({ id: s.id.toString(), title: s.title })),
            public: publicRes.data.results.map((s: any) => ({ id: s.id.toString(), title: s.title }))
          };
        };

        let data = await fetchResults(searchQuery);
        
        // Recommendation Logic: If search has no results, fetch "nearest" (top/recent) skills
        if (searchQuery && data.mine.length === 0 && data.public.length === 0) {
          data = await fetchResults(''); // Fallback to top skills
          setSearchResults({ ...data, isRecommendation: true });
        } else {
          setSearchResults({ ...data, isRecommendation: false });
        }
      } catch (error) {
        console.error('Failed to search skills:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  if (!isOpen) return null;

  const handleDone = () => {
    onSave(localDescription, localContext, localSupervisionLevel, localSelectedSkills);
    onClose();
  };

  const toggleSkill = (id: string) => {
    setLocalSelectedSkills(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-background border border-border rounded-lg shadow-sm">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Workflow Settings</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* General Section */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest">
              General
            </h3>
            <div className="space-y-2">
              <label htmlFor="workflow-description" className="block text-sm font-medium">
                Description
              </label>
              <textarea
                id="workflow-description"
                value={localDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
                placeholder="Describe what this workflow does..."
                className="w-full h-24 px-3 py-2 bg-muted/30 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none text-sm placeholder:text-muted-foreground"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="workflow-context" className="block text-sm font-medium">
                Execution Context <span className="text-xs text-muted-foreground font-normal ml-1">(Optional)</span>
              </label>
              <textarea
                id="workflow-context"
                value={localContext}
                onChange={(e) => setLocalContext(e.target.value)}
                placeholder="Provide additional context for the AI Supervisor (e.g., 'This workflow handles sensitive financial data' or 'Prioritize speed over precision')..."
                className="w-full h-24 px-3 py-2 bg-muted/30 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none text-sm placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="w-full h-px bg-border" />

          {/* Skills Section */}
          <div className="space-y-4 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-widest">
                  Active Skills
                </h3>
                <div className="group relative">
                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden group-hover:block z-10 w-64 p-3 bg-popover border border-border rounded-lg shadow-xl text-xs leading-relaxed text-foreground">
                    Select skills that the AI Supervisor and LLM nodes can use to enhance execution logic and decision making.
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Skills Pills */}
            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-muted/20 border border-border rounded-lg items-center">
              {localSelectedSkills.length === 0 && (
                <span className="text-xs text-muted-foreground px-2 italic">No skills selected</span>
              )}
              {localSelectedSkills.map(id => {
                const skill = skills.find(s => s.id === id) || 
                             searchResults.mine.find(s => s.id === id) || 
                             searchResults.public.find(s => s.id === id);
                return (
                  <div key={id} className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md text-[11px] font-bold animate-in zoom-in-95">
                    <Zap className="w-3 h-3" />
                    <span>{skill?.title || 'Unknown Skill'}</span>
                    <button onClick={() => toggleSkill(id)} className="ml-1 hover:text-primary-foreground hover:bg-primary rounded-sm p-0.5 transition-colors">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Dropdown Trigger & Search Input */}
            <div className="relative group">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isSearching ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                <input
                  type="text"
                  placeholder="Search and add skills..."
                  value={searchQuery}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-10 bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                />
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded text-muted-foreground transition-colors"
                >
                  {isDropdownOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsDropdownOpen(false)} 
                  />
                  <div className="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-2xl z-20 max-h-80 overflow-y-auto overflow-x-hidden p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    
                    {searchResults.isRecommendation && (
                      <div className="px-3 py-2 mb-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-[10px] font-bold text-amber-600 italic">No exact matches. Showing recommended skills:</span>
                      </div>
                    )}

                    {/* My Skills Group */}
                    <div className="space-y-1 mb-4">
                      <div className="flex items-center gap-2 px-3 py-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">My Skills</span>
                        <div className="h-px flex-1 bg-border/50" />
                      </div>
                      {searchResults.mine.length > 0 ? (
                        searchResults.mine.map((skill) => (
                          <button
                            key={`mine-${skill.id}`}
                            onClick={() => {
                              toggleSkill(skill.id);
                              if (!localSelectedSkills.includes(skill.id)) setSearchQuery(''); 
                            }}
                            className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-lg text-left transition-all ${
                              localSelectedSkills.includes(skill.id)
                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                : 'hover:bg-muted/50 text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Zap className={`w-3.5 h-3.5 flex-shrink-0 ${localSelectedSkills.includes(skill.id) ? 'text-primary-foreground' : 'text-primary'}`} />
                              <span className="text-sm font-medium truncate">{skill.title}</span>
                            </div>
                            {localSelectedSkills.includes(skill.id) && <X className="w-3.5 h-3.5" />}
                          </button>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic px-3 py-2">No personal skills match.</p>
                      )}
                    </div>

                    {/* Public Library Group */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 px-3 py-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Public Library</span>
                        <div className="h-px flex-1 bg-border/50" />
                      </div>
                      {searchResults.public.length > 0 ? (
                        searchResults.public.map((skill) => (
                          <button
                            key={`public-${skill.id}`}
                            onClick={() => {
                              toggleSkill(skill.id);
                              if (!localSelectedSkills.includes(skill.id)) setSearchQuery(''); 
                            }}
                            className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-lg text-left transition-all ${
                              localSelectedSkills.includes(skill.id)
                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                : 'hover:bg-muted/50 text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Zap className={`w-3.5 h-3.5 flex-shrink-0 ${localSelectedSkills.includes(skill.id) ? 'text-primary-foreground' : 'text-primary'}`} />
                              <span className="text-sm font-medium truncate">{skill.title}</span>
                            </div>
                            {localSelectedSkills.includes(skill.id) && <X className="w-3.5 h-3.5" />}
                          </button>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic px-3 py-2">No public skills match.</p>
                      )}
                    </div>

                    {isSearching && (
                      <div className="absolute inset-x-0 bottom-0 py-2 bg-card/80 backdrop-blur-sm border-t border-border flex justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="w-full h-px bg-border" />

          {/* Supervision Level Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-widest">
                Execution Supervision
              </h3>
              <div className="group relative">
                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden group-hover:block z-10 w-64 p-3 bg-popover border border-border rounded-lg shadow-xl text-xs leading-relaxed">
                  Controls how much the orchestrator monitors workflow execution. 
                  Higher supervision enables more features like error recovery but increases API costs.
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              {SUPERVISION_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`block p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                    localSupervisionLevel === option.value
                      ? 'border-primary ring-1 ring-primary/20 bg-primary/5 shadow-sm'
                      : 'border-border hover:border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0">
                      <input
                        type="radio"
                        name="supervisionLevel"
                        value={option.value}
                        checked={localSupervisionLevel === option.value}
                        onChange={() => setLocalSupervisionLevel(option.value)}
                        className="w-4 h-4 text-primary border-border focus:ring-primary"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{option.label}</span>
                        {option.value === 'error_only' && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-green-500/10 text-green-600 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {option.description}
                      </p>
                      {option.warning && localSupervisionLevel === option.value && (
                        <div className="flex items-center gap-1.5 mt-2 text-amber-600 text-[11px] font-medium italic">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{option.warning}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDone}
            className="px-6 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:bg-primary/90 shadow-sm active:scale-95 transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
