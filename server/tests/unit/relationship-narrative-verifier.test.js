import {
  buildAllowedFacts,
  verifyNarrativeOutput,
} from '../../src/services/relationship-narrative-verifier.js';

function baseResult(overrides = {}) {
  return {
    clubmates: { status: 'established' },
    nationalTeammates: { status: 'not_established' },
    clubmateDetails: [{
      clubId: 'club-barca',
      clubName: 'FC Barcelona',
      overlapFrom: '2014-07-11',
      overlapTo: '2020-09-23',
      precision: 'exact',
    }],
    nationalTeammateDetails: [],
    transfer: {
      directTransferLink: false,
      successiveSameClub: false,
      evidence: [],
    },
    indirectPath: null,
    pathStatus: 'no_path',
    relationDistance: 0,
    selfPair: false,
    ...overrides,
  };
}

describe('relationship-narrative-verifier', () => {
  describe('buildAllowedFacts', () => {
    it('builds allow-list from clubmate/transfer/path facts', () => {
      const result = baseResult({
        transfer: {
          directTransferLink: true,
          successiveSameClub: false,
          evidence: ['A transferred to club X previously occupied by B'],
        },
        pathStatus: 'found',
        indirectPath: {
          distance: 2,
          nodes: [
            { type: 'player', id: 'p-a', name: 'Player A' },
            { type: 'club', id: 'club-x', name: 'Club X' },
            { type: 'player', id: 'p-b', name: 'Player B' },
          ],
          edges: [],
        },
        relationDistance: 2,
      });

      const facts = buildAllowedFacts(result);
      expect(facts.verdicts.clubmates).toBe('established');
      expect(facts.verdicts.nationalTeammates).toBe('not_established');
      expect(facts.verdicts.pathStatus).toBe('found');
      expect(facts.clubNames).toEqual(expect.arrayContaining(['FC Barcelona', 'Club X']));
      expect(facts.pathNodeIds).toEqual(expect.arrayContaining(['p-a', 'club-x', 'p-b']));
      expect(facts.transfer.directTransferLink).toBe(true);
    });
  });

  describe('verifyNarrativeOutput', () => {
    it('accepts claims within clubmate allow-list', () => {
      const result = baseResult();
      const out = verifyNarrativeOutput({
        result,
        narrative: '两人曾在 FC Barcelona 有重叠效力时段。',
        claims: [{
          type: 'clubmate',
          status: 'established',
          clubName: 'FC Barcelona',
          overlapFrom: '2014-07-11',
          overlapTo: '2020-09-23',
        }],
        playerNames: ['Lionel Messi', 'Luis Suárez'],
      });
      expect(out.ok).toBe(true);
    });

    it('accepts transfer claim when transfer evidence exists', () => {
      const result = baseResult({
        clubmates: { status: 'not_established' },
        clubmateDetails: [],
        transfer: {
          directTransferLink: true,
          successiveSameClub: true,
          evidence: ['successive same club'],
        },
      });
      const out = verifyNarrativeOutput({
        result,
        narrative: '双方存在先后效力同一俱乐部的转会关联。',
        claims: [{ type: 'transfer', status: 'established' }],
      });
      expect(out.ok).toBe(true);
    });

    it('accepts verdict aspect=transfer and nationmates aliases from prompt', () => {
      const acceptTransfer = verifyNarrativeOutput({
        result: baseResult({
          transfer: {
            directTransferLink: false,
            successiveSameClub: false,
            evidence: [],
          },
        }),
        narrative: '未发现直接转会关联。',
        claims: [{ type: 'verdict', aspect: 'transfer', status: 'not_established' }],
      });
      expect(acceptTransfer.ok).toBe(true);

      const rejectUpgrade = verifyNarrativeOutput({
        result: baseResult({
          transfer: {
            directTransferLink: false,
            successiveSameClub: false,
            evidence: [],
          },
        }),
        narrative: '存在转会关联。',
        claims: [{ type: 'verdict', aspect: 'transfer', status: 'established' }],
      });
      expect(rejectUpgrade.ok).toBe(false);

      const nationAlias = verifyNarrativeOutput({
        result: baseResult({
          nationalTeammates: { status: 'not_established' },
        }),
        narrative: '非国家队队友。',
        claims: [{ type: 'verdict', aspect: 'nationmates', status: 'not_established' }],
      });
      expect(nationAlias.ok).toBe(true);
    });

    it('accepts path claim when pathStatus is found', () => {
      const result = baseResult({
        clubmates: { status: 'not_established' },
        clubmateDetails: [],
        pathStatus: 'found',
        indirectPath: {
          distance: 2,
          nodes: [
            { type: 'player', id: 'p1', name: 'A' },
            { type: 'player', id: 'p2', name: 'Bridge' },
            { type: 'player', id: 'p3', name: 'B' },
          ],
          edges: [],
        },
        relationDistance: 2,
      });
      const out = verifyNarrativeOutput({
        result,
        narrative: '可通过中间球员建立间接路径。',
        claims: [{
          type: 'path',
          status: 'found',
          nodeIds: ['p1', 'p2', 'p3'],
          nodeNames: ['A', 'Bridge', 'B'],
        }],
      });
      expect(out.ok).toBe(true);
    });

    it('rejects upgrading unknown to established', () => {
      const result = baseResult({
        clubmates: { status: 'unknown' },
        clubmateDetails: [],
      });
      const out = verifyNarrativeOutput({
        result,
        narrative: '他们曾是俱乐部队友。',
        claims: [{ type: 'verdict', aspect: 'clubmates', status: 'established' }],
      });
      expect(out.ok).toBe(false);
      expect(out.errorCode).toBe('narrative_verification_failed');
    });

    it('rejects upgrading not_established to established', () => {
      const result = baseResult({
        clubmates: { status: 'not_established' },
        clubmateDetails: [],
      });
      const out = verifyNarrativeOutput({
        result,
        narrative: '现有履历表明二人曾同队效力。',
        claims: [{ type: 'clubmate', status: 'established', clubName: 'FC Barcelona' }],
      });
      expect(out.ok).toBe(false);
      expect(out.errorCode).toBe('narrative_verification_failed');
    });

    it('rejects honor claims', () => {
      const result = baseResult();
      const out = verifyNarrativeOutput({
        result,
        narrative: '两人一起夺得欧冠冠军。',
        claims: [{ type: 'honor', status: 'established', note: 'UCL winner' }],
      });
      expect(out.ok).toBe(false);
      expect(out.errorCode).toBe('narrative_verification_failed');
    });

    it('rejects contradictory narrative against not_established clubmates', () => {
      const result = baseResult({
        clubmates: { status: 'not_established' },
        clubmateDetails: [],
      });
      const out = verifyNarrativeOutput({
        result,
        narrative: '他们曾是巴塞罗那的队友，并肩作战多年。',
        claims: [{ type: 'verdict', aspect: 'clubmates', status: 'not_established' }],
        playerNames: ['A', 'B'],
      });
      expect(out.ok).toBe(false);
      expect(out.errorCode).toBe('narrative_verification_failed');
    });

    it('rejects fabricated path nodes not in allow-list', () => {
      const result = baseResult({
        pathStatus: 'found',
        indirectPath: {
          distance: 2,
          nodes: [
            { type: 'player', id: 'p1', name: 'A' },
            { type: 'player', id: 'p2', name: 'B' },
          ],
          edges: [],
        },
      });
      const out = verifyNarrativeOutput({
        result,
        narrative: '经由虚构球员建立联系。',
        claims: [{
          type: 'path',
          status: 'found',
          nodeIds: ['p1', 'fake-node', 'p2'],
          nodeNames: ['A', 'Fake', 'B'],
        }],
      });
      expect(out.ok).toBe(false);
    });

    it('rejects unknown club name not in allow-list', () => {
      const result = baseResult();
      const out = verifyNarrativeOutput({
        result,
        narrative: '两人曾在 Real Madrid 有重叠。',
        claims: [{
          type: 'clubmate',
          status: 'established',
          clubName: 'Real Madrid',
          overlapFrom: '2014-07-11',
          overlapTo: '2020-09-23',
        }],
      });
      expect(out.ok).toBe(false);
    });

    it('rejects empty narrative', () => {
      const out = verifyNarrativeOutput({
        result: baseResult(),
        narrative: '   ',
        claims: [],
      });
      expect(out.ok).toBe(false);
    });

    it('rejects invalid claim object', () => {
      const out = verifyNarrativeOutput({
        result: baseResult(),
        narrative: '说明无关联。',
        claims: [null],
      });
      expect(out.ok).toBe(false);
    });

    it('rejects unknown verdict aspect', () => {
      const out = verifyNarrativeOutput({
        result: baseResult(),
        narrative: '说明。',
        claims: [{ type: 'verdict', aspect: 'unknown_aspect', status: 'established' }],
      });
      expect(out.ok).toBe(false);
    });

    it('rejects nationmate status upgrade', () => {
      const out = verifyNarrativeOutput({
        result: baseResult({ nationalTeammates: { status: 'unknown' } }),
        narrative: '同国效力。',
        claims: [{ type: 'nationmate', status: 'established', clubName: 'Argentina' }],
      });
      expect(out.ok).toBe(false);
    });

    it('rejects transfer established without evidence', () => {
      const out = verifyNarrativeOutput({
        result: baseResult(),
        narrative: '存在转会关联。',
        claims: [{ type: 'transfer', status: 'established' }],
      });
      expect(out.ok).toBe(false);
    });

    it('rejects path found when pathStatus is no_path', () => {
      const out = verifyNarrativeOutput({
        result: baseResult({ pathStatus: 'no_path', indirectPath: null }),
        narrative: '有路径。',
        claims: [{ type: 'path', status: 'found', nodeIds: ['x'], nodeNames: ['X'] }],
      });
      expect(out.ok).toBe(false);
    });

    it('rejects unsupported claim type', () => {
      const out = verifyNarrativeOutput({
        result: baseResult(),
        narrative: '说明。',
        claims: [{ type: 'rumor', status: 'established' }],
      });
      expect(out.ok).toBe(false);
    });

    it('rejects path node name not in allow-list', () => {
      const result = baseResult({
        pathStatus: 'found',
        indirectPath: {
          distance: 2,
          nodes: [
            { type: 'player', id: 'p1', name: 'A' },
            { type: 'player', id: 'p2', name: 'B' },
          ],
          edges: [],
        },
      });
      const out = verifyNarrativeOutput({
        result,
        narrative: '路径成立。',
        claims: [{
          type: 'path',
          status: 'found',
          nodeIds: ['p1', 'p2'],
          nodeNames: ['A', 'WrongName'],
        }],
      });
      expect(out.ok).toBe(false);
    });

    it('rejects clubmate when name only appears outside clubmateKeys', () => {
      const out = verifyNarrativeOutput({
        result: baseResult({
          clubmateDetails: [],
          pathStatus: 'found',
          indirectPath: {
            distance: 1,
            nodes: [{ type: 'club', id: 'cx', name: 'Phantom FC' }],
            edges: [],
          },
        }),
        narrative: '效力 Phantom FC。',
        claims: [{
          type: 'clubmate',
          status: 'established',
          clubName: 'Phantom FC',
          overlapFrom: '2014-01-01',
          overlapTo: '2015-01-01',
        }],
      });
      expect(out.ok).toBe(false);
    });

    it('includes national teammate names in allow-list', () => {
      const facts = buildAllowedFacts(baseResult({
        nationalTeammateDetails: [{ nationName: 'Argentina', clubName: null }],
      }));
      expect(facts.clubNames).toEqual(expect.arrayContaining(['Argentina']));
    });

    it('includes 005 national entityName in allow-list and accepts nationmate claim', () => {
      const facts = buildAllowedFacts(baseResult({
        nationalTeammates: { status: 'established' },
        nationalTeammateDetails: [{
          entityId: 'portugal',
          entityName: 'Portugal',
          overlapFrom: '2018-01-01',
          overlapTo: '2024-01-01',
        }],
      }));
      expect(facts.clubNameSet.has('portugal')).toBe(true);

      const out = verifyNarrativeOutput({
        result: baseResult({
          nationalTeammates: { status: 'established' },
          nationalTeammateDetails: [{
            entityId: 'portugal',
            entityName: 'Portugal',
            overlapFrom: '2018-01-01',
            overlapTo: '2024-01-01',
          }],
        }),
        narrative: '两人同为葡萄牙国家队队友。',
        claims: [{
          type: 'nationmate',
          status: 'established',
          clubName: 'Portugal',
        }],
      });
      expect(out.ok).toBe(true);
    });

    it('accepts trophy-like honor alias reject', () => {
      const out = verifyNarrativeOutput({
        result: baseResult(),
        narrative: '获奖。',
        claims: [{ type: 'trophy', status: 'established' }],
      });
      expect(out.ok).toBe(false);
    });
  });
});
