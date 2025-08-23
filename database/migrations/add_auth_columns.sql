-- Migration: Add email and password_hash columns to profiles table
-- Run this in Supabase SQL Editor

-- Add email and password_hash columns to existing profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Create unique constraint on email
ALTER TABLE profiles 
ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- Create index for email lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);