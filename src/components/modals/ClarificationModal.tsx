import { useState } from 'react';
import { X, HelpCircle, Send } from 'lucide-react';

interface ClarificationModalProps {
  isOpen: boolean;
  question: string;
  options?: string[];
  allowCustomInput?: boolean;
  onRespond: (response: string) => void;
  onClose: () => void;
}

export default function ClarificationModal({
  isOpen,
  question,
  options = [],
  allowCustomInput = true,
  onRespond,
  onClose,
}: ClarificationModalProps) {
  const [customInput, setCustomInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const response = selectedOption || customInput;
    if (response.trim()) {
      onRespond(response);
      setCustomInput('');
      setSelectedOption(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <HelpCircle className="w-6 h-6 text-blue-500" />
              </div>
              <h2 className="text-xl font-bold">Clarification Needed</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-full">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          
          <p className="text-lg font-medium mb-6">{question}</p>
          
          <div className="space-y-4">
            {/* Options */}
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  setSelectedOption(option);
                  onRespond(option);
                }}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                  selectedOption === option
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                    : 'border-border hover:border-blue-300 hover:bg-muted'
                }`}
              >
                {option}
              </button>
            ))}

            {/* Custom Input */}
            {allowCustomInput && (
              <form onSubmit={handleSubmit} className="mt-4">
                <label className="block text-sm text-muted-foreground mb-2">
                  {options.length > 0 ? 'Or type your answer:' : 'Your answer:'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => {
                      setCustomInput(e.target.value);
                      setSelectedOption(null);
                    }}
                    placeholder="Type here..."
                    className="flex-1 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!customInput.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
