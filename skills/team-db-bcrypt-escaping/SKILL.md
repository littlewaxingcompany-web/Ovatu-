---
name: team-db-bcrypt-escaping
description: How to safely pass SQL containing bcrypt hashes (or other $ characters) to the team-db CLI to avoid bash variable expansion.
---

# team-db: Handling bcrypt hashes ($$$ escaping)

## Problem

When using `team-db "<SQL>"` (the quoted argument form), bcrypt hash values like `$2b$10$...` cause bash to interpret `$2b`, `$10` etc. as variable references and silently expand them to empty strings. The hash gets corrupted, auth breaks, and you get "Invalid email or password" errors even after successful signup.

## Solution

Never inline SQL containing `$` characters. Instead, write the SQL to a temp file and use `$(cat <file>)` to pass it:

```typescript
import { execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";

function db(sql: string): unknown {
  const tmpFile = `/tmp/team-db-${randomUUID().slice(0, 8)}.sql`;
  writeFileSync(tmpFile, sql, "utf-8");
  try {
    const out = execSync(`team-db "$(cat ${tmpFile})"`, {
      encoding: "utf-8",
      timeout: 10_000,
    });
    return JSON.parse(out.trim());
  } finally {
    rmSync(tmpFile, { force: true });
  }
}
```

## Why this works

`$(cat <file>)` expands to the file contents inside double quotes. Since it comes from a file read by `cat`, bash does NOT apply variable expansion to the contents — the `$` signs pass through literally.

## Reference

See `/home/team/shared/server/src/db/index.ts` for the production implementation.
