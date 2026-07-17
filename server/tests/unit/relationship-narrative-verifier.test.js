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
  });
});
