/**
 * Coding-persona archetype gallery (P5, v2).
 *
 * Content design inspired by ABTI (a gallery of named archetypes, each with a
 * code / 中文名 / one-line intro / rarity / avatar) and judged SBTI-Buddy-style:
 * NO questionnaire — the matcher in persona-score.ts scores a developer from real
 * session-bundle behaviour and picks the nearest archetype by Euclidean distance.
 *
 * `dims` is the archetype's centroid over the six persona axes, each 0–100 where
 * higher = the RIGHT pole. The axis order is fixed and shared with persona-score.ts:
 *   [0] 思维广度  聚焦↔发散
 *   [1] 工作节奏  规划↔试错
 *   [2] 知识取向  原创↔复用
 *   [3] 产出倾向  探索↔交付
 *   [4] 节律      昼间↔夜行
 *   [5] 路线      坚守↔漂移
 */

export type PersonaRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'hidden';

export interface PersonaArchetype {
  code: string;
  cn: string;
  intro: string;
  devStyle: string;
  catchphrase: string;
  rarity: PersonaRarity;
  /** Centroid over the six axes (0–100, high = right pole). */
  dims: [number, number, number, number, number, number];
  /** gpt-image-2 prompt suffix (subject / props / theme colour), appended to AVATAR_BASE_PROMPT. */
  imgPrompt: string;
}

/** Auxiliary signals (not part of the 6-dim vector) used to trigger hidden eggs. */
export interface EggSignals {
  nightShare: number;
  interruptedShare: number;
  writes: number;
  milestoneCount: number;
}

export interface PersonaEgg extends Omit<PersonaArchetype, 'dims'> {
  /** Returns true when this easter-egg persona should override the nearest-archetype match. */
  egg: (s: EggSignals) => boolean;
}

/** Shared prefix for every avatar — keeps the whole gallery in one visual style. */
export const AVATAR_BASE_PROMPT =
  '3D clay-render blind-box collectible figurine, soft studio lighting, rounded chibi ' +
  'proportions, matte clay texture, centered bust portrait, plain soft-gradient background, ' +
  'cute and friendly, highly detailed, no text, square 1:1. Subject: ';

