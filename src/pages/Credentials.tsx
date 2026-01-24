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
import type { Credential, CredentialType, CreateCredentialData } from '../api/credentials';

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

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<CredentialType | null>(null);
  
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [viewingCredential, setViewingCredential] = useState<Credential | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    fields: Record<string, string>;
  }>({ name: '', fields: {} });

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

  const handleSelectType = (type: CredentialType) => {
    setSelectedType(type);
    setFormData({
      name: '',
      fields: type.fields_schema.reduce((acc, field) => ({
        ...acc,
        [field.name]: field.default || ''
      }), {})
    });
  };

  const handleSaveNewCredential = async () => {
    if (!selectedType || !formData.name.trim()) return;

    try {
      const payload: CreateCredentialData = {
        name: formData.name,
        credential_type: selectedType.id,
        data: formData.fields
      };
      
      await credentialsService.create(payload);
      
      setShowAddModal(false);
      setSelectedType(null);
      setFormData({ name: '', fields: {} });
      fetchData(); // Refresh list
    } catch (err) {
      console.error('Failed to create credential', err);
      // Ideally show toast
    }
  };

  const handleUpdateCredential = async () => {
    if (!editingCredential) return;

    try {
      // Find original type to know schema
      // For update, we might only send changed fields, but simplified approach: create new data object
      // But wait, editingCredential.fields in UI are array of { key, value... }
      // We need to convert back to record for API update.
      
      const updateData: Record<string, string> = {};
      editingCredential.fields.forEach(f => {
        // Prevent overwriting stored credential fields with empty strings
        if (f.value && f.value.trim() !== '') {
            updateData[f.key] = f.value;
        }
      });

      await credentialsService.update(editingCredential.id, {
        name: editingCredential.name,
        // credential_type is usually not changeable
        data: updateData
      });

      setEditingCredential(null);
      fetchData();
    } catch (err) {
      console.error('Failed to update credential', err);
    }
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

  const updateFormDataField = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      fields: { ...prev.fields, [key]: value }
    }));
  };

  const updateEditingField = (key: string, value: string) => {
    if (!editingCredential) return;
    setEditingCredential({
      ...editingCredential,
      fields: editingCredential.fields.map(f => 
        f.key === key ? { ...f, value } : f
      )
    });
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

  // Type Builder State
  const [isCreatingType, setIsCreatingType] = useState(false);
  const [newTypeData, setNewTypeData] = useState<{
    name: string;
    description: string;
    icon: string;
    auth_method: 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'custom';
    oauth_config: { auth_url: string; token_url: string; scopes: string };
    fields: { name: string; label: string; type: 'text' | 'password'; required: boolean }[];
  }>({
    name: '',
    description: '',
    icon: 'Key',
    auth_method: 'api_key',
    oauth_config: { auth_url: '', token_url: '', scopes: '' },
    fields: [{ name: '', label: '', type: 'text', required: true }]
  });

  const handleCreateType = async () => {
    if (!newTypeData.name.trim()) return;

    try {
      // Auto-generate slug (simplified)
      const slug = newTypeData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      const payload: Partial<CredentialType> = {
        name: newTypeData.name,
        slug,
        description: newTypeData.description,
        icon: newTypeData.icon,
        auth_method: newTypeData.auth_method,
        fields_schema: newTypeData.fields.filter(f => f.name && f.label), // Filter empty
        oauth_config: newTypeData.auth_method === 'oauth2' ? {
             auth_url: newTypeData.oauth_config.auth_url,
             token_url: newTypeData.oauth_config.token_url,
             scopes: newTypeData.oauth_config.scopes.split(',').map(s => s.trim()).filter(Boolean)
        } : undefined
      };

      const newType = await credentialsService.createType(payload);
      
      // Reset and select new type
      setIsCreatingType(false);
      setCredentialTypes(prev => [...prev, newType]);
      handleSelectType(newType);
      toast.success('Credential type created successfully');
    } catch (err) {
      console.error('Failed to create type', err);
      toast.error('Failed to create credential type');
    }
  };

  const handleDeleteType = async (e: React.MouseEvent, typeId: number) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this credential type? This cannot be undone.')) {
      return;
    }

    try {
      await credentialsService.deleteType(typeId);
      setCredentialTypes(prev => prev.filter(t => t.id !== typeId));
      if (selectedType?.id === typeId) {
        setSelectedType(null);
      }
      toast.success('Credential type deleted');
    } catch (err) {
      console.error('Failed to delete credential type', err);
      toast.error('Failed to delete credential type. It may be in use.');
    }
  };

  const addTypeField = () => {
    setNewTypeData(prev => ({
      ...prev,
      fields: [...prev.fields, { name: '', label: '', type: 'text', required: true }]
    }));
  };

  const removeTypeField = (index: number) => {
    setNewTypeData(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index)
    }));
  };

  const updateTypeField = (index: number, key: string, value: any) => {
    let finalValue = value;

    // Enforce canonical field names: lowercase, snake_case, no spaces or special characters
    if (key === 'name') {
        finalValue = String(value)
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    }

    setNewTypeData(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === index ? { ...f, [key]: finalValue } : f)
    }));
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
            onClick={() => setShowAddModal(true)}
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
                          setEditingCredential({ ...credential });
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
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Add Credential
            </button>
          </div>
        )}
      </div>

      {/* View Credential Modal */}
      {viewingCredential && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg mx-4">
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
                    setEditingCredential({ ...viewingCredential });
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

      {/* Edit Credential Modal */}
      {editingCredential && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Credential</h2>
              <button 
                onClick={() => setEditingCredential(null)}
                className="p-1.5 hover:bg-muted rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={editingCredential.name}
                  onChange={(e) => setEditingCredential({ ...editingCredential, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {editingCredential.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium mb-1">{field.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type={field.type === 'password' && !visibleFields.has(field.key) ? 'password' : 'text'}
                      value={field.value}
                      onChange={(e) => updateEditingField(field.key, e.target.value)}
                      className="flex-1 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
                    />
                    {field.type === 'password' && (
                      <button
                        type="button"
                        onClick={() => toggleFieldVisibility(field.key)}
                        className="p-2 hover:bg-muted rounded-md"
                      >
                        {visibleFields.has(field.key) ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button 
                onClick={() => setEditingCredential(null)}
                className="px-4 py-2 border border-input rounded-md hover:bg-muted"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateCredential}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Credential Modal (with Type Builder) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`bg-card border border-border rounded-lg shadow-xl w-full ${isCreatingType ? 'max-w-2xl' : 'max-w-lg'} mx-4 transition-all`}>
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {isCreatingType ? 'Create New Credential Type' : 
                   selectedType ? `New ${selectedType.name}` : 'Add New Credential'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isCreatingType ? 'Define a new type of credential' :
                   selectedType ? 'Enter your credential details' : 'Select the type of credential you want to add'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedType(null);
                  setIsCreatingType(false);
                }}
                className="p-1.5 hover:bg-muted rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 1. SELECT TYPE MODE */}
            {!selectedType && !isCreatingType && (
              <div className="p-6 max-h-96 overflow-auto">
                <div className="grid gap-2">
                  {/* Custom Type Builder Removed */}

                  {credentialTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleSelectType(type)}
                      className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted transition-colors text-left group relative"
                    >
                      <div className="p-2 bg-muted rounded-lg">{renderIcon(type.icon)}</div>
                      <div className="flex-1">
                          <span className="font-medium block">{type.name}</span>
                          <span className="text-xs text-muted-foreground">{type.description}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteType(e, type.id)}
                        className="p-2 text-muted-foreground hover:bg-red-100 hover:text-red-600 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete Type"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. CREATE TYPE MODE */}
            {isCreatingType && (
               <div className="p-6 space-y-6 max-h-[70vh] overflow-auto">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Type Name</label>
                      <input
                        type="text"
                        value={newTypeData.name}
                        onChange={(e) => setNewTypeData({...newTypeData, name: e.target.value})}
                        placeholder="e.g. My Custom API"
                        className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Icon</label>
                      <select
                        value={newTypeData.icon}
                        onChange={(e) => setNewTypeData({...newTypeData, icon: e.target.value})}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                         {Object.keys(IconMap).map(icon => (
                           <option key={icon} value={icon}>{icon}</option>
                         ))}
                      </select>
                    </div>
                 </div>
                 
                 {/* Auth Method */}
                 <div>
                    <label className="block text-sm font-medium mb-1">Authentication Method</label>
                    <select
                        value={newTypeData.auth_method}
                        onChange={(e) => setNewTypeData({...newTypeData, auth_method: e.target.value as any})}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="api_key">API Key</option>
                        <option value="oauth2">OAuth 2.0</option>
                        <option value="basic">Basic Auth</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="custom">Custom</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                       {newTypeData.auth_method === 'oauth2' ? 'Requires Auth URL and Token URL.' : 
                        newTypeData.auth_method === 'api_key' ? 'Typically a single secret key.' : 
                        'Define fields below.'}
                    </p>
                 </div>
                 
                 {/* OAuth Config Config */}
                 {newTypeData.auth_method === 'oauth2' && (
                    <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                        <h3 className="font-medium text-sm">OAuth 2.0 Configuration</h3>
                        <div className="grid grid-cols-2 gap-3">
                             <div>
                                <label className="block text-xs font-medium mb-1">Auth URL</label>
                                <input
                                  type="text"
                                  value={newTypeData.oauth_config.auth_url}
                                  onChange={(e) => setNewTypeData({...newTypeData, oauth_config: {...newTypeData.oauth_config, auth_url: e.target.value}})}
                                  placeholder="https://example.com/oauth/authorize"
                                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md"
                                />
                             </div>
                             <div>
                                <label className="block text-xs font-medium mb-1">Token URL</label>
                                <input
                                  type="text"
                                  value={newTypeData.oauth_config.token_url}
                                  onChange={(e) => setNewTypeData({...newTypeData, oauth_config: {...newTypeData.oauth_config, token_url: e.target.value}})}
                                  placeholder="https://example.com/oauth/token"
                                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md"
                                />
                             </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Scopes (comma separated)</label>
                            <input
                              type="text"
                              value={newTypeData.oauth_config.scopes}
                              onChange={(e) => setNewTypeData({...newTypeData, oauth_config: {...newTypeData.oauth_config, scopes: e.target.value}})}
                              placeholder="read, write, user:profile"
                              className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md"
                            />
                        </div>
                    </div>
                 )}

                 <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <input
                      type="text"
                      value={newTypeData.description}
                      onChange={(e) => setNewTypeData({...newTypeData, description: e.target.value})}
                      placeholder="e.g. For connecting to internal legacy system"
                      className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                 </div>



                 <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                       <h3 className="font-medium text-sm">Credential Fields</h3>
                       <button onClick={addTypeField} className="text-xs text-primary flex items-center gap-1 hover:underline">
                         <Plus className="w-3 h-3" /> Add Field
                       </button>
                    </div>
                    
                    {newTypeData.fields.map((field, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-3 bg-muted/40 rounded-md border border-border">
                         <div className="flex-1 space-y-2">
                            <div className="flex gap-2">
                               <input 
                                 type="text" 
                                 placeholder="Field Name (key)" 
                                 value={field.name}
                                 onChange={e => updateTypeField(idx, 'name', e.target.value)}
                                 className="w-1/2 px-2 py-1 text-sm bg-background border border-input rounded"
                               />
                               <input 
                                 type="text" 
                                 placeholder="Label (display)" 
                                 value={field.label}
                                 onChange={e => updateTypeField(idx, 'label', e.target.value)}
                                 className="w-1/2 px-2 py-1 text-sm bg-background border border-input rounded"
                               />
                            </div>
                            <div className="flex items-center gap-4">
                               <select
                                 value={field.type}
                                 onChange={e => updateTypeField(idx, 'type', e.target.value)}
                                 className="px-2 py-1 text-sm bg-background border border-input rounded"
                               >
                                 <option value="text">Text (Public)</option>
                                 <option value="password">Password (Masked)</option>
                               </select>
                               <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                  <input 
                                    type="checkbox" 
                                    checked={field.required}
                                    onChange={e => updateTypeField(idx, 'required', e.target.checked)}
                                    className="rounded border-input"
                                  />
                                  Required
                               </label>
                            </div>
                         </div>
                         <button 
                           onClick={() => removeTypeField(idx)}
                           className="p-1 text-red-500 hover:bg-red-50 rounded"
                         >
                            <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    ))}
                 </div>
               </div>
            )}

            {/* 3. CREATE CREDENTIAL FORM (Existing) */}
            {selectedType && (
              <div className="p-6 space-y-4 max-h-96 overflow-auto">
                <div>
                  <label className="block text-sm font-medium mb-1">Credential Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder={`My ${selectedType.name}`}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {selectedType.fields_schema.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium mb-1">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type={field.type === 'password' && !visibleFields.has(field.name) ? 'password' : 'text'}
                        value={formData.fields[field.name] || ''}
                        onChange={(e) => updateFormDataField(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className="flex-1 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
                      />
                      {field.type === 'password' && (
                        <button
                          type="button"
                          onClick={() => toggleFieldVisibility(field.name)}
                          className="p-2 hover:bg-muted rounded-md"
                        >
                          {visibleFields.has(field.name) ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="p-4 border-t border-border flex justify-end gap-2">
              {(selectedType || isCreatingType) && (
                <button 
                  onClick={() => {
                    setSelectedType(null);
                    setIsCreatingType(false);
                  }}
                  className="px-4 py-2 border border-input rounded-md hover:bg-muted"
                >
                  Back
                </button>
              )}
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedType(null);
                  setIsCreatingType(false);
                }}
                className="px-4 py-2 border border-input rounded-md hover:bg-muted"
              >
                Cancel
              </button>
              
              {selectedType && !isCreatingType && (
                <button 
                  onClick={handleSaveNewCredential}
                  disabled={!formData.name.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  Create Credential
                </button>
              )}

              {isCreatingType && (
                 <button
                   onClick={handleCreateType}
                   disabled={!newTypeData.name.trim()}
                   className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                 >
                    Save Type
                 </button>
              )}
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
