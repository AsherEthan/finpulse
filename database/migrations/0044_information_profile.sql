-- Explicit human assessments are independent of source provenance, tier and editorial authorship.
ALTER TABLE publications ADD COLUMN information_profile jsonb;
ALTER TABLE publications ADD CONSTRAINT publication_information_profile_object
  CHECK (information_profile IS NULL OR jsonb_typeof(information_profile) = 'object');
