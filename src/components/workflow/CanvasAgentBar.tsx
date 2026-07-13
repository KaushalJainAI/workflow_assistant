import React, { useState } from 'react';
import { Sparkles, Loader2, Send } from 'lucide-react';
import type { Node, Edge } from 'reactflow';
import { useCanvasAgent } from '../../hooks/useCanvasAgent';

interface CanvasAgentBarProps {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
  onConnect: (connection: any) => void;
}

export default function CanvasAgentBar({
  nodes,
  edges,
  setNodes,
  setEdges,
  onConnect,
}: CanvasAgentBarProps) {
  const [input, setInput] = useState('');
  const { isConnected, isProcessing, sendInstruction } = useCanvasAgent({
    setNodes,
    setEdges,
    onConnect,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    sendInstruction(input, { nodes, edges });
    setInput('');
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-card/80 backdrop-blur-md border border-border rounded-xl shadow-2xl min-w-[400px] transition-all duration-300 hover:shadow-primary/10">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
        <Sparkles className="w-4 h-4" />
      </div>
      
      <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI to modify the canvas..."
          className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground py-1"
          disabled={isProcessing}
        />
        
        <button
          type="submit"
          disabled={!input.trim() || isProcessing || !isConnected}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-secondary disabled:opacity-50 disabled:hover:bg-transparent"
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <Send className="w-4 h-4 text-primary" />
          )}
        </button>
      </form>

      {!isConnected && (
        <div className="text-[10px] text-destructive font-medium px-2 py-0.5 rounded-full bg-destructive/10">
          Disconnected
        </div>
      )}
    </div>
  );
}
