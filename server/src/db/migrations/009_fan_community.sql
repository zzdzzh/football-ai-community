-- MVP-4 Fan Agent & Community Governance
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS fan_personas (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  display_name TEXT NOT NULL,
  style_traits_json TEXT NOT NULL,
  accent_phrases_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fan_personas_team_id ON fan_personas(team_id);
CREATE INDEX IF NOT EXISTS idx_fan_personas_enabled ON fan_personas(enabled);

CREATE TABLE IF NOT EXISTS fan_discussions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  topic TEXT NOT NULL,
  match_id TEXT REFERENCES matches(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'archived')),
  turn_count INTEGER NOT NULL DEFAULT 0,
  feed_item_id TEXT REFERENCES feed_items(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fan_discussions_user_updated ON fan_discussions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_fan_discussions_status ON fan_discussions(status);
CREATE INDEX IF NOT EXISTS idx_fan_discussions_match_id ON fan_discussions(match_id);

CREATE TABLE IF NOT EXISTS fan_discussion_personas (
  discussion_id TEXT NOT NULL REFERENCES fan_discussions(id),
  persona_id TEXT NOT NULL REFERENCES fan_personas(id),
  PRIMARY KEY (discussion_id, persona_id)
);

CREATE TABLE IF NOT EXISTS fan_discussion_turns (
  id TEXT PRIMARY KEY,
  discussion_id TEXT NOT NULL REFERENCES fan_discussions(id),
  sequence INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('persona', 'user')),
  persona_id TEXT REFERENCES fan_personas(id),
  user_id TEXT REFERENCES users(id),
  content TEXT NOT NULL,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fan_discussion_turns_discussion_seq
  ON fan_discussion_turns(discussion_id, sequence ASC);

CREATE TABLE IF NOT EXISTS content_reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('fan_discussion', 'fan_discussion_turn')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'hidden', 'dismissed')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status_created ON content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_target ON content_reports(target_type, target_id);

-- 代表球队种子（供 Persona 关联；INSERT OR IGNORE 避免覆盖 sync 数据）
INSERT OR IGNORE INTO teams (id, name, short_name, tla, league_code, updated_at) VALUES
  ('57', 'Arsenal FC', 'Arsenal', 'ARS', 'PL', datetime('now')),
  ('64', 'Liverpool FC', 'Liverpool', 'LIV', 'PL', datetime('now')),
  ('66', 'Manchester United FC', 'Man United', 'MUN', 'PL', datetime('now')),
  ('81', 'FC Barcelona', 'Barcelona', 'BAR', 'PD', datetime('now')),
  ('86', 'Real Madrid CF', 'Real Madrid', 'RMA', 'PD', datetime('now')),
  ('78', 'Atlético de Madrid', 'Atlético', 'ATM', 'PD', datetime('now')),
  ('5', 'FC Bayern München', 'Bayern', 'FCB', 'BL1', datetime('now')),
  ('4', 'Borussia Dortmund', 'Dortmund', 'BVB', 'BL1', datetime('now')),
  ('721', 'Bayer 04 Leverkusen', 'Leverkusen', 'B04', 'BL1', datetime('now')),
  ('108', 'Juventus FC', 'Juventus', 'JUV', 'SA', datetime('now')),
  ('98', 'AC Milan', 'Milan', 'MIL', 'SA', datetime('now')),
  ('113', 'FC Internazionale Milano', 'Inter', 'INT', 'SA', datetime('now')),
  ('524', 'Paris Saint-Germain FC', 'PSG', 'PSG', 'FL1', datetime('now')),
  ('516', 'Olympique de Marseille', 'Marseille', 'OM', 'FL1', datetime('now')),
  ('cl-rm', 'Real Madrid CF', 'Real Madrid', 'RMA', 'CL', datetime('now')),
  ('cl-fcb', 'FC Barcelona', 'Barcelona', 'BAR', 'CL', datetime('now')),
  ('wc-eng', 'England', 'England', 'ENG', 'WC', datetime('now')),
  ('wc-bra', 'Brazil', 'Brazil', 'BRA', 'WC', datetime('now')),
  ('wc-fra', 'France', 'France', 'FRA', 'WC', datetime('now'));

