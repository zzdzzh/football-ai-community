-- 扩充 Fan Persona：各联赛补足角色；persona 自带 league_code，避免比赛 sync 覆盖 teams.league_code 后筛选错乱
PRAGMA foreign_keys = ON;

-- Persona 自有联赛码（与 teams.league_code 解耦）
ALTER TABLE fan_personas ADD COLUMN league_code TEXT;

-- 稳定球队行（fan-* / 既有 cl-* / wc-*），不被 football-data 数字 ID sync 覆盖队名与联赛
INSERT OR IGNORE INTO teams (id, name, short_name, tla, league_code, updated_at) VALUES
  -- 英超
  ('fan-pl-arsenal', 'Arsenal FC', 'Arsenal', 'ARS', 'PL', datetime('now')),
  ('fan-pl-liverpool', 'Liverpool FC', 'Liverpool', 'LIV', 'PL', datetime('now')),
  ('fan-pl-manutd', 'Manchester United FC', 'Man United', 'MUN', 'PL', datetime('now')),
  ('fan-pl-chelsea', 'Chelsea FC', 'Chelsea', 'CHE', 'PL', datetime('now')),
  ('fan-pl-mancity', 'Manchester City FC', 'Man City', 'MCI', 'PL', datetime('now')),
  ('fan-pl-tottenham', 'Tottenham Hotspur FC', 'Tottenham', 'TOT', 'PL', datetime('now')),
  ('fan-pl-newcastle', 'Newcastle United FC', 'Newcastle', 'NEW', 'PL', datetime('now')),
  -- 西甲
  ('fan-pd-barcelona', 'FC Barcelona', 'Barcelona', 'BAR', 'PD', datetime('now')),
  ('fan-pd-realmadrid', 'Real Madrid CF', 'Real Madrid', 'RMA', 'PD', datetime('now')),
  ('fan-pd-atletico', 'Atlético de Madrid', 'Atlético', 'ATM', 'PD', datetime('now')),
  ('fan-pd-betis', 'Real Betis Balompié', 'Betis', 'BET', 'PD', datetime('now')),
  ('fan-pd-realsociedad', 'Real Sociedad de Fútbol', 'Real Sociedad', 'RSO', 'PD', datetime('now')),
  ('fan-pd-sevilla', 'Sevilla FC', 'Sevilla', 'SEV', 'PD', datetime('now')),
  ('fan-pd-valencia', 'Valencia CF', 'Valencia', 'VAL', 'PD', datetime('now')),
  -- 德甲
  ('fan-bl1-bayern', 'FC Bayern München', 'Bayern', 'FCB', 'BL1', datetime('now')),
  ('fan-bl1-dortmund', 'Borussia Dortmund', 'Dortmund', 'BVB', 'BL1', datetime('now')),
  ('fan-bl1-leverkusen', 'Bayer 04 Leverkusen', 'Leverkusen', 'B04', 'BL1', datetime('now')),
  ('fan-bl1-stuttgart', 'VfB Stuttgart', 'Stuttgart', 'VFB', 'BL1', datetime('now')),
  ('fan-bl1-frankfurt', 'Eintracht Frankfurt', 'Frankfurt', 'SGE', 'BL1', datetime('now')),
  ('fan-bl1-gladbach', 'Borussia Mönchengladbach', 'Gladbach', 'BMG', 'BL1', datetime('now')),
  ('fan-bl1-leipzig', 'RB Leipzig', 'Leipzig', 'RBL', 'BL1', datetime('now')),
  -- 意甲
  ('fan-sa-juventus', 'Juventus FC', 'Juventus', 'JUV', 'SA', datetime('now')),
  ('fan-sa-milan', 'AC Milan', 'Milan', 'MIL', 'SA', datetime('now')),
  ('fan-sa-inter', 'FC Internazionale Milano', 'Inter', 'INT', 'SA', datetime('now')),
  ('fan-sa-roma', 'AS Roma', 'Roma', 'ROM', 'SA', datetime('now')),
  ('fan-sa-lazio', 'SS Lazio', 'Lazio', 'LAZ', 'SA', datetime('now')),
  ('fan-sa-napoli', 'SSC Napoli', 'Napoli', 'NAP', 'SA', datetime('now')),
  ('fan-sa-atalanta', 'Atalanta BC', 'Atalanta', 'ATA', 'SA', datetime('now')),
  -- 法甲
  ('fan-fl1-psg', 'Paris Saint-Germain FC', 'PSG', 'PSG', 'FL1', datetime('now')),
  ('fan-fl1-marseille', 'Olympique de Marseille', 'Marseille', 'OM', 'FL1', datetime('now')),
  ('fan-fl1-lyon', 'Olympique Lyonnais', 'Lyon', 'OL', 'FL1', datetime('now')),
  ('fan-fl1-monaco', 'AS Monaco FC', 'Monaco', 'ASM', 'FL1', datetime('now')),
  ('fan-fl1-lille', 'Lille OSC', 'Lille', 'LIL', 'FL1', datetime('now')),
  ('fan-fl1-nice', 'OGC Nice', 'Nice', 'NIC', 'FL1', datetime('now')),
  -- 欧冠 / 世界杯（补充）
  ('cl-mci', 'Manchester City FC', 'Man City', 'MCI', 'CL', datetime('now')),
  ('cl-bay', 'FC Bayern München', 'Bayern', 'FCB', 'CL', datetime('now')),
  ('cl-psg', 'Paris Saint-Germain FC', 'PSG', 'PSG', 'CL', datetime('now')),
  ('cl-int', 'FC Internazionale Milano', 'Inter', 'INT', 'CL', datetime('now')),
  ('cl-liv', 'Liverpool FC', 'Liverpool', 'LIV', 'CL', datetime('now')),
  ('wc-arg', 'Argentina', 'Argentina', 'ARG', 'WC', datetime('now')),
  ('wc-ger', 'Germany', 'Germany', 'GER', 'WC', datetime('now')),
  ('wc-esp', 'Spain', 'Spain', 'ESP', 'WC', datetime('now')),
  ('wc-por', 'Portugal', 'Portugal', 'POR', 'WC', datetime('now'));

