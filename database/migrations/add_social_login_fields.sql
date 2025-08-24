-- Add social login fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS kakao_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS naver_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'local',
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_kakao_id ON profiles(kakao_id);
CREATE INDEX IF NOT EXISTS idx_profiles_google_id ON profiles(google_id);
CREATE INDEX IF NOT EXISTS idx_profiles_naver_id ON profiles(naver_id);
CREATE INDEX IF NOT EXISTS idx_profiles_apple_id ON profiles(apple_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_provider ON profiles(provider);

-- Update existing profiles to have username based on display_name or email
UPDATE profiles 
SET username = COALESCE(display_name, split_part(email, '@', 1))
WHERE username IS NULL AND (display_name IS NOT NULL OR email IS NOT NULL);

-- Add unique constraint that allows multiple NULL values but unique non-NULL values
-- (Already handled by UNIQUE constraint on each social ID column)