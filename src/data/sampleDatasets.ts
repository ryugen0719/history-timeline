import type { HistoricalDatabase } from '../types/timeline';
import { parseHistoricalJson } from '../utils/timelineParser';
import term3TimelineJson from './term3Timeline.json';

export interface SampleDatasetPreset {
  id: string;
  name: string;
  subtitle: string;
  data: HistoricalDatabase;
}

export const DEFAULT_TIMELINE_VERSION = 'term3-exam-2026-v1';
const LEGACY_DEFAULT_TITLE = '幕末〜明治維新：近代日本の夜明け';

const TERM3_TIMELINE_DATA = term3TimelineJson as HistoricalDatabase;

export const GENERATION_PROMPT_TEMPLATE = `# 歴史年表データ生成プロンプト

あなたは日本史・世界史の教材分析と歴史データ整理を専門とするアシスタントです。

提供された授業データ（授業プリント、教科書、ノート、PDF、画像など）を分析し、歴史年表の元データとなる「出来事データベース」を作成してください。

## 目的
歴史上の出来事を時系列に整理し、後から年表・因果関係図・時代別マップなどに加工できるデータを作ること。

## 抽出ルール
1. 資料に記載されている歴史上の出来事を漏れなく抽出する。
2. 重要な出来事だけでなく、出来事の理解に必要な背景や関連事件も抽出する。
3. 1つの出来事につき1レコードにする。
4. 同じ出来事の重複登録を避ける。
5. 年号・年月日は資料の表記を優先する。
6. 年号が不明な場合は推測せず「不明」とする。
7. 世紀・時代・年代しか分からない場合は、その精度を維持する。
8. 原因と結果は資料に根拠がある場合のみ記載する。
9. 資料に書かれていない情報を勝手に補わない。
10. 重要人物・条約・戦争・改革・制度・文化的出来事も対象にする。

## 出力形式
JSON形式で出力してください（説明文やMarkdownコードブロックは不要）。`;

