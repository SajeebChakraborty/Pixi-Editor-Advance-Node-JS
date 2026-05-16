# API Key System Design

To sell Pixigen services to third parties, we need a robust API Key management system.

## Flow

1.  **Generation**:
    - User/Admin generates a key via the Dashboard.
    - System generates a random prefix and a secret part (e.g., `px_live_...`).
    - **Only show the secret once to the user.**
    - Store a SHA-256 hash of the key in the `api_keys` table.
2.  **Usage**:
    - Client sends the key in the `X-API-KEY` header.
3.  **Validation**:
    - Middleware/Utility function extracts the key.
    - Hashes the provided key.
    - Queries `api_keys` table for a match.
    - Checks `scopes` and `last_used_at`.

## Database Schema (API Keys)

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    org_id UUID, -- For multi-tenancy
    name TEXT, -- e.g. "Production Key"
    key_hash TEXT NOT NULL,
    prefix TEXT, -- First 5-8 chars for identification
    scopes TEXT[], -- e.g. ['export:image', 'export:video']
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);
```

## Middleware Logic (Pseudo-code)

```typescript
async function validateApiKey(key: string) {
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", hash)
    .single();

  if (error || !data) return null;

  // Update last used
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date() })
    .eq("id", data.id);

  return data;
}
```
