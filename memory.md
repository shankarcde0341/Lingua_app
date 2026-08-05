**Project Overview**
- **Name:** Lingua Franca
- **One-line description:** Mobile-first English-speaking practice app (Expo React Native) focused on conversational fluency, lessons, mini-quizzes and mocked real-people speaking practice.
- **Target users:** English learners who want regular speaking practice — beginners through advanced, exam takers (IELTS/Interview), travelers, and professionals.

**Tech Stack**
- **Frontend:** Expo / React Native (web-compatible), TypeScript, file-based routing via `expo-router` ([frontend/package.json](frontend/package.json)).
- **Backend:** FastAPI (Python) with async Motor driver for MongoDB ([backend/server.py](backend/server.py)).
- **Database:** MongoDB (accessed via Motor). Collections include `users`, `user_sessions`, `rooms`, `calls`, `payments`, `phone_otps`, `lesson_progress`, `speaking_tests`, `daily_challenges`, `friend_requests`, `reports`.
- **Hosting / Deployment:** No CI or hosting manifests found in repo. Frontend is an Expo app (see [frontend/README.md](frontend/README.md)). Backend is a FastAPI app expected to run under `uvicorn` (see [backend/requirements.txt](backend/requirements.txt)).
- **Third-party integrations / external services:**
  - Emergent OAuth demo service for initial session exchange: `EMERGENT_AUTH_URL` used in server ([backend/server.py](backend/server.py)).
  - Stripe: server-side checkout and webhook integration (via `emergentintegrations.payments.stripe`) for subscriptions ([backend/server.py](backend/server.py)).
  - ZEGOCLOUD / ZEGO: voice/RTC token generation endpoint implemented server-side (Token04) for mocked real-people sessions ([backend/server.py](backend/server.py)).
  - OTP: currently runs in `mock` mode by default; comments indicate switching to Twilio (or other) is planned ([backend/server.py](backend/server.py)).

**Key libraries & why**
- Frontend: `expo`, `expo-router` (file-based routing), `expo-secure-store` and `@react-native-async-storage/async-storage` for secure/general storage, `zego-express-engine-reactnative` for ZEGO integration, `expo-speech` for optional TTS.
- Backend: `fastapi` + `uvicorn` (fast async HTTP API), `motor` (async MongoDB), `pydantic` (models & validation), `httpx` (outbound session exchange), `cryptography` (ZEGO token encryption), `emergentintegrations` (Stripe wrapper used here).

**App Architecture**
- **Workspace layout (high level):**
  - [frontend/](frontend/) — Expo app, file-based routes in [frontend/app/](frontend/app/)
  - [frontend/src/](frontend/src/) — shared utilities, API client, context and hooks (e.g., [frontend/src/api/client.ts](frontend/src/api/client.ts), [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx)).
  - [backend/](backend/) — single FastAPI entry at [backend/server.py](backend/server.py) and test suite in [backend/tests/](backend/tests/).
  - Root docs: [design_guidelines.json](design_guidelines.json), [README.md](README.md).
- **Frontend ↔ Backend communication:**
  - The frontend calls a REST API rooted at `EXPO_PUBLIC_BACKEND_URL` (configured via environment) and prefixes paths with `/api` (see [frontend/src/api/client.ts](frontend/src/api/client.ts)).
  - Auth is token-based: backend issues `session_token` and frontend stores it in secure storage under `lf_session_token` via the `storage.secure*` helpers.
- **Database schema / primary models (MongoDB collections)** — keys observed in code and server responses:
  - `users`: fields include `user_id`, `email`, `name`, `picture`, `english_level`, `xp`, `coins`, `streak`, `last_active_date`, `daily_goal_minutes`, `daily_goal_completed_minutes`, `is_premium`, `premium_plan`, `premium_until`, `saved_words` (list of word ids), `friends`, `blocked`, `achievements`, `certificates`, `phone`, `referral_code`, `referred_by`, `referral_count`, `referral_discount_active`, `created_at`.
  - `user_sessions`: `session_token`, `user_id`, `expires_at` (TTL index present), `created_at`.
  - `rooms`: room metadata (`room_id`, `title`, `topic`, `host_name`, `host_avatar`, `participant_count`, `is_private`, `is_seed`, `created_at`). Seed rooms are inserted on startup.
  - `calls`: call logs with `call_id`, `user_id`, `partner_name`, `partner_avatar`, `duration_seconds`, `created_at`.
  - `payments`: checkout sessions and status for Stripe flows.
  - `phone_otps`: OTP records with `phone`, `code`, `expires_at` (TTL index), `attempts`.
  - `lesson_progress`, `speaking_tests`, `daily_challenges`, `friend_requests`, `reports` — collections used for user state and historical data.

