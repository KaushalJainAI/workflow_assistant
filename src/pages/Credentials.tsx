import { useState } from 'react';
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
  Copy
} from 'lucide-react';

type CredentialType = 'Google OAuth2' | 'Slack OAuth2' | 'PostgreSQL' | 'API Key' | 'AWS Credentials' | 'HTTP Basic Auth';

interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  value: string;
}

interface Credential {
  id: string;
  name: string;
  type: CredentialType;
  icon: React.ReactNode;
  createdAt: string;
  updatedAt: string;
  usedBy: number;
  fields: CredentialField[];
}

const credentialTypeConfig: Record<CredentialType, { icon: React.ReactNode; fields: Omit<CredentialField, 'value'>[] }> = {
  'Google OAuth2': {
    icon: <Mail className="w-5 h-5 text-red-500" />,
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' },
      { key: 'redirectUri', label: 'Redirect URI', type: 'url' },
    ],
  },
  'Slack OAuth2': {
    icon: <MessageSquare className="w-5 h-5 text-purple-500" />,
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' },
      { key: 'signingSecret', label: 'Signing Secret', type: 'password' },
    ],
  },
  'PostgreSQL': {
    icon: <Database className="w-5 h-5 text-blue-500" />,
    fields: [
      { key: 'host', label: 'Host', type: 'text' },
      { key: 'port', label: 'Port', type: 'text' },
      { key: 'database', label: 'Database', type: 'text' },
      { key: 'username', label: 'Username', type: 'text' },
      { key: 'password', label: 'Password', type: 'password' },
    ],
  },
  'API Key': {
    icon: <Key className="w-5 h-5 text-green-500" />,
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password' },
      { key: 'baseUrl', label: 'Base URL (optional)', type: 'url' },
    ],
  },
  'AWS Credentials': {
    icon: <Cloud className="w-5 h-5 text-orange-500" />,
    fields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text' },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password' },
      { key: 'region', label: 'Region', type: 'text' },
    ],
  },
  'HTTP Basic Auth': {
    icon: <Globe className="w-5 h-5 text-gray-500" />,
    fields: [
      { key: 'username', label: 'Username', type: 'text' },
      { key: 'password', label: 'Password', type: 'password' },
    ],
  },
};

const mockCredentials: Credential[] = [
  {
    id: '1',
    name: 'Gmail Account',
    type: 'Google OAuth2',
    icon: <Mail className="w-5 h-5 text-red-500" />,
    createdAt: '2024-01-10',
    updatedAt: '2024-01-15',
    usedBy: 3,
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', value: '123456789.apps.googleusercontent.com' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', value: 'GOCSPX-xxxxxxxxxx' },
      { key: 'redirectUri', label: 'Redirect URI', type: 'url', value: 'https://myapp.com/oauth/callback' },
    ],
  },
  {
    id: '2',
    name: 'Slack Workspace',
    type: 'Slack OAuth2',
    icon: <MessageSquare className="w-5 h-5 text-purple-500" />,
    createdAt: '2024-01-08',
    updatedAt: '2024-01-12',
    usedBy: 2,
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', value: 'xoxb-123456789' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', value: 'secret-key-here' },
      { key: 'signingSecret', label: 'Signing Secret', type: 'password', value: 'signing-secret' },
    ],
  },
  {
    id: '3',
    name: 'PostgreSQL Production',
    type: 'PostgreSQL',
    icon: <Database className="w-5 h-5 text-blue-500" />,
    createdAt: '2024-01-05',
    updatedAt: '2024-01-05',
    usedBy: 5,
    fields: [
      { key: 'host', label: 'Host', type: 'text', value: 'db.example.com' },
      { key: 'port', label: 'Port', type: 'text', value: '5432' },
      { key: 'database', label: 'Database', type: 'text', value: 'production' },
      { key: 'username', label: 'Username', type: 'text', value: 'admin' },
      { key: 'password', label: 'Password', type: 'password', value: 'supersecret123' },
    ],
  },
  {
    id: '4',
    name: 'OpenAI API',
    type: 'API Key',
    icon: <Cloud className="w-5 h-5 text-green-500" />,
    createdAt: '2024-01-03',
    updatedAt: '2024-01-14',
    usedBy: 8,
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', value: 'sk-xxxxxxxxxxxxxxxxxx' },
      { key: 'baseUrl', label: 'Base URL (optional)', type: 'url', value: 'https://api.openai.com/v1' },
    ],
  },
];