INSERT OR IGNORE INTO fan_personas (
  id, team_id, display_name, style_traits_json, accent_phrases_json, enabled, created_at, updated_at
) VALUES
  ('persona-arsenal', '57', '枪手铁杆小明', '["乐观","护短","数据派"]', '["我们阿森纳踢的是足球","塔子哥有东西"]', 1, datetime('now'), datetime('now')),
  ('persona-liverpool', '64', '红军KOP老张', '["激情","历史党","永不独行"]', '["YNWA","这赛季还能争冠"]', 1, datetime('now'), datetime('now')),
  ('persona-manutd', '66', '红魔老球迷阿强', '["怀旧","毒舌","主场派"]', '["弗格森时代","老特拉福德氛围"]', 1, datetime('now'), datetime('now')),
  ('persona-barcelona', '81', '巴萨梦三粉Laura', '["技术流","传控信仰","青训派"]', '["Mes que un club","拉玛西亚"]', 1, datetime('now'), datetime('now')),
  ('persona-realmadrid', '86', '皇马美凌格Carlos', '["冠军心态","银河战舰","关键时刻"]', '["Hala Madrid","欧冠DNA"]', 1, datetime('now'), datetime('now')),
  ('persona-atletico', '78', '马竞铁血Diego', '["防守反击"," gritty","西蒙尼信徒"]', '["马竞精神","1-0主义"]', 1, datetime('now'), datetime('now')),
  ('persona-bayern', '5', '拜仁南大王Hans', '["统治力","德甲霸主","效率至上"]', '["Mia san mia","拜仁就是拜仁"]', 1, datetime('now'), datetime('now')),
  ('persona-dortmund', '4', '多特黄黑墙青年', '["青春风暴","激情","威斯特法伦"]', '["Echte Liebe","青春风暴"]', 1, datetime('now'), datetime('now')),
  ('persona-leverkusen', '721', '药厂 Lever 粉丝', '["黑马","勒沃库森奇迹","理性分析"]', '["药厂加油","不败赛季"]', 1, datetime('now'), datetime('now')),
  ('persona-juventus', '108', '尤文老妇人Marco', '["防守","意甲老炮","斑马军团"]', '["Fino alla fine","老妇人精神"]', 1, datetime('now'), datetime('now')),
  ('persona-milan', '98', '米兰罗森内里Luca', '["红黑血统","欧冠七冠","复兴派"]', '["Forza Milan","罗森内里"]', 1, datetime('now'), datetime('now')),
  ('persona-inter', '113', '国米蓝黑战士', '[" pragmatic","三冠王回忆","德比狂热"]', '["Forza Inter","米兰德比"]', 1, datetime('now'), datetime('now')),
  ('persona-psg', '524', '巴黎王子公园球迷', '["巨星","法甲霸主","欧冠执念"]', '["Ici c''est Paris","姆巴佩时代"]', 1, datetime('now'), datetime('now')),
  ('persona-marseille', '516', '马赛奥林匹克Souther', '["南法激情","欧冠1993","主场狂热"]', '["Droit au but","Velodrome"]', 1, datetime('now'), datetime('now')),
  ('persona-cl-rm', 'cl-rm', '欧冠皇马观察员', '["欧战专家","经验派","大场面"]', '["欧冠之王","经验取胜"]', 1, datetime('now'), datetime('now')),
  ('persona-cl-fcb', 'cl-fcb', '欧冠巴萨分析师', '["战术","控球","青训"]', '["tiki-taka","控球制胜"]', 1, datetime('now'), datetime('now')),
  ('persona-wc-eng', 'wc-eng', '三狮军团Follower', '["国家队","乐观","点球阴影"]', '["足球回家","索斯盖特经济学"]', 1, datetime('now'), datetime('now')),
  ('persona-wc-bra', 'wc-bra', '桑巴足球Samba', '["进攻","快乐足球","五星巴西"]', '["Jogo bonito","桑巴军团"]', 1, datetime('now'), datetime('now')),
  ('persona-wc-fra', 'wc-fra', '高卢雄鸡Fan', '["多元","冠军底蕴","姆巴佩时代"]', '["Allez les Bleus","2018冠军"]', 1, datetime('now'), datetime('now'));
