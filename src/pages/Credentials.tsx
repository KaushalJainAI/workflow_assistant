import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  MoreVertical,
  Key,
  Globe,
  Mail,
  Database,
  MessageSquare,
  Cloud,
  Shield,
  X,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Check,
  Copy,
  AlertCircle
} from 'lucide-react';
import { credentialsService } from '../api/credentials';
import type { Credential, CredentialType } from '../api/credentials';
import CredentialModal from '../components/credentials/CredentialModal';

// Icon mapper
const IconMap: Record<string, any> = {
  'Mail': Mail,
  'Database': Database,
  'MessageSquare': MessageSquare,
  'Cloud': Cloud,
  'Key': Key,
  'Globe': Globe,
  'Shield': Shield
};

export default function Credentials() {
  const [searchQuery, setSearchQuery] = useState('');
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialTypes, setCredentialTypes] = useState<CredentialType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [viewingCredential, setViewingCredential] = useState<Credential | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [credsRes, typesRes] = await Promise.all([
        credentialsService.list(),
        credentialsService.getTypes()
      ]);
      // Handle both wrapped ({ credentials: [...] }) and unwrapped ([...]) responses
      const credsList = credsRes?.credentials ?? (Array.isArray(credsRes) ? credsRes : []);
      const typesList = typesRes?.types ?? (Array.isArray(typesRes) ? typesRes : []);
      setCredentials(credsList);
      setCredentialTypes(typesList);
      setError(null);
    } catch (err) {
      console.error('Failed to load credentials', err);
      setError('Failed to load credentials. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredCredentials = credentials.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.credential_type_display.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleFieldVisibility = (fieldKey: string) => {
    const newVisible = new Set(visibleFields);
    if (newVisible.has(fieldKey)) {
      newVisible.delete(fieldKey);
    } else {
      newVisible.add(fieldKey);
    }
    setVisibleFields(newVisible);
  };

  const copyToClipboard = (value: string, fieldKey: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDeleteCredential = async (id: number) => {
    try {
      await credentialsService.delete(id);
      setShowDeleteConfirm(null);
      setOpenDropdown(null);
      fetchData();
    } catch (err) {
      console.error('Failed to delete credential', err);
    }
  };

  const handleVerifyCredential = async (id: number) => {
    try {
      const result = await credentialsService.verify(id);
      if (result.valid) {
        // Update local state to show verified
        setCredentials(prev => prev.map(c => c.id === id ? { ...c, is_verified: true } : c));
        if (viewingCredential?.id === id) {
            setViewingCredential(prev => prev ? { ...prev, is_verified: true } : null);
        }
        toast.success('Credential verified successfully!');
      } else {
        toast.error(`Verification failed: ${result.message}`);
      }
    } catch (err) {
      console.error('Verification failed', err);
      toast.error('Verification failed. See console for details.');
    }
  };

  const renderIcon = (iconName: string) => {
    const Icon = IconMap[iconName] || Key;
    return <Icon className="w-5 h-5" />;
  };



  if (loading && credentials.length === 0) {
    return <div className="p-6 text-center text-muted-foreground">Loading credentials...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Key className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Credentials</h1>
              <p className="text-sm text-muted-foreground">
                Manage your external service connections
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
                setEditingCredential(null);
                setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Credential
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search credentials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-4 border-b border-red-200 flex items-center gap-2">
           <AlertCircle className="w-5 h-5" />
           {error}
        </div>
      )}

      {/* Credentials Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCredentials.map((credential) => (
            <div
              key={credential.id}
              className="p-4 bg-card border border-border rounded-lg hover:border-primary/50 hover:shadow-sm transition-all group cursor-pointer"
              onClick={() => setViewingCredential(credential)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    {(() => {
                        const type = credentialTypes.find(t => t.id === credential.credential_type);
                        return renderIcon(type?.icon || 'Key');
                    })()}
                  </div>
                  <div>
                    <h3 className="font-medium group-hover:text-primary transition-colors">
                      {credential.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{credential.credential_type_display}</p>
                  </div>
                </div>
                <div className="relative">
                  <button 
                    className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdown(openDropdown === credential.id ? null : credential.id);
                    }}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  
                  {openDropdown === credential.id && (
                    <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-10 py-1 min-w-32">
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingCredential(credential);
                          setOpenDropdown(null);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCredential(credential);
                          setShowModal(true);
                          setOpenDropdown(null);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleVerifyCredential(credential.id);
                            setOpenDropdown(null);
                        }}
                      >
                        <Shield className="w-4 h-4 text-green-600" />
                        Verify
                      </button>
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(credential.id);
                          setOpenDropdown(null);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  {credential.is_verified ? (
                     <Check className="w-3 h-3 text-green-500" />
                  ) : (
                     <Shield className="w-3 h-3" />
                  )}
                  <span>{credential.is_verified ? 'Verified' : 'Unverified'}</span>
                </div>
                <span>{new Date(credential.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>

        {filteredCredentials.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Key className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No credentials found</h3>
            <p className="text-muted-foreground mb-4">
              Add credentials to connect to external services
            </p>
            <button 
              onClick={() => {
                  setEditingCredential(null);
                  setShowModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Add Credential
            </button>
          </div>
        )}
      </div>

      <CredentialModal 
        isOpen={showModal}
        onClose={() => {
            setShowModal(false);
            setEditingCredential(null);
        }}
        initialData={editingCredential}
        credentialTypes={credentialTypes as CredentialType[]}
        onSave={() => fetchData()}
      />

      {/* View Credential Modal */}
      {viewingCredential && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg mx-4">
             {/* ... View Mode Content Stays ... */}
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                   {(() => {
                        const type = credentialTypes.find(t => t.id === viewingCredential.credential_type);
                        return renderIcon(type?.icon || 'Key');
                    })()}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{viewingCredential.name}</h2>
                  <p className="text-sm text-muted-foreground">{viewingCredential.credential_type_display}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setViewingCredential(null);
                  setVisibleFields(new Set());
                }}
                className="p-1.5 hover:bg-muted rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {viewingCredential.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium mb-1">{field.label}</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm break-all min-h-[38px] flex items-center text-foreground">
                      {field.type === 'password' && !visibleFields.has(field.key)
                        ? '••••••••••••'
                        : (field.value || <span className="text-muted-foreground italic opacity-50">Empty</span>)}
                    </div>
                    {field.type === 'password' && (
                      <button
                        onClick={() => toggleFieldVisibility(field.key)}
                        className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground"
                        title={visibleFields.has(field.key) ? 'Hide' : 'Show'}
                      >
                        {visibleFields.has(field.key) ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => copyToClipboard(field.value, field.key)}
                      className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground"
                      title="Copy"
                    >
                      {copiedField === field.key ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border flex justify-between">
              <div className="text-sm text-muted-foreground">
                <p>Created: {new Date(viewingCredential.created_at).toLocaleDateString()}</p>
                <p>Updated: {new Date(viewingCredential.updated_at).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <button 
                    onClick={() => handleVerifyCredential(viewingCredential.id)}
                    className="flex items-center gap-2 px-4 py-2 border border-green-200 text-green-700 bg-green-50 rounded-md hover:bg-green-100"
                >
                    <Shield className="w-4 h-4" />
                    Verify
                </button>
                <button 
                  onClick={() => {
                    setEditingCredential(viewingCredential);
                    setShowModal(true);
                    setViewingCredential(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-input rounded-md hover:bg-muted"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold mb-2">Delete Credential?</h3>
            <p className="text-muted-foreground mb-4">
              This action cannot be undone. Workflows using this credential will stop working.
            </p>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border border-input rounded-md hover:bg-muted"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteCredential(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