export const SAMPLE_DATASETS: SampleDatasetPreset[] = [
  {
    id: 'term3-exam',
    name: '第三回定期考査範囲',
    subtitle:
      '近代的な国際関係・帝国主義・第一次世界大戦・アジアの民族運動（17世紀〜1936年 / 198件）',
    data: TERM3_TIMELINE_DATA,
  },
  {
    id: 'bakumatsu-meiji',
    name: '幕末〜明治維新：近代日本の夜明け',
    subtitle: '開国・倒幕・近代国家形成の連鎖（1853–1890年 / 14件）',
    data: {
      events: [
        {
          id: 'E001',
          date: '1853-07-08',
          date_precision: 'day',
          title: 'ペリー来航',
          description:
            'アメリカ東インド艦隊司令長官マシュー・ペリーが4隻の軍艦（黒船）を率いて浦賀に来航し、大統領国書を提出して開国を要求した。',
          people: ['マシュー・ペリー', '阿部正弘'],
          places: ['浦賀', '江戸湾'],
          category: ['diplomacy', 'military'],
          causes: [
            'アメリカによる太平洋捕鯨船の寄港地確保と中国貿易の中継地需要',
            '欧米列強のアジア進出の本格化',
          ],
          consequences: [
            '幕府が朝廷や諸大名に外交意見を諮問し、幕府専制体制が動揺した',
            '翌年の日米和親条約締結への直接的契機となった',
          ],
          related_events: ['E002', 'E003'],
          importance: 3,
          source: '日本史探究 授業資料 p.1「開国と幕末の動乱」',
          certainty: 'explicit',
        },
        {
          id: 'E002',
          date: '1854-03-31',
          date_precision: 'day',
          title: '日米和親条約の締結',
          description:
            '江戸幕府がアメリカと締結した最初の和親条約。下田・箱館の2港を開港し、薪水・食料の供給と領事駐在を認めた。',
          people: ['マシュー・ペリー', '林復斎'],
          places: ['横浜', '下田', '箱館'],
          category: ['diplomacy'],
          causes: ['ペリーの再来航による軍事的圧力', '幕府内の開国容認論の台頭'],
          consequences: [
            '江戸幕府の約200年にわたる鎖国体制が実質的に終了した',
            'イギリス・ロシア・オランダとも同様の和親条約を締結した',
          ],
          related_events: ['E001', 'E003'],
          importance: 3,
          source: '日本史探究 授業資料 p.2「和親条約と開港」',
          certainty: 'explicit',
        },
        {
          id: 'E003',
          date: '1858-07-29',
          date_precision: 'day',
          title: '日米修好通商条約の調印',
          description:
            '大老井伊直弼が朝廷の勅許を得ないまま調印した通商条約。神奈川・長崎・新潟・兵庫の開港と自由貿易を定めたが、領事裁判権の承認と関税自主権の欠如という不平等条項を含んでいた。',
          people: ['井伊直弼', 'タウンゼント・ハリス', '堀田正睦'],
          places: ['江戸', '神奈川', '長崎', '兵庫'],
          category: ['diplomacy', 'economy'],
          causes: [
            '初代駐日総領事ハリスによる通商条約締結の強い要求',
            'アロー戦争での清の敗北を背景とした外交的危機感',
          ],
          consequences: [
            '生糸などの輸出急増と物価高騰により国内経済が混乱した',
            '無勅許調印に対する尊王攘夷運動が激化した',
            '明治期を通じた条約改正運動の出発点となった',
          ],
          related_events: ['E002', 'E004', 'E005'],
          importance: 3,
          source: '日本史探究 授業資料 p.3「安政五カ国条約」',
          certainty: 'explicit',
        },
        {
          id: 'E004',
          date: '1858',
          date_precision: 'year',
          title: '安政の大獄',
          description:
            '大老井伊直弼が将軍継嗣問題（一橋派）や条約無勅許調印への批判派（尊王攘夷派）を大規模に弾圧した事件。吉田松陰や橋本左内らが処刑された。',
          people: ['井伊直弼', '吉田松陰', '橋本左内', '徳川斉昭'],
          places: ['江戸', '京都'],
          category: ['politics'],
          causes: ['日米修好通商条約の無勅許調印に対する反発', '将軍継嗣をめぐる南紀派と一橋派の対立'],
          consequences: ['水戸藩・薩摩藩の浪士による井伊直弼襲撃（桜田門外の変）を招いた'],
          related_events: ['E003', 'E005'],
          importance: 2,
          source: '日本史探究 授業資料 p.4「大獄と公武合体」',
          certainty: 'explicit',
        },
        {
          id: 'E005',
          date: '1860-03',
          date_precision: 'month',
          title: '桜田門外の変',
          description:
            '水戸脱藩浪士ら18名が江戸城桜田門外で大老井伊直弼を襲撃し暗殺した事件。',
          people: ['井伊直弼'],
          places: ['江戸'],
          category: ['politics'],
          causes: ['安政の大獄による苛烈な弾圧への反発'],
          consequences: ['江戸幕府の威信と統制力が決定的に低下した', '幕府が公武合体策へ転換する契機となった'],
          related_events: ['E004', 'E006'],
          importance: 2,
          source: '日本史探究 授業資料 p.4「幕府権威の失墜」',
          certainty: 'explicit',
        },
        {
          id: 'E006',
          date: '1866-01',
          date_precision: 'month',
          title: '薩長同盟の成立',
          description:
            '坂本龍馬や中岡慎太郎の仲介により、対立していた薩摩藩（西郷隆盛・大久保利通）と長州藩（木戸孝允）が京都で秘密裏に軍事同盟を締結した。',
          people: ['西郷隆盛', '大久保利通', '木戸孝允', '坂本龍馬'],
          places: ['京都', '薩摩', '長州'],
          category: ['politics', 'military'],
          causes: [
            '幕府による長州征討への対抗',
            '薩摩藩の公武合体路線から倒幕路線への転換',
            '長州藩の武器不足と薩摩藩の兵糧米不足の相互補完',
          ],
          consequences: ['第二次長州征討における幕府軍の敗北', '武力倒幕への道が開かれた'],
          related_events: ['E007'],
          importance: 3,
          source: '日本史探究 授業資料 p.6「薩長同盟と倒幕」',
          certainty: 'explicit',
        },
        {
          id: 'E007',
          date: '1867-11-09',
          date_precision: 'day',
          title: '大政奉還',
          description:
            '15代将軍徳川慶喜が土佐藩主山内容堂の建白を受け入れ、京都二条城で政権を朝廷に返上した。',
          people: ['徳川慶喜', '山内容堂', '坂本龍馬'],
          places: ['京都'],
          category: ['politics'],
          causes: ['薩長を中心とする倒幕運動の高まり', '徳川家中心の諸侯会議体制で実権を維持しようとする政治判断'],
          consequences: ['260年以上続いた江戸幕府が終了した', '王政復古の大号令と戊辰戦争へとつながった'],
          related_events: ['E006', 'E008'],
          importance: 3,
          source: '日本史探究 授業資料 p.7「大政奉還と王政復古」',
          certainty: 'explicit',
        },
        {
          id: 'E008',
          date: '1868-01-03',
          date_precision: 'day',
          title: '王政復古の大号令と戊辰戦争の勃発',
          description:
            '薩摩・長州などの討幕派がクーデターを実行し、摂政・関白・幕府の廃止と新政府樹立を宣言。続いて鳥羽・伏見の戦いを皮切りに戊辰戦争が始まった。',
          people: ['岩倉具視', '西郷隆盛', '大久保利通', '徳川慶喜'],
          places: ['京都', '鳥羽・伏見', '江戸', '会津', '箱館'],
          category: ['politics', 'military'],
          causes: ['大政奉還後も旧幕府勢力が政治的主導権を保持することへの討幕派の警戒'],
          consequences: ['新政府軍が旧幕府勢力を制圧し、明治新政府の全国支配が確立した'],
          related_events: ['E007', 'E009'],
          importance: 3,
          source: '日本史探究 授業資料 p.8「戊辰戦争」',
          certainty: 'explicit',
        },
        {
          id: 'E009',
          date: '1868-04-06',
          date_precision: 'day',
          title: '五箇条の御誓文の発布',
          description:
            '明治天皇が天地神明に誓う形で公布した明治新政府の基本方針。「広く会議を興し万機公論に決すべし」など、開国と公議世論の尊重を掲げた。',
          people: ['由利公正', '福岡孝弟', '木戸孝允'],
          places: ['京都'],
          category: ['politics'],
          causes: ['諸大名・公卿の協力を取りまとめ、新政府の正当性と近代化方針を示す必要性'],
          consequences: ['政体書の制定や後の自由民権運動における国会開設要求の根拠となった'],
          related_events: ['E008', 'E010'],
          importance: 3,
          source: '日本史探究 授業資料 p.9「新政府の成立」',
          certainty: 'explicit',
        },
        {
          id: 'E010',
          date: '1871',
          date_precision: 'year',
          title: '廃藩置県',
          description:
            '明治政府が全国の藩を廃止して府県を置き、旧藩主（知藩事）を東京へ移住させて中央から府知事・県令を派遣した。',
          people: ['大久保利通', '木戸孝允', '西郷隆盛'],
          places: ['東京', '全国各藩'],
          category: ['politics'],
          causes: ['版籍奉還後も残存した藩の独立性を解消し、中央集権体制と全国的な税制を確立するため'],
          consequences: ['実質的な封建制が消滅し、近代的統一国家の行政基盤が完成した'],
          related_events: ['E009', 'E011'],
          importance: 3,
          source: '日本史探究 授業資料 p.10「中央集権化」',
          certainty: 'explicit',
        },
        {
          id: 'E011',
          date: '1872',
          date_precision: 'year',
          title: '学制発布と新橋〜横浜間の鉄道開通',
          description:
            '国民皆学を目標とする近代学校制度（学制）が発布され、同年10月には日本初の鉄道が新橋〜横浜間で営業を開始した。',
          people: ['大隈重信', '井上勝'],
          places: ['東京', '新橋', '横浜'],
          category: ['society', 'science', 'economy'],
          causes: ['富国強兵・殖産興業政策に基づく人材育成と交通インフラ整備の急務'],
          consequences: ['近代教育の普及と文明開化の象徴として社会生活が大きく変化した'],
          related_events: ['E010', 'E012'],
          importance: 2,
          source: '日本史探究 授業資料 p.11「文明開化と三大改革」',
          certainty: 'explicit',
        },
        {
          id: 'E012',
          date: '1873',
          date_precision: 'year',
          title: '地租改正と徴兵令の施行',
          description:
            '土地の価格（地価）の3%を現金で納める地租改正条例と、満20歳以上の男子に兵役義務を課す徴兵令が施行された。',
          people: ['大久保利通', '山県有朋'],
          places: ['全国'],
          category: ['economy', 'military', 'society'],
          causes: ['年貢（米納）による歳入の不安定さの解消', '士族に依存しない近代的常備軍の創設'],
          consequences: ['政府の財政収入が安定したが、農民負担の重さから地租改正反対一揆が発生した'],
          related_events: ['E011', 'E013'],
          importance: 3,
          source: '日本史探究 授業資料 p.12「三大改革」',
          certainty: 'explicit',
        },
        {
          id: 'E013',
          date: '1889-02-11',
          date_precision: 'day',
          title: '大日本帝国憲法の発布',
          description:
            '天皇が臣民に与える欽定憲法として発布された東アジア初の近代的立憲憲法。プロイセン憲法を参考にし、天皇大権と臣民の権利・議会制度を定めた。',
          people: ['伊藤博文', '井上毅', 'ヘルマン・ロエスレル'],
          places: ['東京'],
          category: ['politics'],
          causes: ['自由民権運動による国会開設要求の高まり', '不平等条約改正に向けた近代法治国家としての体裁整備'],
          consequences: ['翌年の帝国議会開設によりアジア初の立憲政治が本格始動した'],
          related_events: ['E012', 'E014'],
          importance: 3,
          source: '日本史探究 授業資料 p.16「立憲国家の成立」',
          certainty: 'explicit',
        },
        {
          id: 'E014',
          date: '1890-11',
          date_precision: 'month',
          title: '第1回帝国議会の開会',
          description:
            '第1回衆議院議員総選挙を経て、貴族院・衆議院から成る帝国議会が開会した。初期議会では民党と藩閥政府が予算をめぐって激しく対立した。',
          people: ['山県有朋', '板垣退助', '大隈重信'],
          places: ['東京'],
          category: ['politics'],
          causes: ['大日本帝国憲法の施行と第1回総選挙の実施'],
          consequences: ['制限選挙ながら政党政治と議会審議が制度として定着していく契機となった'],
          related_events: ['E013'],
          importance: 2,
          source: '日本史探究 授業資料 p.17「初期議会」',
          certainty: 'inferred',
        },
      ],
    },
  },
  {
    id: 'french-revolution',
    name: 'フランス革命からウィーン体制',
    subtitle: '市民革命とヨーロッパ国際秩序の再編（1789–1815年 / 9件）',
    data: {
      events: [
        {
          id: 'FR01',
          date: '1789-05',
          date_precision: 'month',
          title: '三部会の招集と国民議会の結成',
          description:
            '深刻な財政危機を打開するためルイ16世が三部会を招集したが、議決方法をめぐり第三身分が分離して国民議会を結成した。',
          people: ['ルイ16世', 'シェイエス'],
          places: ['ヴェルサイユ'],
          category: ['politics', 'economy'],
          causes: ['アメリカ独立戦争支援などによる国家財政の破綻', '特権身分への課税をめぐる貴族の反発'],
          consequences: ['球戯場の誓いへと進み、絶対王政の枠組みが崩壊し始めた'],
          related_events: ['FR02'],
          importance: 3,
          source: '世界史探究 プリント第12回 p.1',
          certainty: 'explicit',
        },
        {
          id: 'FR02',
          date: '1789-07-14',
          date_precision: 'day',
          title: 'バスティーユ牢獄襲撃',
          description:
            'ネッケル罷免と軍隊集結に危機感を抱いたパリ市民が、武器を求めて専制政治の象徴であったバスティーユ牢獄を襲撃・占領した。',
          people: ['ジャック・ネッケル'],
          places: ['パリ'],
          category: ['politics', 'society'],
          causes: ['王室による国民議会への軍事的威圧の噂', 'パン価格の急騰による民衆の困窮'],
          consequences: ['全国的な農民反乱（大恐怖）が波及し、封建的特権の廃止につながった'],
          related_events: ['FR01', 'FR03'],
          importance: 3,
          source: '世界史探究 プリント第12回 p.1',
          certainty: 'explicit',
        },
        {
          id: 'FR03',
          date: '1789-08-26',
          date_precision: 'day',
          title: 'フランス人権宣言の採択',
          description:
            '国民議会が「人は生まれながらにして自由かつ平等である」と謳う全17条の「人間と市民の権利の宣言」を採択した。',
          people: ['ラファイエット'],
          places: ['パリ'],
          category: ['politics', 'culture'],
          causes: ['啓蒙思想の普及とアメリカ独立宣言の影響', '旧制度（アンシャン・レジーム）の法的否定の必要性'],
          consequences: ['国民主権・基本的人権・所有権不可侵の原則が近代市民社会の規範となった'],
          related_events: ['FR02', 'FR04'],
          importance: 3,
          source: '世界史探究 プリント第12回 p.2',
          certainty: 'explicit',
        },
        {
          id: 'FR04',
          date: '1792-09',
          date_precision: 'month',
          title: 'ヴァルミーの戦いと第一共和政の樹立',
          description:
            '革命の波及を恐れたプロイセン・オーストリア連合軍をフランス革命軍がヴァルミーで撃退し、翌日発足した国民公会が王政廃止・共和政を宣言した。',
          people: ['ダントン', 'ロベスピエール'],
          places: ['ヴァルミー', 'パリ'],
          category: ['military', 'politics'],
          causes: ['ピルニッツ宣言による周辺諸国の干渉', '8月10日事件による王権停止'],
          consequences: ['1793年1月のルイ16世処刑と第1回対仏大同盟の結成につながった'],
          related_events: ['FR03', 'FR05'],
          importance: 3,
          source: '世界史探究 プリント第13回 p.1',
          certainty: 'explicit',
        },
        {
          id: 'FR05',
          date: '1793',
          date_precision: 'year',
          title: 'ジャコバン派による恐怖政治と1793年憲法',
          description:
            'ロベスピエール率いる公安委員会が徴兵制や最高価格令を実施して内外の危機に対処する一方、反革命容疑者を多数処刑した。',
          people: ['ロベスピエール', 'サン＝ジュスト'],
          places: ['パリ'],
          category: ['politics', 'economy', 'society'],
          causes: ['対仏大同盟との戦争激化', '国内の反革命反乱（ヴァンデの反乱）と食糧危機'],
          consequences: ['恐怖政治への反発から1794年のテルミドールの反動でロベスピエールが失脚した'],
          related_events: ['FR04', 'FR06'],
          importance: 2,
          source: '世界史探究 プリント第13回 p.2',
          certainty: 'explicit',
        },
        {
          id: 'FR06',
          date: '1799-11-09',
          date_precision: 'day',
          title: 'ブリュメール18日のクーデター',
          description:
            'エジプト遠征から帰国したナポレオン・ボナパルトが総裁政府を倒し、統領政府を樹立して第一統領に就任した。',
          people: ['ナポレオン・ボナパルト', 'シェイエス'],
          places: ['パリ'],
          category: ['politics', 'military'],
          causes: ['総裁政府の腐敗と政治的不安定', '強力な指導力を求めるブルジョワジーの支持'],
          consequences: ['フランス革命の収束とナポレオン独裁体制の確立'],
          related_events: ['FR05', 'FR07'],
          importance: 3,
          source: '世界史探究 プリント第14回 p.1',
          certainty: 'explicit',
        },
        {
          id: 'FR07',
          date: '1804',
          date_precision: 'year',
          title: 'ナポレオン法典の発布と皇帝即位',
          description:
            '法の前の平等や私有財産の不可侵を明文化したフランス民法典（ナポレオン法典）を発布し、同年12月に国民投票を経て皇帝に即位した。',
          people: ['ナポレオン・ボナパルト'],
          places: ['パリ'],
          category: ['politics', 'society'],
          causes: ['革命の成果（市民的自由・土地所有）を法的に定着させる必要性'],
          consequences: ['フランス法典が欧州各地に広がり、近代私法の模範となった'],
          related_events: ['FR06', 'FR08'],
          importance: 3,
          source: '世界史探究 プリント第14回 p.2',
          certainty: 'explicit',
        },
        {
          id: 'FR08',
          date: '1812',
          date_precision: 'year',
          title: 'ロシア遠征の失敗',
          description:
            '大陸封鎖令に反発したロシアに対しナポレオンが約60万の大軍で侵攻したが、ロシア軍の焦土作戦と厳冬により壊滅的敗北を喫した。',
          people: ['ナポレオン・ボナパルト', 'アレクサンドル1世'],
          places: ['モスクワ', 'ロシア'],
          category: ['military', 'diplomacy'],
          causes: ['ロシアによる大陸封鎖令（ベルリン勅令）の事実上の破棄'],
          consequences: ['ヨーロッパ諸国の解放戦争が本格化し、ナポレオン帝国の崩壊が決定づいた'],
          related_events: ['FR07', 'FR09'],
          importance: 3,
          source: '世界史探究 プリント第15回 p.1',
          certainty: 'explicit',
        },
        {
          id: 'FR09',
          date: '1815-06',
          date_precision: 'month',
          title: 'ウィーン議定書の調印とワーテルローの戦い',
          description:
            'ナポレオン戦争後のヨーロッパ国際秩序を正統主義と勢力均衡に基づいて再編するウィーン議定書が調印され、続いてワーテルローの戦いでナポレオンが最終敗北した。',
          people: ['メッテルニヒ', 'タレーラン', 'ウェリントン', 'ナポレオン・ボナパルト'],
          places: ['ウィーン', 'ワーテルロー'],
          category: ['diplomacy', 'military'],
          causes: ['ナポレオン支配からの解放と旧体制（正統主義）の復興欲求'],
          consequences: ['ウィーン体制が成立し、自由主義・国民主義運動への抑圧が約30年間続いた'],
          related_events: ['FR08'],
          importance: 3,
          source: '世界史探究 プリント第15回 p.2',
          certainty: 'inferred',
        },
      ],
    },
  },
  {
    id: 'precision-showcase',
    name: '古代〜近代・多様な年代精度サンプル',
    subtitle: '紀元前・世紀・時代名・年代不明を含むデータ形式テスト用（7件）',
    data: {
      events: [
        {
          id: 'S001',
          date: '紀元前5世紀',
          date_precision: 'century',
          title: 'アテネ民主政の黄金時代（ペリクレス時代）',
          description:
            '将軍ペリクレスのもとで直接民主政が完成に近づき、パルテノン神殿の造営など古典ギリシア文化が栄えた。',
          people: ['ペリクレス'],
          places: ['アテネ'],
          category: ['politics', 'culture'],
          causes: ['ペルシア戦争における無産市民の海軍での活躍'],
          consequences: ['デロス同盟の資金を用いたアテネの繁栄とスパルタとの対立激化'],
          related_events: [],
          importance: 3,
          source: '世界史ノート p.8',
          certainty: 'explicit',
        },
        {
          id: 'S002',
          date: '紀元前221年',
          date_precision: 'year',
          title: '秦の中国統一',
          description:
            '秦王政（始皇帝）が戦国七雄の最後である斉を滅ぼし、史上初めて中国全土を統一した。',
          people: ['始皇帝', '李斯'],
          places: ['咸陽'],
          category: ['politics', 'military'],
          causes: ['商鞅の変法による富国強兵の成功'],
          consequences: ['郡県制の全国施行と文字・貨幣・度量衡の統一'],
          related_events: [],
          importance: 3,
          source: '世界史ノート p.15',
          certainty: 'explicit',
        },
        {
          id: 'S003',
          date: '14世紀後半',
          date_precision: 'century',
          title: 'イタリア・ルネサンスの開花',
          description:
            'フィレンツェなど北イタリアの都市国家を中心に、古典古代の人間中心主義（ヒューマニズム）を復興する文化運動が広がった。',
          people: ['ペトラルカ', 'ボッカッチョ'],
          places: ['フィレンツェ', 'ローマ'],
          category: ['culture', 'religion'],
          causes: ['東方貿易による都市の経済的繁栄とビザンツ帝国からの学者流入'],
          consequences: ['近代科学や宗教改革へとつながる精神的変革の土壌形成'],
          related_events: ['S004'],
          importance: 3,
          source: '世界史ノート p.42',
          certainty: 'inferred',
        },
        {
          id: 'S004',
          date: '1450年代',
          date_precision: 'period',
          title: 'グーテンベルクによる活版印刷術の改良',
          description:
            '金属活字と油性インク、印刷機を組み合わせた実用的な活版印刷技術がドイツで確立された。',
          people: ['ヨハネス・グーテンベルク'],
          places: ['マインツ'],
          category: ['science', 'culture'],
          causes: ['製紙法の伝播と書籍需要の増大'],
          consequences: ['ルネサンス思想やルターの宗教改革の主張が急速に欧州へ拡散した'],
          related_events: ['S003', 'S005'],
          importance: 3,
          source: '世界史ノート p.44',
          certainty: 'explicit',
        },
        {
          id: 'S005',
          date: '1517-10-31',
          date_precision: 'day',
          title: 'ルターの「九十五か条の論題」発表',
          description:
            '神学者マルティン・ルターが贖宥状の販売を批判する論題を提示し、宗教改革の端緒となった。',
          people: ['マルティン・ルター', 'レオ10世'],
          places: ['ヴィッテンベルク'],
          category: ['religion', 'society'],
          causes: ['サン＝ピエトロ大聖堂改築資金のための贖宥状販売'],
          consequences: ['プロテスタント諸派の誕生とドイツ農民戦争への波及'],
          related_events: ['S004'],
          importance: 3,
          source: '世界史ノート p.47',
          certainty: 'explicit',
        },
        {
          id: 'S006',
          date: '江戸時代',
          date_precision: 'period',
          title: '寺子屋・藩校による識字率の向上',
          description:
            '武士向けの藩校に加え、庶民の子弟が読み・書き・そろばんを学ぶ寺子屋が各地に普及した。',
          people: [],
          places: ['江戸', '全国諸藩'],
          category: ['society', 'culture'],
          causes: ['貨幣経済の浸透と出版文化の発達による実務教育の需要'],
          consequences: ['明治期の近代教育制度（学制）が迅速に定着する素地となった'],
          related_events: [],
          importance: 2,
          source: '日本史プリント「近世の教育」',
          certainty: 'inferred',
        },
        {
          id: 'S007',
          date: '不明',
          date_precision: 'unknown',
          title: '初期の口承伝承・民俗儀礼の形成',
          description:
            '資料上に明確な年号記載がない地域社会の共同体儀礼に関する補足記録。',
          people: [],
          places: ['不明'],
          category: ['society', 'religion'],
          causes: ['農耕生活における季節の節目と共同体結束の維持'],
          consequences: [],
          related_events: [],
          importance: 1,
          source: '配布プリント補足欄（年号記載なし）',
          certainty: 'inferred',
        },
      ],
    },
  },
];