**Features Implemented (in approximate order of implementation — server code order is used as authoritative where unclear)**
- **Auth / Session Exchange**
  - What: Exchange an external `session_id` (Emergent demo OAuth) for an app `session_token`; issue and persist sessions. Phone OTP sign-in (mock mode) and phone linking flows supported.
  - Backend: [backend/server.py](backend/server.py) endpoints `/auth/session`, `/auth/phone/send-otp`, `/auth/phone/verify-otp`, `/auth/phone/link`, `/auth/me`, `/auth/logout`.
  - Frontend: [frontend/app/login.tsx](frontend/app/login.tsx) and [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx) handle sign-in, token storage and bootstrap via `storage.secure*` and `api.createSession`.
  - Edge cases/notes: Phone OTP runs in `mock` mode by default — any 6-digit code is accepted as long as `send-otp` was called; `debug_code` is returned in responses for testing. Linking phone prevents reuse by another account and enforces uniqueness via DB partial index.

- **Profile & Progression**
  - What: Profile update, XP application, streak handling, daily goals.
  - Backend endpoints: `/profile` (PUT), `/xp` (POST). XP application updates streak, achievements and daily minutes (see `_apply_xp`).
  - Frontend: profile & settings pages: [frontend/app/settings.tsx](frontend/app/settings.tsx) and profile-related components in [frontend/src/context/AuthContext.tsx].
  - Edge cases: streak logic is date-based; careful handling of timezone-aware `created_at` & `last_active_date` in server code.

- **Home / Dashboard**
  - What: Welcome text, word-of-the-day, continue-lesson suggestion, categories and daily challenges.
  - Backend: `/home` (GET) returns `continue_lesson`, `word_of_the_day`, `categories`, `challenges`.
  - Frontend: [frontend/app/index.tsx](frontend/app/index.tsx) and dashboard components.

- **Lessons**
  - What: Lesson categories, lesson list, lesson detail, complete lesson and persist progress.
  - Backend endpoints: `/lessons/categories`, `/lessons`, `/lessons/{id}`, `/lessons/complete`, `/lessons/progress/all`.
  - Frontend pages: [frontend/app/lessons/[categoryId].tsx](frontend/app/lessons/[categoryId].tsx), [frontend/app/lesson/[id].tsx](frontend/app/lesson/[id].tsx).

- **Vocabulary (Vocab / Word of the Day)**
  - What: Vocab list, save/unsave words, word-of-the-day.
  - Backend: `/vocab`, `/vocab/word-of-the-day`, `/vocab/save`, `/vocab/unsave`.
  - Frontend pages/components: [frontend/app/vocabulary.tsx](frontend/app/vocabulary.tsx).

- **Challenges & Quiz**
  - What: Daily challenges listing and marking completion; quiz questions endpoint.
  - Backend: `/challenges`, `/challenges/{id}/complete`, `/quiz`.
  - Frontend: [frontend/app/challenges.tsx](frontend/app/challenges.tsx), [frontend/app/quiz.tsx](frontend/app/quiz.tsx).
  - Edge cases: Completing the same challenge twice in one day returns HTTP 400 (server enforces this).

- **Speaking Test (scored)**
  - What: Submit speaking test scores, persist results, award certificates for high scores.
  - Backend: `/speaking-test` (POST) and `/speaking-test/history`.
  - Frontend: [frontend/app/speaking-test.tsx](frontend/app/speaking-test.tsx).

- **Match / Mocked Real People Speaking**
  - What: Mock partner matching and a dummy call experience (seeded `PARTNER_POOL`).
  - Backend: `/match` returns random partner and `room_id`; `/calls` logs call; `/calls` (GET) returns call history.
  - Frontend: [frontend/app/match.tsx](frontend/app/match.tsx), [frontend/app/call.tsx](frontend/app/call.tsx), [frontend/app/call-history.tsx](frontend/app/call-history.tsx), and `host-room`/`room/[id].tsx` for live room flows.

- **Live Rooms (seeded & create/join)**
  - What: List seeded rooms, create new room, join a room.
  - Backend: `/rooms` (GET/POST) and `/rooms/join` (POST).
  - Frontend: [frontend/app/host-room.tsx](frontend/app/host-room.tsx), [frontend/app/room/[id].tsx](frontend/app/room/[id].tsx).

