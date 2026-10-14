-- Completion identities are random match UUIDs, scoped to an anonymous Beta player.
-- Retries under a different load/session cannot count the same saved match twice.
CREATE UNIQUE INDEX IF NOT EXISTS events_beta_completion_once ON events(pid,json_extract(p_json,'$.completion_id')) WHERE e='beta_completion';
