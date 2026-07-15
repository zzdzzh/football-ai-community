import { config } from '../config/index.js';
import {
  searchCareerFromScraper,
  fetchCareerProfileFromScraper,
} from './scraper-runner.js';

/**
 * Transfermarkt 履历数据适配层（业务侧不直连 HTML）。
 * 可通过 deps 注入 mock，供单元测试使用。
 */
export function createCareerDataAdapter(deps = {}) {
  const searchFn = deps.searchCareerFromScraper ?? searchCareerFromScraper;
  const profileFn = deps.fetchCareerProfileFromScraper ?? fetchCareerProfileFromScraper;
  const searchTimeoutMs = deps.searchTimeoutMs ?? 15000;
  const profileTimeoutMs = deps.profileTimeoutMs ?? config.careerSync?.timeoutMs ?? 60000;

  return {
    async search(query, { limit = 20 } = {}) {
      const payload = await searchFn(query, {
        limit,
        timeoutMs: searchTimeoutMs,
      });
      const items = Array.isArray(payload?.items) ? payload.items : [];
      return {
        items: items.map((item) => ({
          externalSource: 'transfermarkt',
          externalId: String(item.externalId ?? item.tmId ?? ''),
          slug: item.slug ?? '-',
          name: item.name ?? '',
          dateOfBirth: item.dateOfBirth ?? null,
          primaryClubHint: item.primaryClubHint ?? item.currentClubName ?? null,
          currentClubName: item.currentClubName ?? item.primaryClubHint ?? null,
        })).filter((item) => item.externalId && item.name),
        source: payload?.source ?? 'transfermarkt',
      };
    },

    async fetchProfile(tmId, { slug = '-' } = {}) {
      const profile = await profileFn(tmId, {
        slug,
        timeoutMs: profileTimeoutMs,
      });
      if (!profile?.externalId) {
        throw new Error('履历详情缺少 externalId');
      }
      return {
        externalSource: profile.externalSource ?? 'transfermarkt',
        externalId: String(profile.externalId),
        slug: profile.slug ?? slug,
        name: profile.name ?? '',
        nameNormalized: profile.nameNormalized ?? String(profile.name ?? '').toLowerCase(),
        dateOfBirth: profile.dateOfBirth ?? null,
        nationality: profile.nationality ?? null,
        position: profile.position ?? null,
        currentClub: profile.currentClub ?? null,
        clubStints: Array.isArray(profile.clubStints) ? profile.clubStints : [],
        nationalTeamStints: Array.isArray(profile.nationalTeamStints)
          ? profile.nationalTeamStints
          : [],
      };
    },
  };
}

export const careerDataAdapter = createCareerDataAdapter();