- **Leaderboard & Achievements**
  - What: Leaderboard ranking by XP and achievements listing.
  - Backend: `/leaderboard`, `/achievements`.
  - Frontend: [frontend/app/leaderboard.tsx](frontend/app/leaderboard.tsx), [frontend/app/achievements.tsx](frontend/app/achievements.tsx), [frontend/app/certificates.tsx](frontend/app/certificates.tsx).

- **Friend Requests, Reports & Blocking**
  - What: Send/list friend requests, report users, block users.
  - Backend: `/friends/request`, `/friends/requests`, `/reports`, `/block`.
  - Frontend: [frontend/app/friends.tsx](frontend/app/friends.tsx).

- **Referral System**
  - What: Generate/get referral code, apply referral code to account for discount tracking.
  - Backend: `/referral` (GET), `/referral/apply` (POST). Referral codes are generated server-side with uniqueness checks.
  - Frontend: [frontend/app/referral.tsx](frontend/app/referral.tsx).

- **Stripe Subscriptions (server-driven checkout)**
  - What: Provide subscription plans, create checkout session (server uses `StripeCheckout` wrapper), poll checkout status and upgrade user on payment success.
  - Backend: `/subscription/plans`, `/subscription/checkout`, `/subscription/status/{session_id}`, `/webhook/stripe`.
  - Frontend: [frontend/app/premium.tsx](frontend/app/premium.tsx), [frontend/app/premium/success.tsx](frontend/app/premium/success.tsx), [frontend/app/premium/cancel.tsx](frontend/app/premium/cancel.tsx).
  - Edge cases: Server applies referral discount server-side and marks `referral_discount_active` consumed on payment.

**App Flow / User Journey**
- **Typical flow (signup → practice → feedback):**
  1. Splash / Onboarding: user sees branded onboarding ([design_guidelines.json](design_guidelines.json) describes visuals) — [frontend/app/onboarding.tsx](frontend/app/onboarding.tsx).
  2. Sign-in: user signs in via external session exchange (`/auth/session`) or phone OTP (`/auth/phone/send-otp` + `/auth/phone/verify-otp`) — [frontend/app/login.tsx](frontend/app/login.tsx).
  3. Home / Dashboard: [frontend/app/index.tsx] shows daily goal, word-of-the-day, continue-lesson card and challenges. Backend `/home` composes this payload.
  4. Start a lesson: navigate to lessons hub ([frontend/app/lessons/[categoryId].tsx]) → lesson detail ([frontend/app/lesson/[id].tsx]) → complete lesson (calls `/lessons/complete`) and receives XP/achievements.
  5. Speaking practice: user either does a scored `speaking-test` or taps `Match` to find a mocked partner (`/match`) → enters call UI ([frontend/app/call.tsx]) → call logged to `/calls` → receives XP.
  6. Progress & rewards: achievements, certificates and leaderboard updates visible on profile/dashboard.

**Key Decisions & Reasoning**
- **Expo / React Native (single codebase for mobile + web):** chosen to deliver mobile-first, cross-platform experience quickly and leverage `expo-router` for file-based navigation.
- **FastAPI + Motor + MongoDB:** async APIs make matching and token generation responsive; schema flexibility is helpful for evolving lesson content and user metadata.
- **Mock-first approach for voice & OTP:** ZEGO token generation implemented server-side but actual real-time voice environment is mocked for UX polish; OTP operates in `mock` mode to simplify testing during development.
- **Server-side Stripe flow:** checkout flows are server-authoritative (amount, referral discount, webhook) to prevent client-side tampering.

**Known Issues / Pending Work**
- **OTP provider in mock mode:** `OTP_MODE` defaults to `mock`; real provider (Twilio) not wired — see note in [backend/server.py](backend/server.py).
- **ZEGO secrets requirement:** `ZEGO_SERVER_SECRET` must be exactly 32 bytes for Token04; misconfiguration will return HTTP 500 from `/zego/token`.
- **No Docker/CI manifests:** repo lacks Dockerfile, GitHub Actions or deployment config — deployment steps must be added for production.
- **Environment and secrets absent in repo:** `.env` not included; developer must supply `MONGO_URL`, `STRIPE_API_KEY`, `ZEGO_*` etc.
- **Frontend visual polish vs implementation:** design guidance strongly recommends `framer-motion` animations and specific typography; some visual details in `design_guidelines.json` may not be fully implemented yet.

