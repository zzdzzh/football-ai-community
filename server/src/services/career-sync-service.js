import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { config } from '../config/index.js';
import { careerDataAdapter } from '../adapters/career-data-adapter.js';
import {
  findCareerPlayerById,
  findCareerPlayerByExternal,
  upsertCareerPlayer,
  updateCareerPlayerSyncStatus,
} from '../db/repositories/career-player-repository.js';
import { upsertCareerClub } from '../db/repositories/career-club-repository.js';
import {
  deleteClubStintsByPlayerId,
  insertClubStint,
} from '../db/repositories/club-stint-repository.js';
import {
  deleteNationalTeamStintsByPlayerId,
  insertNationalTeamStint,
} from '../db/repositories/national-team-stint-repository.js';
import { normalizeStintInterval } from './time-normalize.js';
import { isTmCaptchaError, triggerTmCookieRefresh } from '../adapters/scraper-runner.js';

function normalizeName(name) {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isWithinTtl(syncedAt, ttlDays) {
  if (!syncedAt) return false;
  const syncedMs = Date.parse(syncedAt);
  if (Number.isNaN(syncedMs)) return false;
  const ttlMs = Math.max(0, ttlDays) * 24 * 60 * 60 * 1000;
  return Date.now() - syncedMs < ttlMs;
}

function ensureClub(clubPayload) {
  if (!clubPayload?.name && !clubPayload?.externalId) {
    return null;
  }
  const name = clubPayload.name || `Club ${clubPayload.externalId}`;
  const externalId = String(clubPayload.externalId ?? `hash:${normalizeName(name)}`);
  return upsertCareerClub({
    externalSource: 'transfermarkt',
    externalId,
    name,
    nameNormalized: clubPayload.nameNormalized ?? normalizeName(name),
  });
}

export function createCareerSyncService(deps = {}) {
  const adapter = deps.adapter ?? careerDataAdapter;
  const ttlDays = deps.ttlDays ?? config.careerSync?.ttlDays ?? 7;
  const asOf = deps.asOf;

  return {
    /**
     * 按需同步单球员履历。
     * @param {{ playerId?: string, externalId?: string, slug?: string, force?: boolean }} opts
     */
    async syncPlayer(opts = {}) {
      const { playerId, externalId, slug = '-', force = false } = opts;
      let player = playerId ? findCareerPlayerById(playerId) : null;
      if (!player && externalId) {
        player = findCareerPlayerByExternal('transfermarkt', externalId);
      }
      if (!player && !externalId) {
        throw Object.assign(new Error('缺少 playerId 或 externalId'), { code: 'MISSING_PLAYER' });
      }

      const tmId = player?.externalId ?? String(externalId);
      if (
        player
        && !force
        && player.syncStatus === 'ready'
        && isWithinTtl(player.syncedAt, ttlDays)
      ) {
        return { player, skipped: true, reason: 'ttl_hit' };
      }

      if (player) {
        updateCareerPlayerSyncStatus(player.id, { syncStatus: 'syncing', lastSyncError: null });
      }

      let profile;
      try {
        profile = await adapter.fetchProfile(tmId, { slug: player?.slug ?? slug });
      } catch (err) {
        let message = err?.message ?? String(err);
        if (isTmCaptchaError(message)) {
          const refresh = triggerTmCookieRefresh(message);
          if (refresh.started) {
            message = `${message}；已自动打开浏览器刷新 Cookie，请完成人机验证后重试`;
          } else if (refresh.reason === 'already_running') {
            message = `${message}；Cookie 刷新已在进行中，请在弹出的浏览器完成验证后重试`;
          }
        }
        if (player) {
          // 失败零虚构：不删既有 stints，仅标记 failed
          updateCareerPlayerSyncStatus(player.id, {
            syncStatus: 'failed',
            lastSyncError: message.slice(0, 500),
          });
        }
        console.log(JSON.stringify({
          level: 'info',
          type: 'career_sync_failure',
          playerId: player?.id ?? null,
          externalId: tmId,
          message: message.slice(0, 200),
        }));
        const error = Object.assign(new Error(message), {
          code: 'CAREER_SYNC_FAILED',
          playerId: player?.id ?? null,
        });
        throw error;
      }

      const db = getDb();
      const now = new Date().toISOString();

      const persisted = db.transaction(() => {
        const currentClub = profile.currentClub ? ensureClub(profile.currentClub) : null;
        const syncedPlayer = upsertCareerPlayer({
          id: player?.id,
          externalSource: 'transfermarkt',
          externalId: profile.externalId,
          name: profile.name || player?.name || `Player ${profile.externalId}`,
          nameNormalized: profile.nameNormalized || normalizeName(profile.name || ''),
          dateOfBirth: profile.dateOfBirth,
          nationality: profile.nationality,
          position: profile.position,
          currentClubId: currentClub?.id ?? null,
          currentClubName: currentClub?.name ?? profile.currentClub?.name ?? null,
          syncedAt: now,
          syncStatus: 'ready',
          lastSyncError: null,
        });

        // 成功路径：按球员级替换 stints（事务内删旧插新）
        deleteClubStintsByPlayerId(syncedPlayer.id);
        deleteNationalTeamStintsByPlayerId(syncedPlayer.id);

        const clubStints = Array.isArray(profile.clubStints) ? profile.clubStints : [];
        for (const raw of clubStints) {
          const club = ensureClub(raw.club);
          if (!club) continue;
          const interval = normalizeStintInterval({
            joinedRaw: raw.joinedRaw,
            leftRaw: raw.leftRaw,
            asOf,
          });
          insertClubStint({
            id: randomUUID(),
            playerId: syncedPlayer.id,
            clubId: club.id,
            joinedRaw: raw.joinedRaw ?? null,
            leftRaw: raw.leftRaw ?? null,
            joinedOn: interval.joinedOn,
            leftOn: interval.leftOn,
            timePrecision: interval.precision,
            transferType: raw.transferType ?? null,
            transferFee: raw.transferFee ?? null,
            sortOrder: Number.isFinite(raw.sortOrder) ? raw.sortOrder : 0,
          });
        }

        const nationalStints = Array.isArray(profile.nationalTeamStints)
          ? profile.nationalTeamStints
          : [];
        for (const raw of nationalStints) {
          if (!raw.nationName && !raw.nationKey) continue;
          const interval = normalizeStintInterval({
            joinedRaw: raw.joinedRaw,
            leftRaw: raw.leftRaw,
            asOf,
          });
          insertNationalTeamStint({
            id: randomUUID(),
            playerId: syncedPlayer.id,
            nationKey: raw.nationKey || normalizeName(raw.nationName).replace(/\s+/g, '_'),
            nationName: raw.nationName || raw.nationKey,
            joinedRaw: raw.joinedRaw ?? null,
            leftRaw: raw.leftRaw ?? null,
            joinedOn: interval.joinedOn,
            leftOn: interval.leftOn,
            timePrecision: interval.precision,
          });
        }

        return syncedPlayer;
      })();

      console.log(JSON.stringify({
        level: 'info',
        type: 'career_sync_success',
        playerId: persisted.id,
        externalId: persisted.externalId,
        clubStintCount: Array.isArray(profile.clubStints) ? profile.clubStints.length : 0,
      }));

      return { player: persisted, skipped: false, reason: 'synced' };
    },

    /**
     * 按姓名走外源搜索（不落库），供本地未命中时使用。
     */
    async searchExternal(query, { limit = 20 } = {}) {
      return adapter.search(query, { limit });
    },
  };
}

export const careerSyncService = createCareerSyncService();
