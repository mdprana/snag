CREATE TABLE poll_runs(id INTEGER PRIMARY KEY, source TEXT, ok INT, count INT, error TEXT, at INT);
CREATE TABLE notifications(id INTEGER PRIMARY KEY, game_id TEXT REFERENCES games ON DELETE CASCADE, created_at INT);