**Environment & Config**
- **Environment variables used by backend** (names only):
  - `MONGO_URL`
  - `DB_NAME` (optional; default `lingua_franca`)
  - `STRIPE_API_KEY`
  - `ZEGO_APP_ID`
  - `ZEGO_SERVER_SECRET` (must be 32 chars for Token04)
  - `OTP_MODE` (e.g., `mock` or `twilio`)
- **Frontend environment variables**:
  - Ensure `EXPO_PUBLIC_BACKEND_URL` points at running backend (e.g., `http://localhost:8000`).

**Change Log**
- 2026-07-26: Create `memory.md` — initial comprehensive project memory covering architecture, features, env, setup, known issues and run instructions.
- 2026-07-26: **Major Content & Feature Updates**
  - **Backend Subscription Mapping:** Added weekly & quarterly SKUs to STRIPE_PLANS (w: $0.59/7d, m: $9.99/30d, q: $14.99/90d, y: $79.99/365d). Updated CheckoutRequest model to accept weekly|monthly|quarterly|yearly.
  - **Removed Coins System:** Eliminated all coins-related functionality from backend (UserOut model, initialization, calculations) and frontend (AuthContext User type). Removed from home and profile screens.
  - **Daily Minutes Left:** Added dynamic "Daily Minutes left" display replacing coins across Home and Profile screens. Shows remaining minutes based on daily_goal_minutes - daily_goal_completed_minutes. Updated TIERS to reflect backend-friendly subscription mapping with clear comments on pricing strategy.
  - **Image Updates:** Replaced Interview English section image across 3 files (index.tsx, practice.tsx, lessons/[categoryId].tsx) with professional Pexels photo by Ron Lach (#9870148).
  - **Lessons Expansion:**
    - Daily English: Added 10 lessons (11-20) covering making complaints, asking favors, congratulations, misunderstandings, apologies, jobs, hobbies, travel, family, weather.
    - Business English: Added 17 new lessons (4-20) spanning presentations, networking, difficult conversations, corporate etiquette, remote work, sales, leadership, project management, client relations, budgets, cross-cultural comms, change management, conflict resolution, innovation, performance reviews, mentoring, crisis management.
    - Interview English: Added 18 new lessons (3-20) covering job motivation, strengths/weaknesses, technical questions, salary negotiation, interview Q&A, difficult scenarios, follow-up, video interviews, panel interviews, case studies, group dynamics, phone screening, industry prep, startup vs corporate, achievements, cultural fit, offer negotiation.
    - Travel English: Added 18 new lessons (3-20) including restaurants, public transport, directions, shopping, emergencies, cultural etiquette, planning, travel issues, accommodations, food/dietary, currency, sightseeing, tours, insurance, meeting locals, adventure activities, scams/safety, travel stories.
  - **Vocabulary Expansion:** Added 38 new words to VOCAB_WORDS (w13-w50, total 50 words). Includes pragmatic, benevolent, melancholy, audacious, placid, eloquence, catalyst, frivolous, adept, perspicacious, tangible, obfuscate, nascent, perennial, oblivious, magnanimous, ambiguous, pragmatism, petulant, altruism, anomaly, colloquial, incisive, jocular, languish, nonchalant, palpable, quixotic, resonant, sagacious, tacit, unequivocal, vacillate, whimsical, xenial, zealous, zephyr, euphoria.
  - **Quiz Expansion:** Added 10 new questions (q11-q20) focused on idioms & phrases: break the ice, let it go, miss the boat, cost an arm an leg, burn the midnight oil, take off, under the weather, speak your piece, a sure thing, hit the nail on the head. Total quiz now 20 questions covering grammar, vocabulary, and practical expressions.
- 2026-07-27: Added weekly leaderboard UI support in `frontend/app/leaderboard.tsx` and `frontend/src/api/client.ts` to make future weekly score integration easy. The screen now normalizes `weekly_xp` if available and gracefully falls back to current XP-based ranking.
- 2026-08-02: Added lesson-level local audio practice support with optional pilot scripts for `daily-1`, `business-1`, `interview-1`, and `travel-1`. Updated backend lesson seed to include `script` arrays and added `ScriptPracticePlayer` to `frontend/app/lesson/[id].tsx` with local-only recording saved under `lesson_recordings/`.
- Confirmed feature is review-only on the frontend and does not upload recordings or add backend storage for them.

---

Notes for future agents:
- Always update this file (`memory.md`) when adding features, changing API shapes, or modifying env expectations. Do not create a new memory file — append a new dated entry under **Change Log**.
- When adding or renaming API endpoints, add a corresponding cross-reference to the frontend file(s) that call them (update the `Features Implemented` section).
