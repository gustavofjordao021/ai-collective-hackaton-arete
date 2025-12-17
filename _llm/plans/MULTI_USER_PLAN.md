# Multi-User Onboarding Plan for Arete

> Goal: Enable 2-5 external testers to use Arete (CLI + MCP server) with self-service signup

## Current State

**What exists:**
- Supabase tables: `profiles`, `identities`, `context_events`, `api_keys` — all user-scoped with RLS
- Edge functions: `auth-api-key`, `create-api-key`, `cli-identity`, `cli-context`
- CLI auth: `arete auth login <api_key>` works
- Chrome extension: Google OAuth works (but testers need CLI/MCP, not just extension)

**The gap:** No way for new users to get an API key without you manually creating it.

---

## Implementation Plan

### Phase 1: Invite Code Infrastructure

**1.1 Create `invite_codes` table**

```sql
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  max_uses INT DEFAULT 1,
  use_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view codes they created"
  ON invite_codes FOR SELECT
  USING (created_by = auth.uid());
```

**1.2 Deploy `signup-with-invite` edge function**

Input: `{ invite_code, email }`
Output: `{ api_key, user_id, email }`

Flow:
1. Validate invite code (exists, not used, not expired)
2. Create user via `supabase.auth.admin.createUser()`
3. Mark invite as used
4. Generate API key (same pattern as `create-api-key`)
5. Return credentials

---

### Phase 2: CLI Signup Command

**2.1 Add `arete auth signup` command**

```bash
arete auth signup <invite_code> <email>

# Example:
arete auth signup ARETE-BETA-001 tester@example.com

# Output:
# Creating account...
# Success! Account created for tester@example.com
# Your API key: sk_live_abc123...
# [!] Save this key - it won't be shown again!
#
# Config saved to ~/.arete/config.json
# You can now use: arete identity get
```

**Files to modify:**
- `packages/core/src/cli/auth.ts` — add `cmdAuthSignup()`
- `packages/core/src/cli/index.ts` — wire up `signup` subcommand

---

### Phase 3: Generate Invite Codes

For 5 testers, manual SQL:

```sql
INSERT INTO invite_codes (code, expires_at, created_by) VALUES
  ('ARETE-BETA-001', now() + interval '30 days', 'YOUR_USER_ID'),
  ('ARETE-BETA-002', now() + interval '30 days', 'YOUR_USER_ID'),
  ('ARETE-BETA-003', now() + interval '30 days', 'YOUR_USER_ID'),
  ('ARETE-BETA-004', now() + interval '30 days', 'YOUR_USER_ID'),
  ('ARETE-BETA-005', now() + interval '30 days', 'YOUR_USER_ID');
```

---

### Phase 4: Documentation

Update README with tester setup instructions.

---

## Tester Flow (End State)

```
You (admin)                          Tester
-----------                          ------
Generate invite codes (SQL)
Send code to tester ──────────────►  Receives ARETE-BETA-001

                                     git clone arete && npm install
                                     npm run cli -- auth signup ARETE-BETA-001 email@test.com

                                     ✓ Account created
                                     ✓ API key: sk_live_xxx (saved to ~/.arete/config.json)

                                     npm run cli -- identity get  ← works!
                                     Configure Claude Desktop MCP ← works!
```

---

## Files to Create/Modify

| File | Action | Phase |
|------|--------|-------|
| Supabase migration | CREATE TABLE `invite_codes` | 1 |
| Edge function `signup-with-invite` | New | 1 |
| `packages/core/src/cli/auth.ts` | Add `cmdAuthSignup()` | 2 |
| `packages/core/src/cli/index.ts` | Wire `signup` command | 2 |
| `CLAUDE.md` or `README.md` | Tester setup docs | 4 |

---

## Success Criteria

- [ ] Tester can run `arete auth signup` with invite code
- [ ] Tester gets API key and is auto-logged-in
- [ ] `arete identity get` returns their (empty) identity
- [ ] MCP server works in Claude Desktop with their credentials
- [ ] `arete_get_identity` tool call succeeds

---

## Status

- [x] Phase 1: Invite code infrastructure (table + edge function)
- [x] Phase 2: CLI signup command (`arete auth signup`)
- [x] Phase 3: Generate invite codes (ARETE-BETA-001 through 005)
- [x] Phase 4: Documentation (CLAUDE.md updated)