export const ARCHETYPES: PersonaArchetype[] = [
  {
    code: 'ARCH', cn: '架构匠', intro: '先把蓝图画完，再动第一砖。',
    devStyle: '规划先行', catchphrase: '蓝图先行。', rarity: 'epic',
    dims: [15, 10, 30, 75, 30, 15],
    imgPrompt: 'a tiny calm architect holding a glowing blueprint scroll, wearing a hard hat, steel-blue theme colour.',
  },
  {
    code: 'SHIP', cn: '一击交付者', intro: '能上线的代码才是好代码。',
    devStyle: '结果导向', catchphrase: '发布，下一个。', rarity: 'epic',
    dims: [25, 25, 60, 92, 35, 20],
    imgPrompt: 'a confident little figure hugging a rocket-shaped parcel and pressing a big "deploy" button, emerald-green theme colour.',
  },
  {
    code: 'REFAC', cn: '重构洁癖', intro: '它能跑，但我忍不了。',
    devStyle: '打磨细节', catchphrase: '再擦亮一点。', rarity: 'rare',
    dims: [20, 20, 72, 32, 35, 20],
    imgPrompt: 'a fastidious little figure polishing a crystal code-block with a cloth and magnifying glass, mint-teal theme colour.',
  },
  {
    code: 'REUSE', cn: '复用大师', intro: '轮子够多了，我来组装。',
    devStyle: '站在巨人肩上', catchphrase: '组装就完事了。', rarity: 'uncommon',
    dims: [25, 25, 90, 68, 35, 20],
    imgPrompt: 'a cheerful little figure assembling glowing modular lego-like blocks into a machine, amber-yellow theme colour.',
  },
  {
    code: 'PIONEER', cn: '拓荒者', intro: '没有路？那就踩一条出来。',
    devStyle: '敢闯无人区', catchphrase: '往前，没退路。', rarity: 'rare',
    dims: [80, 75, 18, 30, 40, 68],
    imgPrompt: 'a brave little explorer planting a flag on rocky ground, goggles on forehead, sunset-orange theme colour.',
  },
  {
    code: 'TINKER', cn: '试错工匠', intro: '报错是我和机器的对话。',
    devStyle: '边错边学', catchphrase: '再试一次。', rarity: 'common',
    dims: [35, 85, 30, 35, 45, 35],
    imgPrompt: 'a focused little tinkerer at a workbench surrounded by sparks and tiny red error icons, copper-orange theme colour.',
  },
  {
    code: 'DIVER', cn: '深潜员', intro: '一个问题能挖到地心。',
    devStyle: '钻到底', catchphrase: '再深一点。', rarity: 'rare',
    dims: [12, 30, 30, 32, 40, 12],
    imgPrompt: 'a tiny deep-sea diver in a brass helmet descending with a lantern into dark water, deep-blue theme colour.',
  },
  {
    code: 'SPARK', cn: '点子喷泉', intro: '想法比 commit 多十倍。',
    devStyle: '灵感爆棚', catchphrase: '我又有主意了！', rarity: 'uncommon',
    dims: [90, 60, 25, 25, 45, 72],
    imgPrompt: 'an excited little figure with many glowing lightbulbs bursting around its head like a fountain, bright-yellow theme colour.',
  },
  {
    code: 'PIVOT', cn: '转向大师', intro: '方向不对，换。',
    devStyle: '灵活掉头', catchphrase: '换个方向。', rarity: 'uncommon',
    dims: [72, 58, 55, 30, 40, 90],
    imgPrompt: 'a nimble little figure mid-spin on a turning arrow / compass platform, violet-purple theme colour.',
  },
  {
    code: 'SCOUT', cn: '探路侦察兵', intro: '先摸清地形再下手。',
    devStyle: '谋定后动', catchphrase: '先探探路。', rarity: 'common',
    dims: [68, 30, 30, 22, 40, 45],
    imgPrompt: 'a little scout peering through binoculars over a small map, leaf-green theme colour.',
  },
  {
    code: 'STEADY', cn: '稳健交付者', intro: '不快，但每步都算数。',
    devStyle: '稳扎稳打', catchphrase: '稳一点。', rarity: 'common',
    dims: [45, 25, 58, 70, 40, 25],
    imgPrompt: 'a steady little figure stacking neat blocks one by one, calm expression, slate-blue theme colour.',
  },
  {
    code: 'FIRE', cn: '救火队员', intro: '哪里报错我去哪里。',
    devStyle: '救场专精', catchphrase: '我来灭火。', rarity: 'uncommon',
    dims: [30, 80, 65, 66, 45, 30],
    imgPrompt: 'a little firefighter spraying a tiny burning bug with an extinguisher, red theme colour.',
  },
  {
    code: 'MARATHON', cn: '长跑者', intro: '一条道走到黑，黑了点灯继续。',
    devStyle: '持久续航', catchphrase: '继续跑。', rarity: 'rare',
    dims: [20, 22, 35, 72, 35, 10],
    imgPrompt: 'a determined little runner with a headlamp on a long road at dusk, teal theme colour.',
  },
  {
    code: 'NIGHT', cn: '夜行者', intro: '灵感都在凌晨三点找上门。',
    devStyle: '月光码农', catchphrase: '夜里最清醒。', rarity: 'rare',
    dims: [58, 62, 35, 42, 90, 55],
    imgPrompt: 'a cozy little figure wrapped in a blanket holding coffee, a moon and stars overhead, faint dark circles, deep-purple theme colour.',
  },
  {
    code: 'CHILL', cn: '佛系码农', intro: '能跑就行，缘分到了再优化。',
    devStyle: '随缘开发', catchphrase: '缘分到了再说。', rarity: 'common',
    dims: [50, 42, 50, 40, 45, 50],
    imgPrompt: 'a relaxed little figure lounging cross-legged with a faint zen halo and a mug, soft-green theme colour.',
  },
  {
    code: 'STAR', cn: '六边形战士', intro: '广度深度交付全都要，老天爷赏饭。',
    devStyle: '全能', catchphrase: '全都要。', rarity: 'legendary',
    dims: [50, 18, 45, 78, 40, 28],
    imgPrompt: 'a radiant little hero with a hexagram aura and a small medal, balanced confident pose, gold theme colour.',
  },
];

export const EGGS: PersonaEgg[] = [
  {
    code: 'OWL', cn: '夜枭', intro: '灵感与黑眼圈同时上线。',
    devStyle: '深夜物种', catchphrase: '天亮再睡。', rarity: 'hidden',
    imgPrompt: 'a tiny wide-awake owl-eared figure under a crescent moon with prominent dark circles, glowing screen reflection, midnight-blue theme colour.',
    egg: (s) => s.nightShare > 0.5,
  },
  {
    code: 'VOID', cn: '查无沉淀', intro: '你的项目还没沉淀下任何知识。',
    devStyle: '未知分类', catchphrase: '404。', rarity: 'hidden',
    imgPrompt: 'a translucent glowing question-mark ghost holding a small "404" sign, neutral-grey theme colour.',
    egg: (s) => s.milestoneCount > 0 && s.writes === 0,
  },
  {
    code: 'GHOST', cn: '半途魂', intro: '太多任务停在了一半。',
    devStyle: '半途而废', catchphrase: '下次一定。', rarity: 'hidden',
    imgPrompt: 'a faded little ghost trailing off into wisps, half-finished outline, pale-cyan theme colour.',
    egg: (s) => s.interruptedShare > 0.4,
  },
];

/** Lookup by code across both regular archetypes and eggs. */
export function archetypeByCode(code: string): PersonaArchetype | PersonaEgg | undefined {
  return ARCHETYPES.find((a) => a.code === code) || EGGS.find((e) => e.code === code);
}