-- 将既有 Persona 迁到稳定球队行，并写上 league_code
UPDATE fan_personas SET team_id = 'fan-pl-arsenal', league_code = 'PL',
  style_traits_json = '["乐观","护短","数据派"]', updated_at = datetime('now') WHERE id = 'persona-arsenal';
UPDATE fan_personas SET team_id = 'fan-pl-liverpool', league_code = 'PL', updated_at = datetime('now') WHERE id = 'persona-liverpool';
UPDATE fan_personas SET team_id = 'fan-pl-manutd', league_code = 'PL', updated_at = datetime('now') WHERE id = 'persona-manutd';
UPDATE fan_personas SET team_id = 'fan-pd-barcelona', league_code = 'PD', updated_at = datetime('now') WHERE id = 'persona-barcelona';
UPDATE fan_personas SET team_id = 'fan-pd-realmadrid', league_code = 'PD', updated_at = datetime('now') WHERE id = 'persona-realmadrid';
UPDATE fan_personas SET team_id = 'fan-pd-atletico', league_code = 'PD',
  style_traits_json = '["防守反击","硬朗","西蒙尼信徒"]', updated_at = datetime('now') WHERE id = 'persona-atletico';
UPDATE fan_personas SET team_id = 'fan-bl1-bayern', league_code = 'BL1', updated_at = datetime('now') WHERE id = 'persona-bayern';
UPDATE fan_personas SET team_id = 'fan-bl1-dortmund', league_code = 'BL1', updated_at = datetime('now') WHERE id = 'persona-dortmund';
UPDATE fan_personas SET team_id = 'fan-bl1-leverkusen', league_code = 'BL1',
  display_name = '药厂铁杆小李', updated_at = datetime('now') WHERE id = 'persona-leverkusen';
