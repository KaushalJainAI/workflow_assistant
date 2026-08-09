import { useState, useCallback } from 'react';
import type { Node, Edge } from 'reactflow';
import apiClient from '../api/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../lib/websocket';

interface CanvasAction {
  action_type: string;
  payload: any;
}

interface UseCanvasAgentOptions {
  setNodes?: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges?: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
  onConnect?: (connection: any) => void;
}

export function useCanvasAgent(options: UseCanvasAgentOptions = {}) {
  const { setNodes, setEdges, onConnect } = options;
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const handleActions = useCallback((actions: CanvasAction[]) => {
    actions.forEach((action) => {
      const { action_type, payload } = action;

      switch (action_type) {
        case 'navigate':
          if (payload.path) {
            navigate(payload.path);
          }
          break;

        case 'show_toast':
          if (payload.type === 'success') toast.success(payload.message);
          else if (payload.type === 'error') toast.error(payload.message);
          else toast(payload.message);
          break;

        case 'open_modal':
          // Can be hooked into a global modal state manager later
          break;

        case 'add_node':
          if (setNodes) {
            const newNode: Node = {
              // Honor an agent-provided id so connect_nodes in the same batch can
              // reference freshly-added nodes; fall back to a generated id.
              id: payload.id || `node-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              type: 'generic',
              position: payload.position,
              data: {
                label: payload.label,
                nodeType: payload.node_type,
                ...payload.config,
              },
            };
            setNodes((nds) => [...nds, newNode]);
          }
          break;

        case 'update_node':
          if (setNodes) {
            setNodes((nds) =>
              nds.map((n) =>
                n.id === payload.node_id
                  ? { ...n, data: { ...n.data, ...payload.data } }
                  : n
              )
            );
          }
          break;

        case 'remove_node':
          if (setNodes && setEdges) {
            setNodes((nds) => nds.filter((n) => n.id !== payload.node_id));
            setEdges((eds) =>
              eds.filter(
                (e) => e.source !== payload.node_id && e.target !== payload.node_id
              )
            );
          }
          break;

        case 'connect_nodes':
          if (onConnect) {
            onConnect({
              source: payload.source_id,
              target: payload.target_id,
              sourceHandle: payload.source_handle || 'output-0',
              targetHandle: payload.target_handle || 'input-0',
            });
          }
          break;

        case 'disconnect_nodes':
          if (setEdges) {
            setEdges((eds) =>
              eds.filter(
                (e) =>
                  !(
                    e.source === payload.source_id &&
                    e.target === payload.target_id
                  )
              )
            );
          }
          break;

        case 'clear_canvas':
          if (setNodes && setEdges) {
            setNodes([]);
            setEdges([]);
          }
          break;

        case 'replace_canvas':
          if (setNodes && setEdges) {
            const normalizedNodes = payload.nodes.map((n: any) => ({
              ...n,
              type: 'generic',
            }));
            setNodes(normalizedNodes);
            setEdges(payload.edges);
          }
          break;

        default:
          console.warn(`Unknown action type: ${action_type}`);
      }
    });
  }, [setNodes, setEdges, onConnect, navigate]);

  const handleMessage = useCallback((data: any) => {
    if (data.type === 'canvas_action') handleActions(data.actions);
  }, [handleActions]);

  const { isConnected, send } = useSocket({
    path: '/canvas-agent/',
    onMessage: handleMessage,
  });

  const sendCanvasState = useCallback((nodes: Node[], edges: Edge[]) => {
    send({ type: 'canvas_state', state: { nodes, edges } });
  }, [send]);

  const sendInstruction = async (
    instruction: string,
    canvasState: { nodes: Node[]; edges: Edge[] } | null = null
  ): Promise<{ message: string; actionsApplied: number } | null> => {
    setIsProcessing(true);
    try {
      const response = await apiClient.post('/canvas-agent/command/', {
        instruction,
        canvas_state: canvasState,
        current_url: window.location.pathname + window.location.search,
      });
      if (response.data.status === 'error') {
        toast.error(response.data.message);
        return null;
      }
      return { message: response.data.message, actionsApplied: response.data.actions_applied };
    } catch (error: any) {
      console.error('Failed to send instruction:', error);
      toast.error(error.response?.data?.message || 'Failed to process AI command');
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return { isConnected, isProcessing, sendInstruction, sendCanvasState };
}
