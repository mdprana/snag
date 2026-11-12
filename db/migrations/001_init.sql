-- spec §6 (PK expanded to PRIMARY KEY)
CREATE TABLE users(id TEXT PRIMARY KEY, created_at INT, tz TEXT DEFAULT 'Asia/Makassar');
CREATE TABLE identities(provider TEXT CHECK(provider IN('steam','epic')), subject TEXT, user_id TEXT REFERENCES users ON DELETE CASCADE, display_name TEXT, created_at INT, PRIMARY KEY(provider, subject));
CREATE TABLE sessions(id_hash TEXT PRIMARY KEY, user_id TEXT REFERENCES users ON DELETE CASCADE, created_at INT, expires_at INT);
CREATE TABLE auth_flows(id TEXT PRIMARY KEY, provider TEXT, state TEXT, code_verifier TEXT, expires_at INT);
CREATE TABLE openid_nonces(nonce TEXT PRIMARY KEY, seen_at INT);
CREATE TABLE games(id TEXT PRIMARY KEY, store TEXT CHECK(store IN('epic','steam')), external_id TEXT, kind TEXT CHECK(kind IN('free_to_keep','key_giveaway')), title TEXT, store_url TEXT, claim_url TEXT, image_url TEXT, starts_at INT, ends_at INT, upcoming INT DEFAULT 0, first_seen_at INT, UNIQUE(store, external_id));
CREATE TABLE claims(user_id TEXT REFERENCES users ON DELETE CASCADE, game_id TEXT REFERENCES games, claimed_at INT, PRIMARY KEY(user_id, game_id));
CREATE TABLE push_subs(id TEXT PRIMARY KEY, user_id TEXT REFERENCES users ON DELETE CASCADE, endpoint TEXT UNIQUE, p256dh TEXT, auth TEXT, stores TEXT DEFAULT 'epic,steam', created_at INT);
CREATE TABLE deliveries(game_id TEXT, sub_id TEXT REFERENCES push_subs ON DELETE CASCADE, sent_at INT, PRIMARY KEY(game_id, sub_id));
CREATE TABLE rate_limits(key TEXT, window_start INT, count INT, PRIMARY KEY(key, window_start));
CREATE TABLE asf_reports(id INTEGER PRIMARY KEY, received_at INT, payload TEXT);