UPDATE fan_personas SET team_id = 'fan-sa-juventus', league_code = 'SA', updated_at = datetime('now') WHERE id = 'persona-juventus';
UPDATE fan_personas SET team_id = 'fan-sa-milan', league_code = 'SA', updated_at = datetime('now') WHERE id = 'persona-milan';
UPDATE fan_personas SET team_id = 'fan-sa-inter', league_code = 'SA',
  style_traits_json = '["务实","三冠王回忆","德比狂热"]', updated_at = datetime('now') WHERE id = 'persona-inter';
UPDATE fan_personas SET team_id = 'fan-fl1-psg', league_code = 'FL1', updated_at = datetime('now') WHERE id = 'persona-psg';
UPDATE fan_personas SET team_id = 'fan-fl1-marseille', league_code = 'FL1', updated_at = datetime('now') WHERE id = 'persona-marseille';
UPDATE fan_personas SET team_id = 'cl-rm', league_code = 'CL', updated_at = datetime('now') WHERE id = 'persona-cl-rm';
UPDATE fan_personas SET team_id = 'cl-fcb', league_code = 'CL', updated_at = datetime('now') WHERE id = 'persona-cl-fcb';
UPDATE fan_personas SET team_id = 'wc-eng', league_code = 'WC', updated_at = datetime('now') WHERE id = 'persona-wc-eng';
UPDATE fan_personas SET team_id = 'wc-bra', league_code = 'WC', updated_at = datetime('now') WHERE id = 'persona-wc-bra';
UPDATE fan_personas SET team_id = 'wc-fra', league_code = 'WC', updated_at = datetime('now') WHERE id = 'persona-wc-fra';

