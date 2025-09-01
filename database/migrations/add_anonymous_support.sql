-- Migration: Add support for anonymous answers
-- Add is_anonymous column and modify user_id constraint

-- Make user_id nullable for anonymous users
ALTER TABLE answers ALTER COLUMN user_id DROP NOT NULL;

-- Add is_anonymous column
ALTER TABLE answers ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;

-- Update existing answers to set is_anonymous = false for consistency
UPDATE answers SET is_anonymous = false WHERE is_anonymous IS NULL;

-- Create partial index for anonymous answers
CREATE INDEX IF NOT EXISTS idx_answers_anonymous ON answers(question_id) WHERE is_anonymous = true;