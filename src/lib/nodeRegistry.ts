import type { NodeDefinition } from '../types/node';
import { manualTriggerNode } from '../nodes/definitions/manualTrigger';

class NodeRegistry {
  private static instance: NodeRegistry;
  private definitions: Map<string, NodeDefinition> = new Map();

  private constructor() {
    this.register(manualTriggerNode);
  }

  public static getInstance(): NodeRegistry {
    if (!NodeRegistry.instance) {
      NodeRegistry.instance = new NodeRegistry();
    }
    return NodeRegistry.instance;
  }

  public register(definition: NodeDefinition): void {
    this.definitions.set(definition.type, definition);
  }

  public get(type: string): NodeDefinition | undefined {
    return this.definitions.get(type);
  }

  public getAll(): NodeDefinition[] {
    return Array.from(this.definitions.values());
  }

  public getByType(type: string): NodeDefinition | undefined {
    return this.definitions.get(type);
  }
}

export const nodeRegistry = NodeRegistry.getInstance();
