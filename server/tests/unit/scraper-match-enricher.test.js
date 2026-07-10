import { describe, expect, it } from '@jest/globals';
import { mapScraperMatchDetail, extractSofascoreId } from '../../src/services/scraper-match-enricher.js';

describe('scraper-match-enricher', () => {
  it('extractSofascoreId returns id for ss- prefix', () => {
    expect(extractSofascoreId('ss-14023948')).toBe('14023948');
    expect(extractSofascoreId('537383')).toBeNull();
  });

  it('mapScraperMatchDetail maps statistics and incidents', () => {
    const payload = {
      event: {
        status: { type: 'finished' },
        homeTeam: { id: 1 },
        awayTeam: { id: 2 },
        homeScore: { current: 0 },
        awayScore: { current: 1 },
      },
      statistics: {
        statistics: [{
          groups: [{
            groupName: 'Match overview',
            statisticsItems: [{
              name: 'Ball possession',
              home: '60%',
              away: '40%',
              homeValue: 60,
              awayValue: 40,
            }],
          }],
        }],
      },
      incidents: {
        incidents: [
          { incidentType: 'period', time: 90 },
          {
            incidentType: 'goal',
            time: 53,
            isHome: false,
            player: { name: 'Rayan' },
            assist1: { name: 'A. Smith' },
          },
          {
            incidentType: 'card',
            time: 70,
            isHome: true,
            incidentClass: 'yellow',
            player: { name: 'Player A' },
          },
        ],
      },
    };

    const mapped = mapScraperMatchDetail(payload);
    expect(mapped.stats).toHaveLength(1);
    expect(mapped.stats[0]).toMatchObject({
      name: 'Ball possession',
      homeValue: 60,
      awayValue: 40,
      unit: '%',
    });
    expect(mapped.events).toHaveLength(2);
    expect(mapped.events[0]).toMatchObject({
      minute: 53,
      type: 'GOAL',
      playerName: 'Rayan',
      detail: '助攻: A. Smith',
    });
    expect(mapped.dataCompleteness).toBe('complete');
  });
});
