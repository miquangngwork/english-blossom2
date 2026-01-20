-- Ensure AssessmentItem.options is JSONB regardless of previous type
ALTER TABLE "AssessmentItem"
  ALTER COLUMN "options" TYPE JSONB
  USING to_jsonb("options");
