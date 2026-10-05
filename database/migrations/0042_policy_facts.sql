-- Policy facts share the audited editorial override and the public publication projection.
ALTER TABLE publications ADD COLUMN policy jsonb;
ALTER TABLE publications ADD COLUMN editorial_origin text NOT NULL DEFAULT 'unknown';
ALTER TABLE publications ADD CONSTRAINT publication_policy_object CHECK (policy IS NULL OR jsonb_typeof(policy) = 'object');
ALTER TABLE publications ADD CONSTRAINT publication_editorial_origin CHECK (editorial_origin IN ('manual', 'model', 'rule', 'unknown'));
CREATE INDEX publications_policy_idx ON publications USING gin (policy) WHERE category = 'policy' AND visibility = 'public' AND eligible;

-- Existing reviewed summaries retain their actual authorship without inventing an analysis.
UPDATE publications p SET editorial_origin = CASE
  WHEN EXISTS (SELECT 1 FROM editorial_overrides o WHERE o.article_id = p.article_id AND (o.fields ? 'summary' OR o.fields ? 'title')) THEN 'manual'
  WHEN an.origin = 'rule' THEN 'rule'
  WHEN an.origin IN ('model', 'replay') THEN 'model'
  ELSE 'unknown' END
FROM analyses an WHERE an.id = p.analysis_id;
UPDATE publications p SET editorial_origin = 'manual'
WHERE EXISTS (SELECT 1 FROM editorial_overrides o WHERE o.article_id = p.article_id AND (o.fields ? 'summary' OR o.fields ? 'title'));
