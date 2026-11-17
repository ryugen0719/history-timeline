import type { EventCategory, HistoricalEvent } from '../types/timeline';

export type EventIconKind =
  | 'ship'
  | 'handshake'
  | 'scroll'
  | 'scale'
  | 'shield-alert'
  | 'swords'
  | 'train'
  | 'graduation'
  | 'coins'
  | 'flask'
  | 'palette'
  | 'book'
  | 'crown'
  | 'users'
  | 'landmark';

export interface EventIconMeta {
  kind: EventIconKind;
  label: string;
}

const TITLE_RULES: Array<{ pattern: RegExp; meta: EventIconMeta }> = [
  {
    pattern: /来航|黒船|艦隊|航海|海戦|渡海|遣唐使|遣隋使|出島/,
    meta: { kind: 'ship', label: '来航・海事' },
  },
  {
    pattern: /憲法|人権宣言|御誓文|論題|勅語|詔書|宣言/,
    meta: { kind: 'scroll', label: '憲法・宣言・文書' },
  },
  {
    pattern: /法典|裁判|司法|法制|律令/,
    meta: { kind: 'scale', label: '法典・制度' },
  },
  {
    pattern: /条約|同盟|議定書|協定|講和|会談|友好|和親|通商/,
    meta: { kind: 'handshake', label: '条約・同盟・外交' },
  },
  {
    pattern: /大獄|恐怖政治|弾圧|禁教|追放|粛清/,
    meta: { kind: 'shield-alert', label: '弾圧・処罰' },
  },
  {
    pattern: /戦争|戦い|の変|の乱|襲撃|クーデター|征討|遠征|討伐|一揆/,
    meta: { kind: 'swords', label: '戦争・事件・動乱' },
  },
  {
    pattern: /鉄道|新橋|蒸気|汽車|開通/,
    meta: { kind: 'train', label: '交通・鉄道' },
  },
  {
    pattern: /学制|学校|寺子屋|藩校|教育|大学|識字/,
    meta: { kind: 'graduation', label: '教育・学問' },
  },
  {
    pattern: /地租|税|貨幣|通貨|経済|財政|産業革命|貿易|殖産|銀行/,
    meta: { kind: 'coins', label: '経済・税制' },
  },
  {
    pattern: /印刷|科学|発明|技術|医学|天文学|電気/,
    meta: { kind: 'flask', label: '科学・技術' },
  },
  {
    pattern: /ルネサンス|美術|芸術|文芸|文化|建築|歌舞伎|浮世絵/,
    meta: { kind: 'palette', label: '文化・芸術' },
  },
  {
    pattern: /宗教|キリスト|仏教|神道|ルター|教会|寺院|儀礼|伝承/,
    meta: { kind: 'book', label: '宗教・思想・文化' },
  },
  {
    pattern: /皇帝|即位|統一|王朝|王政|天皇/,
    meta: { kind: 'crown', label: '王朝・統治' },
  },
  {
    pattern: /議会|三部会|大政奉還|廃藩置県|民主政|共和政|改革|維新|内閣|政府/,
    meta: { kind: 'landmark', label: '政治・議会・体制' },
  },
];

const CATEGORY_FALLBACK: Record<EventCategory, EventIconMeta> = {
  politics: { kind: 'landmark', label: '政治・制度' },
  diplomacy: { kind: 'handshake', label: '外交・国際' },
  economy: { kind: 'coins', label: '経済・財政' },
  military: { kind: 'swords', label: '軍事・紛争' },
  society: { kind: 'users', label: '社会・暮らし' },
  culture: { kind: 'palette', label: '文化・芸術' },
  religion: { kind: 'book', label: '宗教・思想' },
  science: { kind: 'flask', label: '科学・技術' },
};

export function resolveEventIcon(ev: Pick<HistoricalEvent, 'title' | 'description' | 'category'>): EventIconMeta {
  const title = (ev.title ?? '').trim();
  for (const rule of TITLE_RULES) {
    if (rule.pattern.test(title)) {
      return rule.meta;
    }
  }

  const desc = (ev.description ?? '').trim();
  for (const rule of TITLE_RULES) {
    if (rule.pattern.test(desc)) {
      return rule.meta;
    }
  }

  const primaryCat = ev.category[0];
  if (primaryCat && primaryCat in CATEGORY_FALLBACK) {
    return CATEGORY_FALLBACK[primaryCat];
  }

  return { kind: 'landmark', label: '歴史的出来事' };
}
