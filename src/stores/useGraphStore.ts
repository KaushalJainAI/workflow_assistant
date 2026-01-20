import { create } from 'zustand';
import { 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge,
  type Edge, 
  type Node, 
  type OnNodesChange, 
  type OnEdgesChange, 
  type OnConnect, 
  type Connection,
  type XYPosition
} from 'reactflow';

// We'll import our custom data types later
interface CustomNodeData {
  label: string;
  [key: string]: any;
}

interface GraphState {
  nodes: Node<CustomNodeData>[];
  edges: Edge[];
  
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  
  addNode: (node: Node<CustomNodeData>) => void;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, data: any) => void;
  setPannedPosition: (position: XYPosition) => void;
  setNodes: (nodes: Node<CustomNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection: Connection) => {
    set({
      edges: addEdge({ 
        ...connection, 
        animated: true, 
        style: { stroke: '#888', strokeWidth: 2 } 
      }, get().edges),
    });
  },

  addNode: (node) => {
    set({ nodes: [...get().nodes, node] });
  },

  removeNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    });
  },
  
  updateNodeData: (id, newData) => {
    set({
      nodes: get().nodes.map((n) => 
        n.id === id ? { ...n, data: { ...n.data, ...newData } } : n
      ),
    });
  },

  setPannedPosition: (position) => {
      // Logic for tracking pan position if needed for drops
  }
}));
