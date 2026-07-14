/** Scout keyStats：基础项必留 + 按用户意图侧重扩展。 */

export const BASE_STAT_NAMES = ['进球', '助攻', '出场', '出场分钟'];

const FOCUS_PREFERRED = {
  attack: ['射门', '射正', 'xG', '点球', '评分'],
  playmaking: ['助攻', 'xA', '评分', '射门'],
  defense: ['拦截', '抢断成功', '评分', '黄牌'],
  goalkeeping: ['扑救', '零封', '失球', '评分'],
  workload: ['出场分钟', '首发', '出场', '评分'],
  general: ['评分', '首发', '射门', '拦截'],
};

const FOCUS_KEYWORDS = [
  { focus: 'goalkeeping', patterns: [/门将/, /扑救/, /零封/, /守门/, /goalkeeper/i, /keeper/i] },
  { focus: 'defense', patterns: [/后卫/, /防守/, /压迫/, /拦截/, /抢断/, /对抗/, /defender/i, /tackl/i, /press/i] },
  { focus: 'playmaking', patterns: [/组织/, /传球/, /创造力/, /助攻/, /串联/, /playmak/i, /creat/i, /pass/i] },
  { focus: 'attack', patterns: [/前锋/, /边锋/, /进球/, /射门/, /终结/, /破门/, /火力/, /forward/i, /striker/i, /winger/i, /finish/i, /shoot/i, /goal/i] },
  { focus: 'workload', patterns: [/出场/, /主力/, /分钟/, /耐力/, /铁人/, /minutes?/i, /starter/i] },
];

const POSITION_DEFAULT_FOCUS = {
  门将: 'goalkeeping',
  Goalkeeper: 'goalkeeping',
  后卫: 'defense',
  Defender: 'defense',
  中场: 'playmaking',
  Midfield: 'playmaking',
  前锋: 'attack',
  Forward: 'attack',
  边锋: 'attack',
  Winger: 'attack',
};

/**
 * 从用户问题与位置推断统计侧重。
 * @returns {{ focuses: string[], preferredStatNames: string[], reason: string }}
 */
export function parseStatFocusFromQuestion(question = '', position = null) {
  const focuses = [];
  const q = question || '';

  for (const rule of FOCUS_KEYWORDS) {
    if (rule.patterns.some((p) => p.test(q))) {
      focuses.push(rule.focus);
    }
  }

  if (focuses.length === 0 && position && POSITION_DEFAULT_FOCUS[position]) {
    focuses.push(POSITION_DEFAULT_FOCUS[position]);
  }
  if (focuses.length === 0) {
    focuses.push('general');
  }

  const preferred = [];
  for (const focus of focuses) {
    for (const name of FOCUS_PREFERRED[focus] ?? []) {
      if (!preferred.includes(name)) preferred.push(name);
    }
  }

  return {
    focuses,
    preferredStatNames: preferred,
    reason: focuses.join('+'),
  };
}

function findStat(stats, name) {
  if (!Array.isArray(stats)) return null;
  return stats.find((s) => s?.name === name) ?? null;
}

function hasMeaningfulValue(stat, { allowZero = true } = {}) {
  if (!stat || stat.value == null) return false;
  if (typeof stat.value === 'number' && Number.isNaN(stat.value)) return false;
  if (!allowZero && typeof stat.value === 'number' && stat.value === 0) return false;
  return true;
}

/**
 * 组装最终 keyStats：
 * 1) 基础项（进球/助攻/出场类）有则必留
 * 2) 按用户侧重追加 preferred
 * 3) 保留 AI 额外选择的候选内指标
 */
export function composeKeyStats(aiKeyStats = [], candidateStats = [], preferredStatNames = [], { maxItems = 6 } = {}) {
  const byName = new Map();
  const push = (stat, { allowZero = true } = {}) => {
    if (!hasMeaningfulValue(stat, { allowZero })) return;
    if (byName.has(stat.name)) return;
    byName.set(stat.name, { name: stat.name, value: stat.value, ...(stat.unit ? { unit: stat.unit } : {}) });
  };

  // 基础：优先出场分钟，其次出场；进球/助攻始终尝试留下
  for (const name of ['进球', '助攻']) {
    push(findStat(candidateStats, name));
  }
  const minutes = findStat(candidateStats, '出场分钟');
  const appearances = findStat(candidateStats, '出场');
  if (hasMeaningfulValue(minutes)) {
    push(minutes);
  } else {
    push(appearances);
  }

  // 侧重：优先用候选人真实值，顺序跟随 preferred（0 值跳过）
  for (const name of preferredStatNames) {
    if (byName.has(name)) continue;
    push(findStat(candidateStats, name), { allowZero: false });
  }

  // AI 选择的其余项（须能在候选人 stats 中校验）
  for (const item of aiKeyStats) {
    if (!item?.name) continue;
    const verified = findStat(candidateStats, item.name);
    if (verified) {
      push({ ...verified, ...(item.unit ? { unit: item.unit } : {}) }, { allowZero: false });
    }
  }

  return Array.from(byName.values()).slice(0, maxItems);
}
