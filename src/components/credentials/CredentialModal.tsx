import { useState, useEffect } from 'react';
import { 
  X, 
  Eye, 
  EyeOff, 
  Mail, 
  Database, 
  MessageSquare, 
  Cloud, 
  Key, 
  Globe, 
  Shield,
  Sparkles,
  Search,
  ExternalLink
} from 'lucide-react';
import { credentialsService, type CreateCredentialData, type CredentialType, type Credential } from '../../api/credentials';
import { toast } from 'sonner';

// Icon mapper
const IconMap: Record<string, any> = {
  'Mail': Mail,
  'Database': Database,
  'MessageSquare': MessageSquare,
  'Cloud': Cloud,
  'Key': Key,
  'Globe': Globe,
  'Shield': Shield,
  'Sparkles': Sparkles,
  'Search': Search
};

interface CredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (credential: Credential) => void;
  initialData?: Credential | null;
  preselectedType?: CredentialType | null;
  credentialTypes: CredentialType[];
}

export default function CredentialModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  preselectedType,
  credentialTypes,
}: CredentialModalProps) {
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<CredentialType | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when opening/changing props
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (initialData) {
        // Edit Mode
        setName(initialData.name);
        // Find existing type
        const type = credentialTypes.find(t => t.id === initialData.credential_type);
        setSelectedType(type || null);
        
        // Populate fields
        const fields: Record<string, string> = {};
        initialData.fields.forEach(f => {
           fields[f.key] = f.value;
        });
        setFormData(fields);
      } else {
        // Create Mode
        setName('');
        if (preselectedType) {
          handleSelectType(preselectedType);
        } else {
          setSelectedType(null);
          setFormData({});
        }
      }
    }
  }, [isOpen, initialData, preselectedType, credentialTypes]);

  const handleSelectType = (type: CredentialType) => {
    setSelectedType(type);
    // Initialize fields with defaults
    const newFields: Record<string, string> = {};
    type.fields_schema.forEach(field => {
      newFields[field.name] = field.default || '';
    });
    setFormData(newFields);
  };

  const toggleFieldVisibility = (fieldKey: string) => {
    const newVisible = new Set(visibleFields);
    if (newVisible.has(fieldKey)) {
      newVisible.delete(fieldKey);
    } else {
      newVisible.add(fieldKey);
    }
    setVisibleFields(newVisible);
    setVisibleFields(newVisible);
  };

  const handleOAuthConnect = async () => {
    if (!selectedType) return;
    
    // We construct the authorize URL. 
    // In a real app, we might need to save the credential first to get an ID, 
    // or pass ClientID/Secret as query params if the backend allows ephemeral auth.
    // For now, we'll try to open the backend authorize endpoint.
    
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/credentials/oauth/${selectedType.id}/authorize/`;
    
    window.open(
      url, 
      'OAuth Authorization', 
      `width=${width},height=${height},top=${top},left=${left}`
    );
    
    // Listen for success message
    const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'OAUTH_SUCCESS') {
            toast.success('Account connected successfully!');
            // Here we might update the form data with returned tokens or status
            window.removeEventListener('message', handleMessage);
        }
    };
    window.addEventListener('message', handleMessage);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!selectedType && !initialData) {
       setError('Please select a credential type');
       return;
    }

    try {
      setSaving(true);
      setError(null);
      
      let result: Credential;

      if (initialData) {
        // Update
        const updateData: Record<string, string> = {};
        // Only send fields that have values (to avoid overwriting with empty if not intended, 
        // though typically we want to support clearing. 
        // For secrets, usually empty = don't update).
        Object.entries(formData).forEach(([key, value]) => {
           // Basic logic: if it's a password field and empty, don't send? 
           // Or just send everything. Let's send everything for now 
           // but maybe check schema if available.
           if (value !== undefined) {
             updateData[key] = value;
           }
        });

        result = await credentialsService.update(initialData.id, {
          name,
          data: updateData
        });
        toast.success('Credential updated');
      } else if (selectedType) {
        // Create
        result = await credentialsService.create({
          name,
          credential_type: selectedType.id,
          data: formData
        });
        toast.success('Credential created');
      } else {
        throw new Error('Invalid state');
      }

      if (onSave) onSave(result);
      onClose();
    } catch (err: any) {
      console.error('Save failed', err);
      // Try to extract error message
      const msg = err.response?.data?.error || err.message || 'Failed to save credential';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-semibold">
              {initialData ? 'Edit Credential' : 'New Credential'}
            </h2>
            {selectedType && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    {(() => {
                        const Icon = IconMap[selectedType.icon || 'Key'] || Key;
                        return <Icon className="w-4 h-4" />;
                    })()}
                    {selectedType.name}
                </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 border border-red-200 rounded-md text-sm flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-red-600" />
              {error}
            </div>
          )}

          {/* Type Selection (Create Mode Only) */}
          {!initialData && !preselectedType && !selectedType && (
             <div className="space-y-4">
               <div>
                 <label className="block text-sm font-medium mb-3 text-muted-foreground">Select Credential Type</label>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {credentialTypes.map(type => {
                        const Icon = IconMap[type.icon || 'Key'] || Key;
                        return (
                          <button
                            key={type.id}
                            onClick={() => handleSelectType(type)}
                            className="flex items-start gap-4 p-4 border border-border rounded-xl hover:bg-accent/50 hover:border-primary/50 transition-all text-left group bg-card"
                          >
                             <div className="p-2.5 bg-muted rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                <Icon className="w-6 h-6" />
                             </div>
                             <div>
                                <div className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">{type.name}</div>
                                <div className="text-xs text-muted-foreground leading-relaxed">{type.description}</div>
                             </div>
                          </button>
                        );
                    })}
                 </div>
               </div>
             </div>
          )}
          
          {/* Form */}
          {(selectedType || initialData) && (
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Credential"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
              
              {/* Dynamic Fields */}
              {selectedType?.fields_schema.map((field) => (
                <div key={field.name}>
                   <label className="block text-sm font-medium mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                   </label>
                   
                   {field.type === 'select' ? (
                       <select
                          value={formData[field.name] || ''}
                          onChange={(e) => setFormData({...formData, [field.name]: e.target.value})}
                          className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                       >
                          <option value="">Select...</option>
                          {field.options?.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                       </select>
                   ) : field.type === 'textarea' ? (
                        <textarea
                           value={formData[field.name] || ''}
                           onChange={(e) => setFormData({...formData, [field.name]: e.target.value})}
                           rows={3}
                           className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
                        />
                   ) : (
                       <div className="relative">
                           <input
                              type={field.type === 'password' && !visibleFields.has(field.name) ? 'password' : 'text'}
                              value={formData[field.name] || ''}
                              onChange={(e) => setFormData({...formData, [field.name]: e.target.value})}
                              placeholder={field.placeholder}
                              className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm pr-10"
                           />
                           {field.type === 'password' && (
                               <button
                                 type="button"
                                 onClick={() => toggleFieldVisibility(field.name)}
                                 className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                               >
                                  {visibleFields.has(field.name) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                               </button>
                           )}
                       </div>
                   )}
                   {/* OAuth Helper */}
                   {selectedType.auth_method === 'oauth2' && field.name === 'oauth_redirect_uri' && (
                       <div className="mt-2">
                           <p className="text-xs text-muted-foreground mb-2">
                              Callback URL: <code className="bg-muted p-1 rounded">{window.location.origin}/oauth/callback</code>
                           </p>
                           <button
                             type="button"
                             onClick={handleOAuthConnect}
                             className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground text-xs rounded-md hover:bg-secondary/80 transition-colors"
                           >
                              <ExternalLink className="w-3 h-3" />
                              Connect account
                           </button>
                       </div>
                   )}
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-2 shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-input rounded-md hover:bg-muted"
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2"
          >
            {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {initialData ? 'Update Credential' : 'Create Credential'}
          </button>
        </div>
      </div>
    </div>
  );
}
