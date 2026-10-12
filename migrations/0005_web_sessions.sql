-- Apply explicitly before deploying the production server. No business data changes.
CREATE TABLE IF NOT EXISTS web_sessions (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS web_sessions_expire_idx ON web_sessions (expire);
