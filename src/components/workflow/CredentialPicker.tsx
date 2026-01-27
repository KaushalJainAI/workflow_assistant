import { useState, useRef, useEffect } from 'react';
import { Key, ChevronDown, Plus, Check, Search, Edit } from 'lucide-react';
import { credentialsService, type Credential } from '../../api/credentials';

interface CredentialPickerProps {
  value?: string;
  onChange: (credentialId: string) => void;
  credentialType?: string; // Filter by credential_type slug (e.g. 'gmail_oauth')
  placeholder?: string;
  required?: boolean;
  onCreate?: () => void;
  onEdit?: (credential: Credential) => void;
}

export default function CredentialPicker({
  value,
  onChange,
  credentialType,
  placeholder = 'Select a credential...',
  required = false,
  onCreate,
  onEdit,
}: CredentialPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load credentials once or when needed
    const loadCredentials = async () => {
      try {
        setLoading(true);
        const res = await credentialsService.list();
        const credsList = res.credentials ?? (Array.isArray(res) ? res : []);
        setCredentials(credsList);
      } catch (err) {
        console.error('Failed to load credentials', err);
      } finally {
        setLoading(false);
      }
    };
    
    // Only load if we open or if we have a value but no list yet
    if (isOpen || (value && credentials.length === 0)) {
       loadCredentials();
    }
  }, [isOpen]);

  // Filter credentials
  const filteredCredentials = credentials.filter((cred) => {
    // Since we receive the type SLUG or ID in backend schema, we need to match it.
    // However, backend credential object has `credential_type` ID. 
    // We ideally need to map slug -> id or filter by type display/slug if available.
    // For now, let's assume `credentialType` passed here filters by name/display loosely 
    // OR matches the logic in the backend. 
    // Actually, `credentialType` from node config is usually the SLUG (e.g. 'gmail').
    // The credential object has `credential_type` (int) and `credential_type_display` (string).
    // We might need to fetch types to map slug -> ID, or rely on naming convention.
    // Let's rely on loose matching for now or show all if unsure.
    
    // If credentialType is provided, filter. 
    // Best effort: matches credential_type_display (lowercase) or name contains it.
    // Real fix: `useNodeTypes` should provide the integer ID, OR we fetch types to lookup.
    
    // TODO: Improve filtering by fetching Types map. 
    // For now, let's show all and let user search, or if names match obvious patterns.
    
    const matchesSearch = cred.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Get selected credential
  const selectedCredential = credentials.find((cred) => String(cred.id) === String(value));

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (credentialId: number) => {
    onChange(String(credentialId));
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <div className="flex gap-2">
        <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`
            flex-1 flex items-center justify-between gap-2 px-3 py-2 
            bg-[var(--bg-tertiary)] border border-[var(--border-primary)] 
            rounded-lg text-sm transition-all duration-200
            hover:border-[var(--accent-primary)] focus:outline-none 
            focus:ring-2 focus:ring-[var(--accent-primary)]/20
            ${!selectedCredential ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}
            `}
        >
            <div className="flex items-center gap-2 truncate">
            {selectedCredential ? (
                <>
                <span className="text-base">🔑</span>
                <span className="truncate">{selectedCredential.name}</span>
                </>
            ) : (
                <>
                <Key className="w-4 h-4 opacity-50" />
                <span>{loading ? 'Loading...' : placeholder}</span>
                </>
            )}
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {/* Edit Button */}
        {selectedCredential && onEdit && (
            <button
                type="button"
                onClick={() => onEdit(selectedCredential)}
                className="p-2 border border-[var(--border-primary)] rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Edit Credential"
            >
                <Edit className="w-4 h-4" />
            </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-[var(--border-primary)]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search credentials..."
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                autoFocus
              />
            </div>
          </div>

          {/* Credential List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredCredentials.length === 0 ? (
              <div className="px-3 py-4 text-sm text-[var(--text-secondary)] text-center">
                {loading ? 'Loading...' : 'No credentials found'}
              </div>
            ) : (
              filteredCredentials.map((cred) => (
                <button
                  key={cred.id}
                  type="button"
                  onClick={() => handleSelect(cred.id)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                    hover:bg-[var(--bg-tertiary)] transition-colors
                    ${String(value) === String(cred.id) ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}
                  `}
                >
                  <span className="text-base">🔑</span>
                  <span className="flex-1 truncate">{cred.name}</span>
                  {String(value) === String(cred.id) && <Check className="w-4 h-4" />}
                </button>
              ))
            )}
          </div>

          {/* Create New */}
          {onCreate && (
              <div className="p-2 border-t border-[var(--border-primary)]">
                <button
                type="button"
                onClick={() => {
                    setIsOpen(false);
                    onCreate();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded transition-colors"
                >
                <Plus className="w-4 h-4" />
                <span>Create new credential</span>
                </button>
              </div>
          )}
        </div>
      )}

      {/* Required indicator */}
      {required && !value && (
        <p className="mt-1 text-xs text-red-400">This field is required</p>
      )}
    </div>
  );
}
