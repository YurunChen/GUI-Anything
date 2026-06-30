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

import { localizedText, type LocalizedText } from '../../constants/observer-locale';

export type PersonaRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'hidden';

export interface PersonaArchetype {
  code: string;
  name: LocalizedText;
  intro: LocalizedText;
  devStyle: LocalizedText;
  catchphrase: LocalizedText;
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

function archetype(
  code: string,
  name: LocalizedText,
  intro: LocalizedText,
  devStyle: LocalizedText,
  catchphrase: LocalizedText,
  rarity: PersonaRarity,
  dims: [number, number, number, number, number, number],
  imgPrompt: string,
): PersonaArchetype {
  return { code, name, intro, devStyle, catchphrase, rarity, dims, imgPrompt };
}

function egg(
  code: string,
  name: LocalizedText,
  intro: LocalizedText,
  devStyle: LocalizedText,
  catchphrase: LocalizedText,
  rarity: PersonaRarity,
  imgPrompt: string,
  predicate: (s: EggSignals) => boolean,
): PersonaEgg {
  return { code, name, intro, devStyle, catchphrase, rarity, imgPrompt, egg: predicate };
}

export const ARCHETYPES: PersonaArchetype[] = [
  archetype('ARCH', localizedText('Architecture Smith', '架构匠'), localizedText('Draws the blueprint before placing the first brick.', '先把蓝图画完，再动第一砖。'), localizedText('Plan-first builder', '规划先行'), localizedText('Blueprint first.', '蓝图先行。'), 'epic', [15, 10, 30, 75, 30, 15], 'a tiny calm architect holding a glowing blueprint scroll, wearing a hard hat, steel-blue theme colour.'),
  archetype('SHIP', localizedText('One-Shot Shipper', '一击交付者'), localizedText('Code that ships is the code that counts.', '能上线的代码才是好代码。'), localizedText('Outcome driven', '结果导向'), localizedText('Ship it. Next.', '发布，下一个。'), 'epic', [25, 25, 60, 92, 35, 20], 'a confident little figure hugging a rocket-shaped parcel and pressing a big "deploy" button, emerald-green theme colour.'),
  archetype('REFAC', localizedText('Refactor Purist', '重构洁癖'), localizedText('It runs, but that does not mean it is acceptable.', '它能跑，但我忍不了。'), localizedText('Detail polisher', '打磨细节'), localizedText('Polish it once more.', '再擦亮一点。'), 'rare', [20, 20, 72, 32, 35, 20], 'a fastidious little figure polishing a crystal code-block with a cloth and magnifying glass, mint-teal theme colour.'),
  archetype('REUSE', localizedText('Reuse Master', '复用大师'), localizedText('There are enough wheels; time to assemble.', '轮子够多了，我来组装。'), localizedText('Composes existing leverage', '站在巨人肩上'), localizedText('Assemble and move.', '组装就完事了。'), 'uncommon', [25, 25, 90, 68, 35, 20], 'a cheerful little figure assembling glowing modular lego-like blocks into a machine, amber-yellow theme colour.'),
  archetype('PIONEER', localizedText('Path Pioneer', '拓荒者'), localizedText('No path? Makes one.', '没有路？那就踩一条出来。'), localizedText('Explores unknown ground', '敢闯无人区'), localizedText('Forward. No retreat.', '往前，没退路。'), 'rare', [80, 75, 18, 30, 40, 68], 'a brave little explorer planting a flag on rocky ground, goggles on forehead, sunset-orange theme colour.'),
  archetype('TINKER', localizedText('Tinker Artisan', '试错工匠'), localizedText('Errors are a conversation with the machine.', '报错是我和机器的对话。'), localizedText('Learns by trying', '边错边学'), localizedText('Try again.', '再试一次。'), 'common', [35, 85, 30, 35, 45, 35], 'a focused little tinkerer at a workbench surrounded by sparks and tiny red error icons, copper-orange theme colour.'),
  archetype('DIVER', localizedText('Deep Diver', '深潜员'), localizedText('Can dig one problem all the way down.', '一个问题能挖到地心。'), localizedText('Follows depth', '钻到底'), localizedText('Go deeper.', '再深一点。'), 'rare', [12, 30, 30, 32, 40, 12], 'a tiny deep-sea diver in a brass helmet descending with a lantern into dark water, deep-blue theme colour.'),
  archetype('SPARK', localizedText('Idea Fountain', '点子喷泉'), localizedText('Has ten ideas for every commit.', '想法比 commit 多十倍。'), localizedText('Idea-heavy explorer', '灵感爆棚'), localizedText('Another idea just landed.', '我又有主意了！'), 'uncommon', [90, 60, 25, 25, 45, 72], 'an excited little figure with many glowing lightbulbs bursting around its head like a fountain, bright-yellow theme colour.'),
  archetype('PIVOT', localizedText('Pivot Master', '转向大师'), localizedText('If the direction is wrong, turns fast.', '方向不对，换。'), localizedText('Flexible route switching', '灵活掉头'), localizedText('Change direction.', '换个方向。'), 'uncommon', [72, 58, 55, 30, 40, 90], 'a nimble little figure mid-spin on a turning arrow / compass platform, violet-purple theme colour.'),
  archetype('SCOUT', localizedText('Path Scout', '探路侦察兵'), localizedText('Maps the terrain before touching the code.', '先摸清地形再下手。'), localizedText('Explore before acting', '谋定后动'), localizedText('Scout first.', '先探探路。'), 'common', [68, 30, 30, 22, 40, 45], 'a little scout peering through binoculars over a small map, leaf-green theme colour.'),
  archetype('STEADY', localizedText('Steady Shipper', '稳健交付者'), localizedText('Not flashy, but every step counts.', '不快，但每步都算数。'), localizedText('Steady execution', '稳扎稳打'), localizedText('Keep it steady.', '稳一点。'), 'common', [45, 25, 58, 70, 40, 25], 'a steady little figure stacking neat blocks one by one, calm expression, slate-blue theme colour.'),
  archetype('FIRE', localizedText('Firefighter', '救火队员'), localizedText('Goes wherever the error is burning.', '哪里报错我去哪里。'), localizedText('Incident fixer', '救场专精'), localizedText('I will put it out.', '我来灭火。'), 'uncommon', [30, 80, 65, 66, 45, 30], 'a little firefighter spraying a tiny burning bug with an extinguisher, red theme colour.'),
  archetype('MARATHON', localizedText('Marathon Runner', '长跑者'), localizedText('Keeps going when the road gets dark.', '一条道走到黑，黑了点灯继续。'), localizedText('Long-haul stamina', '持久续航'), localizedText('Keep running.', '继续跑。'), 'rare', [20, 22, 35, 72, 35, 10], 'a determined little runner with a headlamp on a long road at dusk, teal theme colour.'),
  archetype('NIGHT', localizedText('Night Walker', '夜行者'), localizedText('The best ideas arrive around 3 a.m.', '灵感都在凌晨三点找上门。'), localizedText('Moonlight coder', '月光码农'), localizedText('Clearest after dark.', '夜里最清醒。'), 'rare', [58, 62, 35, 42, 90, 55], 'a cozy little figure wrapped in a blanket holding coffee, a moon and stars overhead, faint dark circles, deep-purple theme colour.'),
  archetype('CHILL', localizedText('Chill Coder', '佛系码农'), localizedText('If it runs, optimization can wait its turn.', '能跑就行，缘分到了再优化。'), localizedText('Relaxed iteration', '随缘开发'), localizedText('When the time comes.', '缘分到了再说。'), 'common', [50, 42, 50, 40, 45, 50], 'a relaxed little figure lounging cross-legged with a faint zen halo and a mug, soft-green theme colour.'),
  archetype('STAR', localizedText('Hexagon Ace', '六边形战士'), localizedText('Breadth, depth, delivery: somehow all of it.', '广度深度交付全都要，老天爷赏饭。'), localizedText('All-rounder', '全能'), localizedText('All of it.', '全都要。'), 'legendary', [50, 18, 45, 78, 40, 28], 'a radiant little hero with a hexagram aura and a small medal, balanced confident pose, gold theme colour.'),
];

export const EGGS: PersonaEgg[] = [
  egg('OWL', localizedText('Night Owl', '夜枭'), localizedText('Inspiration and dark circles come online together.', '灵感与黑眼圈同时上线。'), localizedText('Late-night species', '深夜物种'), localizedText('Sleep after sunrise.', '天亮再睡。'), 'hidden', 'a tiny wide-awake owl-eared figure under a crescent moon with prominent dark circles, glowing screen reflection, midnight-blue theme colour.', (s) => s.nightShare > 0.5),
  egg('VOID', localizedText('No Sediment Found', '查无沉淀'), localizedText('No durable project knowledge has settled yet.', '你的项目还没沉淀下任何知识。'), localizedText('Unclassified', '未知分类'), localizedText('404.', '404。'), 'hidden', 'a translucent glowing question-mark ghost holding a small "404" sign, neutral-grey theme colour.', (s) => s.milestoneCount > 0 && s.writes === 0),
  egg('GHOST', localizedText('Halfway Ghost', '半途魂'), localizedText('Too many tasks stopped halfway through.', '太多任务停在了一半。'), localizedText('Interrupted flow', '半途而废'), localizedText('Next time, surely.', '下次一定。'), 'hidden', 'a faded little ghost trailing off into wisps, half-finished outline, pale-cyan theme colour.', (s) => s.interruptedShare > 0.4),
];

/** Lookup by code across both regular archetypes and eggs. */
export function archetypeByCode(code: string): PersonaArchetype | PersonaEgg | undefined {
  return ARCHETYPES.find((a) => a.code === code) || EGGS.find((e) => e.code === code);
}
