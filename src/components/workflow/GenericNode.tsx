import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { 
  Play, FileText, Globe, Box, Clock, Hash, CheckSquare, 
  Settings, Mail, MessageSquare, Database, Layout, 
  Zap, List, Calendar, Code, Scissors, Layers, 
  Search, Lock, HardDrive, Cpu, Shield, Share2
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

  // Determine handles from config or fallbacks
  const inputs = config?.inputs || data.inputs || (nodeType.includes('trigger') ? [] : ['main']);
  const outputs = config?.outputs || data.outputs || ['main'];

  // Helper to get string ID from handle (works for both string and object handles)
  const getHandleId = (handle: any) => typeof handle === 'object' ? handle.id : handle;
  const getHandleLabel = (handle: any) => typeof handle === 'object' ? handle.label : handle;

  return (
    <div 
      className={`px-4 py-3 rounded-lg border-2 shadow-md transition-all min-w-[140px] relative bg-card ${
        selected ? 'border-primary shadow-lg scale-105' : 'border-transparent'
      }`}
      style={{ 
        minHeight: `${Math.max(40, Math.max(inputs.length, outputs.length) * 25 + 20)}px`,
      }}
    >
      {/* Decorative top bar for color */}
      <div 
        className="absolute top-0 left-0 right-0 h-1 rounded-t-lg opacity-80"
        style={{ backgroundColor: color }}
      />

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
            style={{ top: `${topPercent}%`, background: '#fff' }}
            className="w-3 h-3 border-2 border-border"
          />
        );
      })}
      
      <div className="flex items-center gap-3 pt-1">
        <div 
            className="w-8 h-8 rounded flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: color }}
        >
            {IconMap[iconName] ? (
              <Icon className="w-5 h-5" />
            ) : (
              <span className="text-lg">{iconName}</span>
            )}
        </div>
        <div>
            <div className="font-semibold text-sm leading-tight">{label}</div>
        </div>
      </div>
      
      {/* Output handles */}
      {outputs.map((output: any, index: number) => {
        const handleId = getHandleId(output);
        const handleLabel = getHandleLabel(output);
        const topPercent = outputs.length === 1 ? 50 : 20 + (index * (60 / (outputs.length - 1)));
        return (
          <div key={`out-${index}`}>
            <Handle 
              type="source" 
              position={Position.Right}
              id={handleId === 'main' ? `output-${index}` : handleId}
              style={{ top: `${topPercent}%`, background: '#fff' }}
              className="w-3 h-3 border-2 border-border"
            />
             {/* Only show label if it's not 'main' or if there are multiple outputs */}
            {(handleId !== 'main' || outputs.length > 1) && (
              <span 
                className="absolute text-[9px] text-muted-foreground font-medium whitespace-nowrap"
                style={{ top: `${topPercent - 6}%`, right: '-35px' }}
              >
                {handleLabel}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default memo(GenericNode);
