/**
 * Skills — reusable instruction fragments an agent can be given.
 *
 * Pages hit `/skills/` directly today; this exists because the agent builder
 * needs a plain "list what I can attach" call, and inlining a fourth copy of
 * that request would be the point where the envelope handling drifts.
 */
import apiClient from './client';
import { asArray } from './unwrap';

export interface Skill {
  id: number;
  title: string;
  description: string;
  content: string;
  author: string;
  isShared: boolean;
  category: string;
  updatedAt: string;
}

const skillsService = {
  /** Everything the caller may attach: their own plus anything shared. */
  list: async (): Promise<Skill[]> => {
    const { data } = await apiClient.get<unknown>('/skills/');
    return asArray<Skill>(data);
  },
};

export default skillsService;
