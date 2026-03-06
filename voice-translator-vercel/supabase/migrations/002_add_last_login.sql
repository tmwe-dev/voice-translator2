-- Add last_login column to profiles if it doesn't exist
-- This column was missing from the initial migration but used by auth/route.js
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
