import { useState, useRef, useEffect } from 'react';
import { Key, ChevronDown, Plus, Check, Search } from 'lucide-react';

// Mock credential data for demo - will be replaced with API calls
const mockCredentials = [
  { id: 'cred-1', name: 'My Gmail Account', type: 'gmail', icon: '📧' },
  { id: 'cred-2', name: 'Work Slack', type: 'slack', icon: '💬' },
  { id: 'cred-3', name: 'OpenAI API', type: 'openai', icon: '🤖' },
  { id: 'cred-4', name: 'Production DB', type: 'postgres', icon: '🗄️' },
  { id: 'cred-5', name: 'Google Sheets API', type: 'google_sheets', icon: '📊' },
  { id: 'cred-6', name: 'Notion Integration', type: 'notion', icon: '📝' },
  { id: 'cred-7', name: 'MongoDB Atlas', type: 'mongodb', icon: '🍃' },
  { id: 'cred-8', name: 'Redis Cloud', type: 'redis', icon: '⚡' },
];

interface CredentialPickerProps {
  value?: string;
  onChange: (credentialId: string) => void;
  credentialType?: string; // Filter by type (e.g., 'gmail', 'slack')
  placeholder?: string;
  required?: boolean;
}

export default function CredentialPicker({
  value,
  onChange,
  credentialType,
  placeholder = 'Select a credential...',
  required = false,
}: CredentialPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter credentials by type if specified
  const filteredCredentials = mockCredentials.filter((cred) => {
    const matchesType = !credentialType || cred.type === credentialType;
    const matchesSearch = cred.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Get selected credential
  const selectedCredential = mockCredentials.find((cred) => cred.id === value);

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

  const handleSelect = (credentialId: string) => {
    onChange(credentialId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-2 px-3 py-2 
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
              <span className="text-base">{selectedCredential.icon}</span>
              <span className="truncate">{selectedCredential.name}</span>
            </>
          ) : (
            <>
              <Key className="w-4 h-4 opacity-50" />
              <span>{placeholder}</span>
            </>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

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
                No credentials found
                {credentialType && (
                  <span className="block text-xs mt-1">
                    Looking for type: {credentialType}
                  </span>
                )}
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
                    ${value === cred.id ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}
                  `}
                >
                  <span className="text-base">{cred.icon}</span>
                  <span className="flex-1 truncate">{cred.name}</span>
                  {value === cred.id && <Check className="w-4 h-4" />}
                </button>
              ))
            )}
          </div>

          {/* Create New */}
          <div className="p-2 border-t border-[var(--border-primary)]">
            <button
              type="button"
              onClick={() => {
                // TODO: Open create credential modal
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create new credential</span>
            </button>
          </div>
        </div>
      )}

      {/* Required indicator */}
      {required && !value && (
        <p className="mt-1 text-xs text-red-400">This field is required</p>
      )}
    </div>
  );
}