export default function Credentials() {
  const [searchQuery, setSearchQuery] = useState('');
  const [credentials, setCredentials] = useState<Credential[]>(mockCredentials);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<CredentialType | null>(null);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [viewingCredential, setViewingCredential] = useState<Credential | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [newCredentialName, setNewCredentialName] = useState('');
  const [newCredentialFields, setNewCredentialFields] = useState<CredentialField[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const filteredCredentials = credentials.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.type.toLowerCase().includes(searchQuery.toLowerCase())
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
    setNewCredentialName('');
    setNewCredentialFields(
      credentialTypeConfig[type].fields.map(f => ({ ...f, value: '' }))
    );
  };

  const handleSaveNewCredential = () => {
    if (!selectedType || !newCredentialName.trim()) return;

    const newCred: Credential = {
      id: `cred-${Date.now()}`,
      name: newCredentialName,
      type: selectedType,
      icon: credentialTypeConfig[selectedType].icon,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      usedBy: 0,
      fields: newCredentialFields,
    };

    setCredentials([...credentials, newCred]);
    setShowAddModal(false);
    setSelectedType(null);
    setNewCredentialName('');
    setNewCredentialFields([]);
  };

  const handleUpdateCredential = () => {
    if (!editingCredential) return;

    setCredentials(credentials.map(c => 
      c.id === editingCredential.id 
        ? { ...editingCredential, updatedAt: new Date().toISOString().split('T')[0] }
        : c
    ));
    setEditingCredential(null);
  };

  const handleDeleteCredential = (id: string) => {
    setCredentials(credentials.filter(c => c.id !== id));
    setShowDeleteConfirm(null);
    setOpenDropdown(null);
  };

  const updateFieldValue = (fieldKey: string, value: string, isEditing: boolean) => {
    if (isEditing && editingCredential) {
      setEditingCredential({
        ...editingCredential,
        fields: editingCredential.fields.map(f => 
          f.key === fieldKey ? { ...f, value } : f
        ),
      });
    } else {
      setNewCredentialFields(
        newCredentialFields.map(f => f.key === fieldKey ? { ...f, value } : f)
      );
    }
  };

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
                    {credential.icon}
                  </div>
                  <div>
                    <h3 className="font-medium group-hover:text-primary transition-colors">
                      {credential.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{credential.type}</p>
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
                  <Shield className="w-3 h-3" />
                  <span>Used by {credential.usedBy} workflows</span>
                </div>
                <span>Updated {credential.updatedAt}</span>
              </div>
            </div>
          ))}
        </div>

        {filteredCredentials.length === 0 && (
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
                  {viewingCredential.icon}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{viewingCredential.name}</h2>
                  <p className="text-sm text-muted-foreground">{viewingCredential.type}</p>
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
            <div className="p-6 space-y-4">
              {viewingCredential.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium mb-1">{field.label}</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm">
                      {field.type === 'password' && !visibleFields.has(field.key)
                        ? '••••••••••••'
                        : field.value}
                    </div>
                    {field.type === 'password' && (
                      <button
                        onClick={() => toggleFieldVisibility(field.key)}
                        className="p-2 hover:bg-muted rounded-md"
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
                      className="p-2 hover:bg-muted rounded-md"
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
                <p>Created: {viewingCredential.createdAt}</p>
                <p>Updated: {viewingCredential.updatedAt}</p>
              </div>
              <div className="flex gap-2">
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
            <div className="p-6 space-y-4">
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
                      onChange={(e) => updateFieldValue(field.key, e.target.value, true)}
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

      {/* Add Credential Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {selectedType ? `New ${selectedType}` : 'Add New Credential'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedType ? 'Enter your credential details' : 'Select the type of credential you want to add'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedType(null);
                }}
                className="p-1.5 hover:bg-muted rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {!selectedType ? (
              <div className="p-6 max-h-96 overflow-auto">
                <div className="grid gap-2">
                  {(Object.keys(credentialTypeConfig) as CredentialType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleSelectType(type)}
                      className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <div className="p-2 bg-muted rounded-lg">{credentialTypeConfig[type].icon}</div>
                      <span className="font-medium">{type}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4 max-h-96 overflow-auto">
                <div>
                  <label className="block text-sm font-medium mb-1">Credential Name</label>
                  <input
                    type="text"
                    value={newCredentialName}
                    onChange={(e) => setNewCredentialName(e.target.value)}
                    placeholder={`My ${selectedType}`}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {newCredentialFields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium mb-1">{field.label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type={field.type === 'password' && !visibleFields.has(field.key) ? 'password' : 'text'}
                        value={field.value}
                        onChange={(e) => updateFieldValue(field.key, e.target.value, false)}
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
            )}
            
            <div className="p-4 border-t border-border flex justify-end gap-2">
              {selectedType && (
                <button 
                  onClick={() => setSelectedType(null)}
                  className="px-4 py-2 border border-input rounded-md hover:bg-muted"
                >
                  Back
                </button>
              )}
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedType(null);
                }}
                className="px-4 py-2 border border-input rounded-md hover:bg-muted"
              >
                Cancel
              </button>
              {selectedType && (
                <button 
                  onClick={handleSaveNewCredential}
                  disabled={!newCredentialName.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  Create Credential
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
