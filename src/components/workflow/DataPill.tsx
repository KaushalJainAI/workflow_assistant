import { useCallback } from 'react';
import { GripVertical, Hash, Type, ToggleLeft, Braces, List } from 'lucide-react';

interface DataPillProps {
  /** Display label, e.g. "name" */
  label: string;
  /** Full expression path, e.g. $node["HTTP Request"].json.data.name */
  path: string;
  /** Color from the source node */
  color: string;
  /** Data type of the value */
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'unknown';
  /** Optional sample value to show in tooltip */
  sampleValue?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

const TYPE_ICONS: Record<string, typeof Type> = {
  string: Type,
  number: Hash,
  boolean: ToggleLeft,
  object: Braces,
  array: List,
};

export default function DataPill({
  label,
  path,
  color,
  type = 'unknown',
  sampleValue,
  size = 'md',
}: DataPillProps) {
  const Icon = TYPE_ICONS[type] || Type;

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      // Set the expression as drag data
      const expression = `{{ ${path} }}`;
      e.dataTransfer.setData('text/plain', expression);
      e.dataTransfer.setData('application/x-data-pill', JSON.stringify({ path, label, color, type }));
      e.dataTransfer.effectAllowed = 'copy';

      // Create a custom drag image
      const ghost = document.createElement('div');
      ghost.textContent = label;
      ghost.style.cssText = `
        position: absolute; top: -1000px; left: -1000px;
        background: ${color}; color: white;
        padding: 4px 10px; border-radius: 12px;
        font-size: 12px; font-weight: 600;
        font-family: system-ui, sans-serif;
        white-space: nowrap;
      `;
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
      setTimeout(() => document.body.removeChild(ghost), 0);
    },
    [path, label, color, type]
  );

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px] gap-1'
    : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`
        inline-flex items-center ${sizeClasses} rounded-full font-semibold
        cursor-grab active:cursor-grabbing select-none
        transition-all duration-150
        hover:shadow-md hover:scale-105 hover:brightness-110
        group
      `}
      style={{
        backgroundColor: `${color}18`,
        color: color,
        border: `1.5px solid ${color}40`,
      }}
      title={sampleValue ? `${path}\n\nValue: ${sampleValue}` : path}
    >
      <GripVertical
        className={`${size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} opacity-40 group-hover:opacity-70 transition-opacity shrink-0`}
      />
      <Icon className={`${size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} opacity-60 shrink-0`} />
      <span className="truncate max-w-[120px]">{label}</span>
    </div>
  );
}
