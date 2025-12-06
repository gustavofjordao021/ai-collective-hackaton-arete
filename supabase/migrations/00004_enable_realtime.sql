-- Migration: Enable realtime for sync
-- Allows clients to subscribe to changes

-- Enable realtime for identities table
alter publication supabase_realtime add table identities;

-- Enable realtime for context_events table
alter publication supabase_realtime add table context_events;

-- Note: profiles table not added to realtime as it rarely changes