export interface InitialTimelineResolution {
  db: HistoricalDatabase;
  title: string;
  migratedFromLegacyDefault: boolean;
}

function isLegacyDefaultDataset(
  db: HistoricalDatabase,
  savedTitle: string | null
): boolean {
  return (
    savedTitle === LEGACY_DEFAULT_TITLE &&
    db.events.length === 14 &&
    db.events[0]?.id === 'E001' &&
    db.events[0]?.title === 'ペリー来航'
  );
}

export function resolveInitialTimelineState(params: {
  savedJson: string | null;
  savedTitle: string | null;
  savedDefaultVersion: string | null;
}): InitialTimelineResolution {
  const defaultDataset = SAMPLE_DATASETS[0];
  const { savedJson, savedTitle, savedDefaultVersion } = params;

  if (savedJson) {
    const parsed = parseHistoricalJson(savedJson);
    if (parsed.ok && parsed.data) {
      if (
        savedDefaultVersion !== DEFAULT_TIMELINE_VERSION &&
        isLegacyDefaultDataset(parsed.data, savedTitle)
      ) {
        return {
          db: defaultDataset.data,
          title: defaultDataset.name,
          migratedFromLegacyDefault: true,
        };
      }
      return {
        db: parsed.data,
        title: savedTitle || '保存された歴史年表',
        migratedFromLegacyDefault: false,
      };
    }
  }

  return {
    db: defaultDataset.data,
    title: defaultDataset.name,
    migratedFromLegacyDefault: false,
  };
}

