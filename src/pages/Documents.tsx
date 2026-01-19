import { useState } from 'react';
import { 
  FileText, 
  Upload, 
  Search, 
  MoreVertical, 
  Folder,
  File,
  Image,
  FileJson,
  FileCode,
  Trash2,
  Download,
  Eye,
  Plus,
  FolderPlus,
  X
} from 'lucide-react';

interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'txt' | 'json' | 'csv' | 'image' | 'code' | 'folder';
  size?: string;
  updatedAt: string;
  usedBy: number;
  path: string;
}

const mockDocuments: Document[] = [
  { id: '1', name: 'Customer Data', type: 'folder', updatedAt: '2024-01-15', usedBy: 5, path: '/' },
  { id: '2', name: 'product_catalog.json', type: 'json', size: '2.4 MB', updatedAt: '2024-01-14', usedBy: 3, path: '/' },
  { id: '3', name: 'email_templates.txt', type: 'txt', size: '45 KB', updatedAt: '2024-01-13', usedBy: 2, path: '/' },
  { id: '4', name: 'api_config.json', type: 'json', size: '12 KB', updatedAt: '2024-01-12', usedBy: 8, path: '/' },
  { id: '5', name: 'logo.png', type: 'image', size: '156 KB', updatedAt: '2024-01-11', usedBy: 1, path: '/' },
  { id: '6', name: 'transform_script.py', type: 'code', size: '8 KB', updatedAt: '2024-01-10', usedBy: 4, path: '/' },
  { id: '7', name: 'user_report.pdf', type: 'pdf', size: '1.2 MB', updatedAt: '2024-01-09', usedBy: 2, path: '/' },
  { id: '8', name: 'sales_data.csv', type: 'csv', size: '5.6 MB', updatedAt: '2024-01-08', usedBy: 6, path: '/' },
];

export default function Documents() {
  const [searchQuery, setSearchQuery] = useState('');
  const [documents] = useState<Document[]>(mockDocuments);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDocIcon = (type: Document['type']) => {
    const iconClass = "w-8 h-8";
    switch (type) {
      case 'folder': return <Folder className={`${iconClass} text-yellow-500`} />;
      case 'pdf': return <FileText className={`${iconClass} text-red-500`} />;
      case 'json': return <FileJson className={`${iconClass} text-green-500`} />;
      case 'code': return <FileCode className={`${iconClass} text-purple-500`} />;
      case 'image': return <Image className={`${iconClass} text-pink-500`} />;
      case 'csv': return <FileText className={`${iconClass} text-blue-500`} />;
      default: return <File className={`${iconClass} text-gray-500`} />;
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedDocs(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Documents</h1>
              <p className="text-sm text-muted-foreground">
                Manage files and data sources for your workflows
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              className="flex items-center gap-2 px-3 py-2 border border-input rounded-md hover:bg-muted"
            >
              <FolderPlus className="w-4 h-4" />
              New Folder
            </button>
            <button 
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
          </div>
        </div>

        {/* Search and View Toggle */}
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2 bg-muted rounded-md p-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded text-sm ${viewMode === 'grid' ? 'bg-background shadow' : ''}`}
            >
              Grid
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded text-sm ${viewMode === 'list' ? 'bg-background shadow' : ''}`}
            >
              List
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedDocs.length > 0 && (
          <div className="mt-4 flex items-center gap-4 p-3 bg-primary/5 rounded-lg">
            <span className="text-sm font-medium">{selectedDocs.length} selected</span>
            <button className="flex items-center gap-1 text-sm hover:text-primary">
              <Download className="w-4 h-4" /> Download
            </button>
            <button className="flex items-center gap-1 text-sm text-destructive hover:text-destructive/80">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button 
              onClick={() => setSelectedDocs([])}
              className="ml-auto text-sm text-muted-foreground hover:text-foreground"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* Documents Grid/List */}
      <div className="flex-1 overflow-auto p-6">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                onClick={() => toggleSelect(doc.id)}
                className={`p-4 bg-card border rounded-lg hover:border-primary/50 cursor-pointer transition-all group ${
                  selectedDocs.includes(doc.id) ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3 relative">
                    {getDocIcon(doc.type)}
                    {selectedDocs.includes(doc.id) && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="font-medium text-sm truncate w-full">{doc.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {doc.size || `${doc.usedBy} workflows`}
                  </p>
                </div>
                <button 
                  className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-muted rounded"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                onClick={() => toggleSelect(doc.id)}
                className={`flex items-center gap-4 p-4 bg-card border rounded-lg hover:border-primary/50 cursor-pointer transition-all ${
                  selectedDocs.includes(doc.id) ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <input 
                  type="checkbox" 
                  checked={selectedDocs.includes(doc.id)}
                  onChange={() => {}}
                  className="w-4 h-4"
                />
                {getDocIcon(doc.type)}
                <div className="flex-1">
                  <p className="font-medium">{doc.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {doc.type === 'folder' ? `${doc.usedBy} items` : doc.size}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  Used by {doc.usedBy} workflows
                </div>
                <div className="text-sm text-muted-foreground">
                  {doc.updatedAt}
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-2 hover:bg-muted rounded-md" onClick={(e) => e.stopPropagation()}>
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-muted rounded-md" onClick={(e) => e.stopPropagation()}>
                    <Download className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-muted rounded-md" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredDocuments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No documents found</h3>
            <p className="text-muted-foreground mb-4">
              Upload documents to use in your workflows
            </p>
            <button 
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Upload className="w-4 h-4" />
              Upload Document
            </button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-semibold">Upload Documents</h2>
              <button onClick={() => setShowUploadModal(false)} className="p-1 hover:bg-muted rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="font-medium mb-2">Drop files here or click to upload</p>
                <p className="text-sm text-muted-foreground">
                  Supports PDF, JSON, CSV, TXT, Images, and Code files
                </p>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                <p>• Maximum file size: 50MB</p>
                <p>• Files will be available across all workflows</p>
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button 
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 border border-input rounded-md hover:bg-muted"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
