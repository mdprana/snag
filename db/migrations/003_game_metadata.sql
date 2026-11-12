CREATE TABLE game_metadata (
  game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('steam','epic')),
  provider_namespace TEXT,
  payload_json TEXT,
  fetched_at INT,
  attempted_at INT NOT NULL,
  error_code TEXT
);
