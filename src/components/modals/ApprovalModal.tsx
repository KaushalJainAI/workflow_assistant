import { X, Check, XCircle } from 'lucide-react';

interface ApprovalModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  data?: Record<string, any>;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

export default function ApprovalModal({
  isOpen,
  title,
  description,
  data,
  onApprove,
  onReject,
  onClose,
}: ApprovalModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold">{title}</h2>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-full">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          
          <p className="text-muted-foreground mb-4">{description}</p>
          
          {data && (
            <div className="bg-muted p-3 rounded-lg text-sm font-mono mb-6 overflow-x-auto">
              <pre>{JSON.stringify(data, null, 2)}</pre>
            </div>
          )}
          
          <div className="flex gap-3 mt-6">
            <button
              onClick={onReject}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 font-semibold rounded-lg transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
            <button
              onClick={onApprove}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 font-semibold rounded-lg transition-colors shadow-sm"
            >
              <Check className="w-4 h-4" />
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
