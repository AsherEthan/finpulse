-- A run reports what it actually read; a latest-window success is not a claim of full history.
ALTER TABLE fetch_runs ADD COLUMN revised_count integer NOT NULL DEFAULT 0;
ALTER TABLE fetch_runs ADD COLUMN window_from timestamptz;
ALTER TABLE fetch_runs ADD COLUMN window_to timestamptz;

CREATE INDEX fetch_runs_failure_idx ON fetch_runs (source_id, started_at DESC) WHERE status = 'failed';
