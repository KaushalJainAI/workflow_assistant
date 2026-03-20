import { useMemo } from 'react';

interface TableViewProps {
  data: unknown[];
  className?: string;
}

export default function TableView({ data, className = '' }: TableViewProps) {
  // Extract all unique keys from all objects to form columns
  const columns = useMemo(() => {
    const keys = new Set<string>();
    data.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        // Handle n8n-style structure where data is in 'json' property
        const source = (item as any).json || item;
        Object.keys(source).forEach(key => keys.add(key));
      }
    });
    return Array.from(keys);
  }, [data]);

  const renderCell = (value: unknown) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground italic">null</span>;
    if (typeof value === 'object') return <span className="text-xs font-mono text-muted-foreground">{JSON.stringify(value)}</span>;
    if (typeof value === 'boolean') return <span className={value ? 'text-green-600' : 'text-red-600'}>{String(value)}</span>;
    return String(value);
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No data to display
      </div>
    );
  }

  return (
    <div className={`overflow-auto border border-border rounded-md ${className}`}>
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-muted/50 sticky top-0 z-10">
          <tr>
            <th className="p-2 border-b border-border w-10">#</th>
            {columns.map(col => (
              <th key={col} className="p-2 border-b border-border font-medium text-muted-foreground whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row: any, rowIndex) => {
            const rowData = row.json || row;
            
            return (
              <tr key={rowIndex} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="p-2 text-xs text-muted-foreground font-mono border-r border-border/50">
                  {rowIndex + 1}
                </td>
                {columns.map(col => (
                  <td key={`${rowIndex}-${col}`} className="p-2 border-r border-border/50 max-w-[200px] truncate" title={String(rowData[col])}>
                    {renderCell(rowData[col])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
