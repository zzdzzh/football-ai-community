import { z } from 'zod';
import { AppError } from '../middleware/error.js';
import {
  getOrCreatePreferenceByUserId,
  upsertPreference,
} from '../db/repositories/user-preference-repository.js';

import { LEAGUE_CODES } from '../constants/league-codes.js';

const AGENT_IDS = ['news', 'stats', 'scout', 'tactical', 'fan', 'content'];

const updatePreferenceSchema = z.object({
  followedTeams: z.array(z.string()).optional(),
  followedLeagues: z.array(z.enum(LEAGUE_CODES)).optional(),
  enabledAgents: z.array(z.enum(AGENT_IDS)).min(1).optional(),
  notifyMatchReport: z.boolean().optional(),
});

export function getUserPreferences(userId) {
  return getOrCreatePreferenceByUserId(userId);
}

export function updateUserPreferences(userId, input) {
  const parsed = updatePreferenceSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(400, 'bad_request', '请求参数无效');
  }

  const current = getOrCreatePreferenceByUserId(userId);
  const next = {
    followedTeams: parsed.data.followedTeams ?? current.followedTeams,
    followedLeagues: parsed.data.followedLeagues ?? current.followedLeagues,
    enabledAgents: parsed.data.enabledAgents ?? current.enabledAgents,
    notifyMatchReport: parsed.data.notifyMatchReport ?? current.notifyMatchReport,
  };

  return upsertPreference(userId, next);
}
