import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileJson, AlertCircle, CheckCircle, Clipboard } from 'lucide-react';
import { parseWorkflow, readFileAsText, type ValidationError } from '../../lib/workflowSerializer';
import { type Node, type Edge } from 'reactflow';

interface ImportWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (nodes: Node[], edges: Edge[], name: string) => void;
}

export default function ImportWorkflowModal({ isOpen, onClose, onImport }: ImportWorkflowModalProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ nodes: number; edges: number; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleValidate = useCallback((json: string) => {
    if (!json.trim()) {
      setErrors([]);
      setPreviewData(null);
      return;
    }

    const result = parseWorkflow(json);
    setErrors(result.errors);
    
    if (result.errors.filter(e => e.type === 'error').length === 0) {
      setPreviewData({
        nodes: result.nodes.length,
        edges: result.edges.length,
        name: result.name,
      });
    } else {
      setPreviewData(null);
    }
  }, []);

  const handleJsonChange = (value: string) => {
    setJsonInput(value);
    handleValidate(value);
  };

  const handleFileUpload = async (file: File) => {
    try {
      const content = await readFileAsText(file);
      setFileName(file.name);
      setJsonInput(content);
      handleValidate(content);
    } catch (error) {
      setErrors([{ type: 'error', message: 'Failed to read file' }]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
      handleFileUpload(file);
    } else {
      setErrors([{ type: 'error', message: 'Please drop a valid JSON file' }]);
    }
  }, []);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJsonInput(text);
      handleValidate(text);
    } catch {
      setErrors([{ type: 'error', message: 'Failed to paste from clipboard' }]);
    }
  };

  const handleImport = () => {
    const result = parseWorkflow(jsonInput);
    if (result.errors.filter(e => e.type === 'error').length === 0) {
      onImport(result.nodes, result.edges, result.name);
      handleClose();
    }
  };

  const handleClose = () => {
    setJsonInput('');
    setErrors([]);
    setFileName(null);
    setPreviewData(null);
    onClose();
  };

  if (!isOpen) return null;

  const hasErrors = errors.filter(e => e.type === 'error').length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <FileJson className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Import Workflow</h2>
              <p className="text-sm text-[var(--text-secondary)]">Upload or paste workflow JSON</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
              ${isDragging 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-[var(--border-primary)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-secondary)]'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="hidden"
            />
            <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-blue-500' : 'text-[var(--text-secondary)]'}`} />
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {fileName ? fileName : 'Drop JSON file here or click to upload'}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Supports .json workflow exports
            </p>
          </div>

          {/* Or Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-[var(--border-primary)]" />
            <span className="text-xs text-[var(--text-secondary)]">OR</span>
            <div className="flex-1 border-t border-[var(--border-primary)]" />
          </div>

          {/* JSON Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[var(--text-primary)]">Paste JSON</label>
              <button
                onClick={handlePaste}
                className="flex items-center gap-1.5 text-xs text-[var(--accent-primary)] hover:underline"
              >
                <Clipboard className="w-3 h-3" />
                Paste from clipboard
              </button>
            </div>
            <textarea
              value={jsonInput}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder='{"version": "1.0.0", "nodes": [...], "edges": [...]}'
              className="w-full h-40 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
            />
          </div>

          {/* Validation Errors */}
          {errors.length > 0 && (
            <div className="space-y-2">
              {errors.map((error, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                    error.type === 'error' 
                      ? 'bg-red-500/10 text-red-400' 
                      : 'bg-yellow-500/10 text-yellow-400'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          {previewData && (
            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-green-400">Workflow valid!</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  "{previewData.name}" • {previewData.nodes} nodes • {previewData.edges} connections
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!previewData || hasErrors}
            className={`
              px-4 py-2 text-sm font-bold rounded-lg transition-all
              ${!previewData || hasErrors
                ? 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-not-allowed'
                : 'bg-[var(--accent-primary)] text-white hover:opacity-90'
              }
            `}
          >
            Import Workflow
          </button>
        </div>
      </div>
    </div>
  );
}
