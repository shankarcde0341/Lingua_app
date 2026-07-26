# AI Agent Rules

These rules govern AI agent behavior and must be read and enforced by any automation or agent before executing commands in this repository.

1. Environment Isolation

- Backend logic, database credentials (DB_URI, DB_PASSWORD), and API keys (Firebase/Supabase/OpenAI/Stripe) must NEVER be included in frontend components. Always access them via `process.env` in server-side files only.
- Client-Side Protection: Do not expose any backend configuration or server-side file structures to the client-side. Use explicit API endpoints to bridge data.
- Dependency Minimization: Before adding any library, check if the task can be solved using standard JavaScript/TypeScript or lightweight built-in functions. Avoid "dependency bloat." If a library is mandatory, ensure it has a small footprint and good security track record.

2. Error Handling & Logging Strategy

- Silent Failures: Do not use `console.log` for backend errors or sensitive data. Use a structured logger (e.g., Winston, Pino) that logs to secure server files or monitoring services.
- Obfuscated Responses: Never send raw stack traces or database errors to the frontend.
- Error Boundaries: Use React Error Boundaries to catch client-side crashes, ensuring the user experience remains stable without exposing system architecture.

3. Rate Limiting & Abuse Prevention

- API Guarding: Every route in the backend (especially those for "Speaking Rooms" and User Profile updates) must be protected with rate-limiting middleware (e.g., express-rate-limit).
- Input Sanitization: Assume all incoming data is malicious. Sanitize every API request body using Zod or Joi before processing. Validate types strictly.

4. Architectural Boundaries (Strict Enforcement)

- Directory Separation: Keep server-only code, secrets, and credentials out of client bundles and shared directories. Enforce clear server vs client folders.
- Next.js Conventions: Leverage Server Components (use client only where strictly needed for interactivity). This prevents sensitive server-side logic from leaking to the browser.
- WebRTC Security: For Speaking Rooms, ensure signaling servers validate room access tokens. Peer-to-peer data channels must be encrypted.

5. Coding Standards for AI

- No Verbose Comments: Keep the code clean. Only document non-obvious logic.
- Strict Typing: Always use TypeScript interfaces. Avoid `any` types.
- Confirmation Requirement: If a task requires changing the database schema or modifying security middleware, pause and ask for explicit confirmation from the user before executing.

---

Placement & Usage

- Location: This file is intentionally placed at the repository root as `rules.md` so agents can find and read it before performing operations.
- Update policy: When rules change, update this file in-place and add a dated entry in the project `memory.md` Change Log referencing the update.
