# Database Migration Safety

SPARTA uses Prisma migrations as the only schema-management mechanism. Application requests must never create or alter tables at runtime.

## Before working with an existing database

1. Stop local writers and create a recoverable PostgreSQL backup with your normal operator tooling (for example `pg_dump`).
2. Keep the backup outside the repository and confirm that it can be read.
3. Compare the live schema to `prisma/schema.prisma` in a controlled environment. Do not continue if tables, columns, constraints, or indexes differ unexpectedly.
4. Review `prisma/migrations/20261001000000_baseline/migration.sql`. The baseline contains creation statements for an empty database; do not execute it directly against an existing populated schema.
5. Only after the live structures are confirmed equivalent, mark the baseline as applied with an explicit operator command:

   ```powershell
   npx prisma migrate resolve --applied 20261001000000_baseline
   ```

The application and its startup scripts do not run this command automatically.

## Creating a new local database

Point `DATABASE_URL` at the new empty database, then run:

```powershell
npx prisma migrate deploy
npx prisma generate
```

## Adding later schema changes

Create additive migrations in development, inspect the generated SQL, back up existing data, and then deploy deliberately. Never use `prisma migrate reset` for a database that contains data you need.
