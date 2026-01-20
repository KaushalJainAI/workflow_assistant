import { useState } from 'react';
import { 
  Download, 
  Image, 
  FileText, 
  Link2, 
  Copy, 
  Check,
  X,
  Share2
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface ExportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workflowName: string;
  nodes: any[];
  edges: any[];
  onExportImage: () => Promise<string | null>;
}

export default function ExportPanel({ 
  isOpen, 
  onClose, 
  workflowName,
  nodes,
  edges,
  onExportImage
}: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState('');

  const handleExportJSON = () => {
    const workflow = {
      name: workflowName,
      nodes,
      edges,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportImage = async () => {
    setIsExporting(true);
    try {
      const imageUrl = await onExportImage();
      if (imageUrl) {
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = `${workflowName.replace(/\s+/g, '_')}.png`;
        a.click();
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateDoc = () => {
    let doc = `# ${workflowName}\n\n`;
    doc += `**Exported:** ${new Date().toLocaleString()}\n\n`;
    doc += `## Overview\n\n`;
    doc += `This workflow contains **${nodes.length} nodes** and **${edges.length} connections**.\n\n`;
    doc += `## Nodes\n\n`;
    
    nodes.forEach((node, index) => {
      doc += `### ${index + 1}. ${node.data?.label || node.type}\n\n`;
      doc += `- **Type:** ${node.type}\n`;
      doc += `- **ID:** \`${node.id}\`\n`;
      if (node.data?.description) {
        doc += `- **Description:** ${node.data.description}\n`;
      }
      doc += '\n';
    });

    doc += `## Connections\n\n`;
    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      doc += `- ${sourceNode?.data?.label || edge.source} → ${targetNode?.data?.label || edge.target}\n`;
    });

    const blob = new Blob([doc], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.replace(/\s+/g, '_')}_documentation.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateShareLink = () => {
    // In real implementation, this would call an API to create a shareable link
    const mockLink = `https://nexus.app/share/${btoa(workflowName).slice(0, 12)}`;
    setShareLink(mockLink);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-card border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Share2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Export & Share</h2>
              <p className="text-sm text-muted-foreground">{workflowName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Export options */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Export</h3>
            
            <button
              onClick={handleExportJSON}
              className="w-full flex items-center gap-3 p-4 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-all group"
            >
              <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                <Download className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">Export as JSON</div>
                <div className="text-xs text-muted-foreground">Download workflow definition file</div>
              </div>
            </button>

            <button
              onClick={handleExportImage}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-4 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-all group disabled:opacity-50"
            >
              <div className="p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                <Image className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">
                  {isExporting ? 'Exporting...' : 'Export as Image'}
                </div>
                <div className="text-xs text-muted-foreground">Download PNG screenshot of workflow</div>
              </div>
            </button>

            <button
              onClick={handleGenerateDoc}
              className="w-full flex items-center gap-3 p-4 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-all group"
            >
              <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                <FileText className="w-5 h-5 text-purple-500" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">Generate Documentation</div>
                <div className="text-xs text-muted-foreground">Create markdown documentation file</div>
              </div>
            </button>
          </div>

          {/* Share link */}
          <div className="space-y-3 pt-4 border-t">
            <h3 className="text-sm font-semibold text-muted-foreground">Share</h3>
            
            {!shareLink ? (
              <button
                onClick={handleGenerateShareLink}
                className="w-full flex items-center gap-3 p-4 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-all group"
              >
                <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
                  <Link2 className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">Create Share Link</div>
                  <div className="text-xs text-muted-foreground">Generate a read-only preview link</div>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 bg-transparent text-sm font-mono outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className={cn(
                    "p-2 rounded transition-colors",
                    copied ? "bg-green-500 text-white" : "hover:bg-background"
                  )}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
