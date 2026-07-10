import {
  findTeamById,
  searchTeams,
} from '../db/repositories/team-repository.js';
import { getRecentMatchesForTeam } from './match-service.js';

export function searchTeamSummaries(filters = {}) {
  const result = searchTeams(filters);
  return {
    items: result.items.map((team) => ({
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      tla: team.tla,
      crestUrl: team.crestUrl,
      leagueCode: team.leagueCode,
    })),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
  };
}

export function getTeamDetail(teamId) {
  const team = findTeamById(teamId);
  if (!team) return null;

  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    tla: team.tla,
    crestUrl: team.crestUrl,
    leagueCode: team.leagueCode,
    recentMatches: getRecentMatchesForTeam(teamId),
  };
}
