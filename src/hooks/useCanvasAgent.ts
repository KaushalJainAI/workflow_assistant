import { useEffect, useRef, useState, useCallback } from 'react';
import { tokenManager } from '../api/client';
import type { Node, Edge } from 'reactflow';
import apiClient from '../api/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

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
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const intentionalCloseRef = useRef(false);
  const maxReconnectAttempts = 5;
  const navigate = useNavigate();

  const connect = useCallback(() => {
    const token = tokenManager.getAccessToken();
    if (!token) return;

    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
    }
    intentionalCloseRef.current = false;

    const ws = new WebSocket(`${WS_URL}/canvas-agent/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (intentionalCloseRef.current) {
        intentionalCloseRef.current = false;
        return;
      }
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current += 1;
        setTimeout(connect, 3000);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'canvas_action') {
          handleActions(data.actions);
        }
      } catch (err) {
        console.error('Failed to parse Canvas Agent message:', err);
      }
    };
  }, []);

  const handleActions = useCallback((actions: CanvasAction[]) => {
    let actionsApplied = 0;

    actions.forEach((action) => {
      const { action_type, payload } = action;

      switch (action_type) {
        case 'navigate':
          if (payload.path) {
            navigate(payload.path);
            actionsApplied++;
          }
          break;

        case 'show_toast':
          if (payload.type === 'success') toast.success(payload.message);
          else if (payload.type === 'error') toast.error(payload.message);
          else toast(payload.message);
          actionsApplied++;
          break;

        case 'open_modal':
          // Can be hooked into a global modal state manager later
          console.log(`Opening modal: ${payload.modal_id}`);
          actionsApplied++;
          break;

        case 'add_node':
          if (setNodes) {
            const newNode: Node = {
              id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              type: 'generic',
              position: payload.position,
              data: {
                label: payload.label,
                nodeType: payload.node_type,
                ...payload.config,
              },
            };
            setNodes((nds) => [...nds, newNode]);
            actionsApplied++;
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
            actionsApplied++;
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
            actionsApplied++;
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
            actionsApplied++;
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
            actionsApplied++;
          }
          break;

        case 'clear_canvas':
          if (setNodes && setEdges) {
            setNodes([]);
            setEdges([]);
            actionsApplied++;
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
            actionsApplied++;
          }
          break;

        default:
          console.warn(`Unknown action type: ${action_type}`);
      }
    });

    if (actionsApplied > 0) {
      // Don't show toast for every action, but maybe for overall completion
      // toast.success(`Applied ${actionsApplied} AI actions`);
    }
  }, [setNodes, setEdges, onConnect, navigate]);

  const sendCanvasState = useCallback((nodes: Node[], edges: Edge[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'canvas_state', state: { nodes, edges } }));
    }
  }, []);

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

  useEffect(() => {
    connect();
    return () => {
      intentionalCloseRef.current = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { isConnected, isProcessing, sendInstruction, sendCanvasState };
}
