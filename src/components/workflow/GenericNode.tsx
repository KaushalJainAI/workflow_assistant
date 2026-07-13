import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { 
  Play, FileText, Globe, Box, Clock, Hash, CheckSquare, 
  Settings, Mail, MessageSquare, Database, Layout, 
  Zap, List, Calendar, Code, Scissors, Layers, 
  Search, Lock, HardDrive, Cpu, Shield, Share2, Plus,
  AlertCircle, AlertTriangle, Sparkles
} from 'lucide-react';
import { nodeConfigs } from '../../lib/nodeConfigs';

// Icon mapping - expanded for n8n nodes
const IconMap: Record<string, any> = {
  Play: Play,
  FileText: FileText,
  Globe: Globe,
  Box: Box,
  Clock: Clock,
  Hash: Hash,
  CheckSquare: CheckSquare,
  Settings: Settings,
  Mail: Mail,
  MessageSquare: MessageSquare,
  Database: Database,
  Layout: Layout,
  Zap: Zap,
  List: List,
  Calendar: Calendar,
  Code: Code,
  Scissors: Scissors,
  Layers: Layers,
  Search: Search,
  Lock: Lock,
  HardDrive: HardDrive,
  Cpu: Cpu,
  Shield: Shield,
  Share2: Share2,
  Sparkles: Sparkles,
};

const GenericNode = ({ data, selected, type }: NodeProps) => {
  // Use nodeConfigs instead of nodeRegistry
  const nodeType = data.nodeType || type || '';
  const config = nodeConfigs[nodeType];
  
  // Fallback defaults
  const label = String(data.label || config?.displayName || 'Unknown Node');
  const color = data.color || config?.color || '#777';
  const iconName = data.icon || config?.icon || 'Box';
  const Icon = IconMap[iconName] || Box;

  // Determine handles — prefer user-customized handles in data over static config defaults
  const inputs = data.inputs || config?.inputs || (nodeType.includes('trigger') ? [] : ['main']);
  const outputs = data.outputs || config?.outputs || ['main'];

  // Helper to get string ID from handle (works for both string and object handles)
  const getHandleId = (handle: any) => typeof handle === 'object' ? handle.id : handle;

  return (
    <div 
      className={`px-4 py-3 rounded-lg border-2 shadow-lg transition-all min-w-[140px] relative bg-card ${
        selected ? 'border-primary shadow-xl scale-105' : 
        data.executionStatus === 'running' ? 'border-blue-500 shadow-blue-500/20 shadow-md ring-2 ring-blue-500/20 animate-pulse-glow' :
        data.executionStatus === 'completed' ? 'border-green-500 shadow-green-500/20 shadow-md' :
        data.executionStatus === 'failed' ? 'border-destructive shadow-red-500/20 shadow-md' :
        data.validationError?.type === 'error' ? 'border-destructive shadow-red-500/20 shadow-md' :
        data.validationError?.type === 'warning' ? 'border-yellow-500 shadow-yellow-500/20 shadow-md' :
        'border-border/50 dark:border-border'
      }`}
      style={{ 
        minHeight: `${Math.max(40, Math.max(inputs.length, outputs.length) * 25 + 20)}px`,
      }}
    >
      {/* Clipping mask for top bar - ensures it follows rounded corners exactly without clipping badges */}
      <div className="absolute inset-0 rounded-[7px] overflow-hidden pointer-events-none">
        <div 
          className="absolute top-0 left-0 right-0 h-1.5 opacity-90"
          style={{ backgroundColor: color }}
        />
      </div>

      {/* Validation Indicator */}
      {data.validationError && (
        <div className="absolute -top-2 -right-2 z-20 bg-background rounded-full shadow-md">
          {data.validationError.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-destructive fill-background" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-yellow-500 fill-background" />
          )}
        </div>
      )}
      {/* Execution Status Badge */}
      {data.executionStatus && (
        <div className={`absolute -top-2 left-1/2 -translate-x-1/2 z-20 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white shadow-sm flex items-center gap-1 animate-in zoom-in duration-200 whitespace-nowrap ${
          data.executionStatus === 'running' ? 'bg-blue-500' :
          data.executionStatus === 'completed' ? 'bg-green-500' :
          data.executionStatus === 'failed' ? 'bg-destructive' :
          'bg-slate-500/80 shadow-none'
        }`}>
          {data.executionStatus === 'running' && <Play className="w-2 h-2 fill-current animate-pulse" />}
          {data.executionStatus === 'completed' && <CheckSquare className="w-2 h-2" />}
          {data.executionStatus === 'failed' && <AlertCircle className="w-2 h-2" />}
          {data.executionStatus === 'pending' ? 'NOT STARTED' : data.executionStatus.toUpperCase()}
        </div>
      )}



      {/* Input handles */}
      {inputs.map((input: any, index: number) => {
        const handleId = getHandleId(input);
        const topPercent = inputs.length === 1 ? 50 : 20 + (index * (60 / (inputs.length - 1)));
        return (
          <Handle 
            key={`in-${index}`}
            type="target" 
            position={Position.Left}
            id={handleId === 'main' ? `input-${index}` : handleId}
            style={{ top: `${topPercent}%`, marginTop: '-8px' }}
            className="w-4 h-4 border-2 border-background bg-muted-foreground/50 hover:bg-primary hover:scale-125 transition-all duration-200"
          />
        );
      })}
      
      <div className="flex items-center gap-3 min-h-[40px]">
        <div 
            className="w-8 h-8 rounded flex items-center justify-center text-white shadow-sm shrink-0"
            style={{ backgroundColor: color }}
        >
            {IconMap[iconName] ? (
              <Icon className="w-5 h-5" />
            ) : (
              <span className="text-lg">{iconName}</span>
            )}
        </div>
        <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm leading-tight truncate">{label}</div>
            {data.executionStatus === 'failed' && data.errorMessage && (
              <div className="text-[10px] text-destructive font-mono mt-1 line-clamp-2 bg-destructive/5 px-1 py-0.5 rounded border border-destructive/10 max-w-[120px]" title={data.errorMessage}>
                {data.errorMessage}
              </div>
            )}
        </div>
      </div>
      
      {/* Output handles */}
      {outputs.map((output: any, index: number) => {
        const handleId = getHandleId(output);
        const topPercent = outputs.length === 1 ? 50 : 20 + (index * (60 / (outputs.length - 1)));
        const actualHandleId = handleId === 'main' ? `output-${index}` : handleId;
        const connectedHandles = data.connectedHandles as Set<string> | undefined;
        const isHandleConnected = connectedHandles?.has(actualHandleId) || false;
        const showAddButton = !isHandleConnected && data.onAddNodeFromHandle;
        return (
          <div key={`out-${index}`}>
            <Handle 
              type="source" 
              position={Position.Right}
              id={handleId === 'main' ? `output-${index}` : handleId}
              style={{ top: `${topPercent}%`, marginTop: '-8px' }}
              className="w-4 h-4 border-2 border-background bg-muted-foreground/50 hover:bg-primary hover:scale-125 transition-all duration-200"
            />
            {/* Add node button for unconnected outputs */}
            {showAddButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onAddNodeFromHandle(data.nodeId, actualHandleId);
                }}
                className="absolute w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:shadow-primary/20 hover:scale-110 transition-all duration-200 nodrag border-2 border-background z-10"
                style={{ top: `${topPercent}%`, transform: 'translateY(-50%)', right: '-40px' }}
                title="Add node"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default memo(GenericNode);
