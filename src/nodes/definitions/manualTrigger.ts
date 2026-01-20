import type { NodeDefinition } from '../../types/node';
// import { Play } from 'lucide-react'; // Icon handled by string name now

export const manualTriggerNode: NodeDefinition = {
  type: 'better-n8n.manualTrigger',
  displayName: 'When clicking "Test Workflow"',
  icon: 'Play', // We'll handle icon mapping in the GenericNode
  group: ['trigger'],
  version: 1,
  description: 'Starts the workflow manually',
  color: '#ff6d5a', // n8n trigger orange
  
  defaults: {
    name: 'Manual Trigger',
    color: '#ff6d5a',
  },

  inputs: [],
  outputs: ['main'],

  properties: [
    {
      name: 'notice',
      displayName: 'Notice',
      type: 'string', // We might need a 'notice' or 'display' type later, using string for now
      default: 'This node triggers the workflow when you click the Test button.',
      placeholder: '',
      description: 'Info',
    }
  ]
};
