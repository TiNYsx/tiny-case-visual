# Tiny Case Visual

Tiny Case Visual is a private, local-first test-case management app for small teams. It is designed to store sprint-style QA evidence, show test cases visually, and let a team review what was tested, what changed, and what proof was captured during a project sprint.

The app is intended for local or private team deployments, not a public multi-tenant service. A typical team size is around 10-15 users.

## Project idea

The main workflow is:

1. Create a project.
2. Build a reusable test template that describes the start-to-end steps for the project or sprint.
3. Start a test session for the project.
4. Move through each template step and record:
   - pass/fail status
   - markdown notes
   - changes made
   - actual result
   - code blocks or logs
   - image/file evidence
5. Finish the test session.
6. Review the saved history later to see what changed, what was tested, and what evidence was attached.

Only one person should be testing a project at a time. While a test session is running, the project template and test steps should be locked so nobody changes the checklist underneath the active tester.

## Roles and permissions goal

The app is being shaped around lightweight local accounts and project-level roles:

- **Owner / manager**
  - Manage the project.
  - Edit templates when no test is running.
  - Stop or remove an active test session.
  - Manage members and permissions later.
- **Member / tester**
  - Start a test when the project is free.
  - Fill in test results and evidence.
  - Create/remove steps when no test is running, if allowed by the project rules.
  - Remove tested history when allowed.
  - Cannot stop another user’s active test.

Member management and detailed per-project permission settings are part of the roadmap.

## Current stack

- Next.js App Router
- React
- Prisma
- PostgreSQL
- NextAuth credentials login
- React Flow for visual test-case maps
- Markdown rendering for notes/test content
- Local filesystem uploads for evidence
- Planned local-first realtime updates through the app server

## Local setup

Install dependencies:

```bash
npm install
```

Create a PostgreSQL database, then create `.env` in the project root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/tiny_case_visual"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:6133"
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="10485760"
```

Generate Prisma Client and run migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:6133
```

## Useful commands

```bash
npm run dev      # Start local dev server on port 6133
npm run build    # Build the app
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Evidence uploads

Evidence files are stored on the local filesystem. Set `UPLOAD_DIR` to a persistent folder when running the app for a team. The default local folder is `./uploads`.

Because this project is meant for private local/team use, uploads are simple by design. Do not use this as a public file hosting service without adding stronger validation, storage controls, and deployment hardening.

## Roadmap

Planned/future work:

- Project list improvements.
- Add/remove project members.
- Per-project member permissions.
- Realtime team presence and active tester display.
- Stronger test session locking.
- Better sprint/test history management.
- More complete markdown editing and evidence previews.

## Development notes

This project uses a newer Next.js version. Before changing framework-specific behavior, check the local Next.js docs under:

```text
node_modules/next/dist/docs/
```
