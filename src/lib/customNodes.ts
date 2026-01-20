import { type ConfigField } from './nodeConfigs';

export interface CustomNodeMetadata {
  id: string;
  baseNodeTypeId: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  config: Record<string, unknown>;
  fields?: ConfigField[]; // Dynamic schema for the node
  code?: string; // Execution logic (Python/JS)
  isBuilderNode?: boolean; // Flag to identify if this is a full node type def
  createdAt: number;
}

const STORAGE_KEY = 'n8n_custom_nodes';

export const getCustomNodes = (): CustomNodeMetadata[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load custom nodes from localStorage', error);
    return [];
  }
};

export const saveCustomNode = (node: Omit<CustomNodeMetadata, 'id' | 'createdAt'>): CustomNodeMetadata => {
  const nodes = getCustomNodes();
  
  const newNode: CustomNodeMetadata = {
    ...node,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };

  const updatedNodes = [...nodes, newNode];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNodes));
  return newNode;
};

export const deleteCustomNode = (id: string): void => {
  const nodes = getCustomNodes();
  const updatedNodes = nodes.filter(node => node.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNodes));
};

export const getCustomCategories = (): string[] => {
  const nodes = getCustomNodes();
  const categories = new Set(nodes.map(node => node.category));
  return Array.from(categories);
};
