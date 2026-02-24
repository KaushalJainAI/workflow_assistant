import { useState, useRef, useEffect } from 'react';
import { Key, ChevronDown, Plus, Check, Search, Edit } from 'lucide-react';
import { credentialsService, type Credential } from '../../api/credentials';

interface CredentialPickerProps {
  value?: string;
  onChange: (credentialId: string) => void;
  credentialType?: string; // Filter by credential_type slug (e.g. 'gmail_oauth')
  credentialTypeId?: number; // Filter by specific credential_type ID
  placeholder?: string;
  required?: boolean;
  onCreate?: () => void;
  onEdit?: (credential: Credential) => void;
}

export default function CredentialPicker({
  value,
  onChange,
  credentialType,
  credentialTypeId,
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
    // Filter by type if provided
    if (credentialTypeId !== undefined && cred.credential_type !== credentialTypeId) {
      return false;
    }
    
    // Filter by search
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
            bg-muted/40 border border-border 
            rounded-lg text-sm transition-all duration-200
            hover:border-primary focus:outline-none 
            focus:ring-2 focus:ring-primary/20
            ${!selectedCredential ? 'text-muted-foreground' : 'text-foreground'}
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
                className="p-2 border border-border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Edit Credential"
            >
                <Edit className="w-4 h-4" />
            </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search credentials..."
                className="w-full pl-8 pr-3 py-1.5 bg-muted/40 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
          </div>

          {/* Credential List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredCredentials.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
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
                    hover:bg-muted transition-colors
                    ${String(value) === String(cred.id) ? 'bg-primary/10 text-primary' : 'text-foreground'}
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
              <div className="p-2 border-t border-border">
                <button
                type="button"
                onClick={() => {
                    setIsOpen(false);
                    onCreate();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded transition-colors"
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
