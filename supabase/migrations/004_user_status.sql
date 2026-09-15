-- Add user_status to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_status text NOT NULL DEFAULT 'active'
    CHECK (user_status IN ('active', 'away', 'dnd', 'in_meeting', 'on_leave', 'vacation'));
