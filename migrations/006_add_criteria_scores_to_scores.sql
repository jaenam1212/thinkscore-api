-- Add criteria_scores JSONB column to scores table
-- Stores the breakdown of scores by evaluation criteria (논리적 사고, 창의적 사고, 일관성)
ALTER TABLE scores
ADD COLUMN IF NOT EXISTS criteria_scores JSONB;

COMMENT ON COLUMN scores.criteria_scores IS 'JSON object containing individual criteria scores e.g. {"논리적 사고": 80, "창의적 사고": 70, "일관성": 75}';