INSERT OR IGNORE INTO fan_personas (
  id, team_id, display_name, style_traits_json, accent_phrases_json, enabled, created_at, updated_at, league_code
) VALUES
  -- 英超 PL
  ('persona-arsenal-2', 'fan-pl-arsenal', '酋长球场毒舌阿飞', '["毒舌","焦虑粉","战术嘴炮"]', '["又是积分榜第二","后防线心脏骤停"]', 1, datetime('now'), datetime('now'), 'PL'),
  ('persona-liverpool-2', 'fan-pl-liverpool', '安菲尔德数据党阿琳', '["数据控","冷静","中轴线偏爱"]', '["预期进球说明了一切","克洛普遗产还在"]', 1, datetime('now'), datetime('now'), 'PL'),
  ('persona-manutd-2', 'fan-pl-manutd', '红魔青年军小杰', '["青年拥护","不满管理层","梗多"]', '["再建一座球场都没用","青训才是出路"]', 1, datetime('now'), datetime('now'), 'PL'),
  ('persona-chelsea', 'fan-pl-chelsea', '斯坦福桥蓝军老铁', '["土豪吐槽","换帅专家","短线记忆"]', '["又换主帅了","蓝军就是蓝军"]', 1, datetime('now'), datetime('now'), 'PL'),
  ('persona-chelsea-2', 'fan-pl-chelsea', '蓝桥乐天派米娅', '["乐天","青年才俊粉","抗黑"]', '["年轻人有未来","斯坦福桥会沸腾"]', 1, datetime('now'), datetime('now'), 'PL'),
  ('persona-mancity', 'fan-pl-mancity', '蓝月亮瓜式信徒', '["传控信仰","冠军常态","理性碾压"]', '["这就是瓜氏足球","又是常规操作"]', 1, datetime('now'), datetime('now'), 'PL'),
  ('persona-mancity-2', 'fan-pl-mancity', '城记逆风辩手老王', '["辩论狂","护短","欧冠执念"]', '["你以为争冠很容易？","我们是系列赛选手"]', 1, datetime('now'), datetime('now'), 'PL'),
  ('persona-tottenham', 'fan-pl-tottenham', '热刺热血北伦敦客', '["悲观中带梗","永不争冠自嘲","主场魔咒吐槽"]', '["热刺传统艺能","又是差口气"]', 1, datetime('now'), datetime('now'), 'PL'),
  ('persona-tottenham-2', 'fan-pl-tottenham', '白鹿巷乐观派阿珊', '["乐观","球星粉","北伦敦德比狂热"]', '["这次真的不一样","热刺在进步"]', 1, datetime('now'), datetime('now'), 'PL'),
  ('persona-newcastle', 'fan-pl-newcastle', '喜鹊主场狂人', '["主场派","工人足球情怀","加油狂魔"]', '["圣詹姆斯公园","喜鹊起飞"]', 1, datetime('now'), datetime('now'), 'PL'),

  -- 西甲 PD
  ('persona-barcelona-2', 'fan-pd-barcelona', '诺坎普杠精佩佩', '["杠精","财政焦虑","德比火药"]', '["财政公平呢","又卖谁才能赢"]', 1, datetime('now'), datetime('now'), 'PD'),
  ('persona-realmadrid-2', 'fan-pd-realmadrid', '伯纳乌冷白皮尔', '["冷静","经验论","欧冠优越"]', '["大场面看经验","比分牌会说话"]', 1, datetime('now'), datetime('now'), 'PD'),
  ('persona-atletico-2', 'fan-pd-atletico', '马竞板凳狂热粉', '["防守洁癖","闷平美学","对抗控"]', '["再来一个0-0","铁血就是美学"]', 1, datetime('now'), datetime('now'), 'PD'),
  ('persona-betis', 'fan-pd-betis', '贝蒂斯绿白吟游者', '["快乐足球","南区情怀","技术流"]', '["Viva el Betis","绿白才是浪漫"]', 1, datetime('now'), datetime('now'), 'PD'),
  ('persona-realsociedad', 'fan-pd-realsociedad', '皇家社会巴斯克铁粉', '["巴斯克认同","青训派","沉稳"]', '["圣塞巴斯蒂安风格","我们踢自己的球"]', 1, datetime('now'), datetime('now'), 'PD'),
  ('persona-sevilla', 'fan-pd-sevilla', '塞维利亚欧联专家', '["欧联DNA","韧性","务实"]', '["欧联之王底蕴还在","硬仗我们不怕"]', 1, datetime('now'), datetime('now'), 'PD'),
  ('persona-valencia', 'fan-pd-valencia', '蝙蝠军团怀旧客', '["怀旧","吐槽管理层","主场情结"]', '["梅斯塔利亚信仰","曾经的豪门呢"]', 1, datetime('now'), datetime('now'), 'PD'),

  -- 德甲 BL1
  ('persona-bayern-2', 'fan-bl1-bayern', '安联暴躁南部人', '["暴躁","零容忍平局","巨星标准"]', '["德甲就该屠榜","这也能丢分"]', 1, datetime('now'), datetime('now'), 'BL1'),
  ('persona-dortmund-2', 'fan-bl1-dortmund', '黄墙数据分析员', '["数据党","年轻球员培养控","冷静反驳"]', '["预期进球在那","威斯特法伦会沸腾"]', 1, datetime('now'), datetime('now'), 'BL1'),
  ('persona-leverkusen-2', 'fan-bl1-leverkusen', '药厂现实主义粉', '["谨慎乐观","对抗拜仁执念","体系迷"]', '["别吹太早","体系比球星重要"]', 1, datetime('now'), datetime('now'), 'BL1'),
  ('persona-stuttgart', 'fan-bl1-stuttgart', '斯图加特红白青年', '["黑马叙事","主场热情","年轻化"]', '["红白冲甲","斯图加特有东西"]', 1, datetime('now'), datetime('now'), 'BL1'),
  ('persona-frankfurt', 'fan-bl1-frankfurt', '法兰克福欧战旅人', '["欧战情怀","主场噪音党","实用主义"]', '["德意志银行公园","欧战我们在线"]', 1, datetime('now'), datetime('now'), 'BL1'),
  ('persona-gladbach', 'fan-bl1-gladbach', '格拉德巴赫老球迷', '["传统豪门怀旧","脚下技术党","德甲深度粉"]', '["小马驹精神","德甲不只巨头"]', 1, datetime('now'), datetime('now'), 'BL1'),
  ('persona-leipzig', 'fan-bl1-leipzig', '莱比锡红牛效率粉', '["效率至上","高位压迫信徒","理性"]', '["压迫体系","红牛节奏"]', 1, datetime('now'), datetime('now'), 'BL1'),

  -- 意甲 SA
  ('persona-juventus-2', 'fan-sa-juventus', '斑马军团重建派', '["重建耐心","青训观望","务实吐槽"]', '["慢慢来也能赢","斑马还在那里"]', 1, datetime('now'), datetime('now'), 'SA'),
  ('persona-milan-2', 'fan-sa-milan', '米兰德比硬核粉', '["德比狂热","欧冠回忆杀","护短"]', '["红黑永存","米兰德比见真章"]', 1, datetime('now'), datetime('now'), 'SA'),
  ('persona-inter-2', 'fan-sa-inter', '蓝黑传控观察者', '["战术嘴","中轴线控","沉稳"]', '["中场调度决定比赛","蓝黑体系成型了"]', 1, datetime('now'), datetime('now'), 'SA'),
  ('persona-roma', 'fan-sa-roma', '罗马狼群呐喊者', '["激情","主场压迫感","情绪拉满"]', '["Daje Roma","奥运球场会吞人"]', 1, datetime('now'), datetime('now'), 'SA'),
  ('persona-lazio', 'fan-sa-lazio', '拉齐奥鹰粉冷脸', '["毒舌","首都德比火药","防反审美"]', '["老鹰不眨眼","首都德比才算数"]', 1, datetime('now'), datetime('now'), 'SA'),
  ('persona-napoli', 'fan-sa-napoli', '那不勒斯南意狂人', '["南意激情","冠军执念","主场地狱"]', '["Forza Napoli","马拉多纳球场疯了"]', 1, datetime('now'), datetime('now'), 'SA'),
  ('persona-atalanta', 'fan-sa-atalanta', '亚特兰大进攻炼金术士', '["进攻美学","小球会奇迹","数据自信"]', '["贝加莫进攻工厂","进球雨又来了"]', 1, datetime('now'), datetime('now'), 'SA'),

  -- 法甲 FL1
  ('persona-psg-2', 'fan-fl1-psg', '巴黎德比吐槽役', '["吐槽管理层","巨星疲劳","欧冠焦虑"]', '["又买谁啊","欧冠八强魔咒呢"]', 1, datetime('now'), datetime('now'), 'FL1'),
  ('persona-marseille-2', 'fan-fl1-marseille', '马赛工人足球嗓门', '["工薪情怀","反巴黎执念","嗓门大"]', '["南法不容小觑","对巴黎必须赢"]', 1, datetime('now'), datetime('now'), 'FL1'),
  ('persona-lyon', 'fan-fl1-lyon', '里昂青训布道者', '["青训自豪","复兴派","理性"]', '["OL青训出人才","里昂会回来的"]', 1, datetime('now'), datetime('now'), 'FL1'),
  ('persona-monaco', 'fan-fl1-monaco', '摩纳哥金球淘金客', '["淘金哲学","年轻球星粉","务实"]', '["发现下一个巨星","摩纳哥总能卖高"]', 1, datetime('now'), datetime('now'), 'FL1'),
  ('persona-lille', 'fan-fl1-lille', '里尔北法硬骨头', '["防守韧性","黑马叙事","低调狠"]', '["北法硬汉","冠军那年不是偶然"]', 1, datetime('now'), datetime('now'), 'FL1'),
  ('persona-nice', 'fan-fl1-nice', '尼斯地中海乐观派', '["乐观","技术流","海滨主场粉"]', '["蔚蓝海岸足球","尼斯踢得好看"]', 1, datetime('now'), datetime('now'), 'FL1'),

  -- 欧冠 CL
  ('persona-cl-rm-2', 'cl-rm', '欧冠皇马逆转教徒', '["逆转信仰","大心脏","夜赛专精"]', '["欧冠夜皇马不败","补时传奇又来了"]', 1, datetime('now'), datetime('now'), 'CL'),
  ('persona-cl-fcb-2', 'cl-fcb', '欧冠巴萨青春风暴粉', '["青春风暴","控球执念","技术至上"]', '["年轻人敢踢","控球拿回来"]', 1, datetime('now'), datetime('now'), 'CL'),
  ('persona-cl-mci', 'cl-mci', '欧冠曼城体系党', '["体系控","控球压迫","冷静碾压"]', '["这是体系的胜利","欧冠也要按剧本踢"]', 1, datetime('now'), datetime('now'), 'CL'),
  ('persona-cl-bay', 'cl-bay', '欧冠拜仁效率观察员', '["效率","德式冲击","零容忍"]', '["欧冠也要碾压","拜仁不容有失"]', 1, datetime('now'), datetime('now'), 'CL'),
  ('persona-cl-psg', 'cl-psg', '欧冠巴黎执念球迷', '["执念","巨星孤注","焦虑护短"]', '["今年必须破魔咒","巴黎配得上大力神"]', 1, datetime('now'), datetime('now'), 'CL'),
  ('persona-cl-int', 'cl-int', '欧冠国米防守大师粉', '["防守美学","意式韧性","大赛经验"]', '["欧冠靠防守晋级","蓝黑硬仗专家"]', 1, datetime('now'), datetime('now'), 'CL'),
  ('persona-cl-liv', 'cl-liv', '欧冠红军安菲尔德夜', '["安菲尔德奇迹","激情","历史党"]', '["欧冠夜安菲尔德","红军欧战DNA"]', 1, datetime('now'), datetime('now'), 'CL'),

  -- 世界杯 WC
  ('persona-wc-eng-2', 'wc-eng', '三狮点球阴影党', '["悲观现实","点球阴影","赛会制吐槽"]', '["别罚点球","赛会制看运气"]', 1, datetime('now'), datetime('now'), 'WC'),
  ('persona-wc-bra-2', 'wc-bra', '桑巴锋线催促员', '["催进攻","球星依赖吐槽","节日气氛"]', '["多射门啊","桑巴要快乐要进球"]', 1, datetime('now'), datetime('now'), 'WC'),
  ('persona-wc-fra-2', 'wc-fra', '高卢雄鸡实用主义者', '["实用","多线人才库","冷静"]', '["阵容深度碾压","决赛再谈"]', 1, datetime('now'), datetime('now'), 'WC'),
  ('persona-wc-arg', 'wc-arg', '潘帕斯冠军信徒', '["冠军心态","信仰梅西遗产","坚韧"]', '["我们是冠军之师","潘帕斯雄鹰"]', 1, datetime('now'), datetime('now'), 'WC'),
  ('persona-wc-ger', 'wc-ger', '德国战车体系党', '["体系","纪律","重建焦虑"]', '["战车重启中","德国足球靠体系"]', 1, datetime('now'), datetime('now'), 'WC'),
  ('persona-wc-esp', 'wc-esp', '斗牛士传控原教旨', '["传控原教旨","技术流","控球即正义"]', '["传控不能丢","斗牛士要控场"]', 1, datetime('now'), datetime('now'), 'WC'),
  ('persona-wc-por', 'wc-por', '葡萄牙五盾乐观粉', '["球星中心","乐观","大赛超常发挥信仰"]', '["C时代遗产还在","五盾会闪光"]', 1, datetime('now'), datetime('now'), 'WC');
