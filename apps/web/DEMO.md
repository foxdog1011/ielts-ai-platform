# IELTS AI Platform — Weekly Digest & Reminder Demo

> Integration story: deterministic coach layer + n8n automation workflows

---

## What Was Built

A **zero-LLM, deterministic coaching layer** on top of the existing dual-engine
scoring pipeline.  Every field is computed from persisted session history — no
inference cost, no latency, no hallucination risk.

```
Scoring Pipeline (LLM + local ML)
    └─ saveScore → KV   (persists: band, diagSummary, planSnapshot)
          └─ buildWeeklySummaryPayload   (reads history, pure fn)
          └─ buildReminderPayload         (reads history, pure fn)
                └─ formatWeeklyDigest → Discord / Email / Notion
                └─ formatReminderMessage  → Discord / Email
                      └─ /api/weekly-summary          (GET endpoint)
                            └─ n8n Workflow A (weekly)
                            └─ n8n Workflow B (inactivity)
```

---

## Runtime Architecture

| Layer | File | Role |
|---|---|---|
| Score persistence | `lib/kv.ts` | Stores `diagSummary` + `planSnapshot` alongside band |
| Cross-session analytics | `lib/weeklySummary.ts` | `ExamTypeSummary`, `WeeklySummaryPayload`, `ReminderPayload` |
| Notification formatting | `lib/workflowFormatter.ts` | Discord embed, email plaintext, Notion page |
| HTTP endpoint | `app/api/weekly-summary/route.ts` | `GET ?trigger=weekly&format=all` |
| n8n Workflow A | `n8n/workflow-a-weekly-digest.json` | Cron every Monday 09:00 → Discord + Email + Notion |
| n8n Workflow B | `n8n/workflow-b-inactivity-reminder.json` | Cron every 6h → fires if inactive ≥ 3 days |

---

## Running the Demo

**No server required.** Pure-function demo, runs standalone:

```bash
cd apps/web
npx tsx scripts/demo-weekly-summary.ts
```

Output: full formatted payload printed to console + `n8n/sample-output.json` written.

### API endpoint (dev server)

```bash
# Terminal 1
npm run dev

# Terminal 2 — weekly digest with all formats
curl "http://localhost:3000/api/weekly-summary?trigger=weekly&format=all" | jq .

# Inactivity reminder only
curl "http://localhost:3000/api/weekly-summary?trigger=inactivity_3d&format=reminder" | jq .

# Raw structured data (no formatting)
curl "http://localhost:3000/api/weekly-summary" | jq .
```

---

## Sample Output (2026-03-12, synthetic dataset)

Dataset: 5 writing sessions over 20 days (Band 5.0 → 6.5, grammar persistently weak)
+ 5 speaking sessions over 28 days (Band 5.0 → 6.0, fluency weak)

### Weekly Summary — Key Fields

```
overallStatus    : improving
urgencyLevel     : urgent          ← grammar anomaly in 3/5 writing sessions
primaryFocus     : writing
totalSessions    : 10
engagementDays   : 10  (last 30 days)
consistencyRating: medium          ← 3 sessions this week

Writing
  latestBand     : 6.5
  bandDelta      : +0.5            ← week-over-week improvement
  trend          : improving
  persistentWeak : grammar         ← below overall in 3/5 sessions
  recurringAnomalies: VERY_LOW_SUBSCORE:grammar_01

Speaking
  latestBand     : 6.0
  trend          : improving
  persistentWeak : fluency
  currentFocus   : fluency (current_weakest)

coachLine: "Recurring Grammar weakness in writing — focused drills this week."
reminderCandidateCopy: "Your Grammar needs attention — a 15-min writing drill could shift your band."
```

### Discord Embed (Weekly Digest)

```
🚨 Urgent practice needed!   ← @mention preamble when urgencyLevel=urgent

Title  : 📈 IELTS Weekly — Improving
Colour : #ED4245 (red — urgent)
Desc   : Recurring Grammar weakness in writing — focused drills this week.

[✍️ Writing]
  Band: 6.5 · Sessions: 2 · Trend: improving
  Weak: grammar
  ⚠ Anomaly: VERY_LOW_SUBSCORE:grammar_01
  Focus: grammar

[🎤 Speaking]
  Band: 6 · Sessions: 1 · Trend: improving
  Weak: fluency
  Focus: fluency

[⚠️ Recurring Anomalies]
  VERY_LOW_SUBSCORE:grammar_01

[🎯 Recommended Next Action]
  Focus: grammar  ·  Task: task2_argument  ·  Urgency: urgent

Footer: 10 sessions total  ·  10 active days (30d)  ·  2026-03-12
```

### Email (Weekly Digest)

```
Subject: [IELTS] 📈 Improving — 2026-03-12

IELTS Weekly Summary — Thu Mar 12 2026
Status: Improving 📈

Recurring Grammar weakness in writing — focused drills this week.

Writing  — Band 6.5 | improving | 2 session(s) this week
Speaking — Band 6.0 | improving | 1 session(s) this week

⚠ Recurring anomalies: VERY_LOW_SUBSCORE:grammar_01

→ Practice Grammar
  Task: task2_argument

Recurring Grammar weakness detected. A focused IELTS drill today could shift your band.
```

### Notion Page

```
Title : IELTS Weekly — 2026-03-12
Properties:
  status             : improving
  urgency            : urgent
  writing_band       : 6.5
  speaking_band      : 6
  sessions_this_week : 3
  engagement_days    : 10
  primary_focus      : writing
  recurring_anomalies: VERY_LOW_SUBSCORE:grammar_01
  generated_at       : 2026-03-12T10:00:00.000Z
```

### Reminder (Inactivity Trigger)

```
triggerType          : inactivity_3d
daysSinceLastSession : 1
examTypeFocus        : mixed
urgency              : urgent
hasRecurringAnomalies: true
hasPersistentWeakness: true
isImproving          : true
reminderText : "Recurring Grammar weakness detected. A focused IELTS drill today could shift your band."
ctaLabel     : "Practice Grammar"
ctaTaskType  : "task2_argument"

Discord: 🚨 IELTS Reminder — Mixed Focus
Email:   [IELTS] 🚨 Practice Grammar
```

Full JSON at [`n8n/sample-output.json`](n8n/sample-output.json).

---

## n8n Workflow Setup

### Workflow A — Weekly Digest

Import `n8n/workflow-a-weekly-digest.json`.

| Node | Type | Config |
|---|---|---|
| Every Monday 9am | Schedule Trigger | weekly, day=1, hour=9 |
| Fetch Weekly Summary | HTTP Request | GET `{{BASE_URL}}/api/weekly-summary?trigger=weekly&format=all` |
| Route on Urgency | Switch | `data.weeklySummary.urgencyLevel` |
| Post Discord | HTTP Request | POST to `{{DISCORD_WEBHOOK_URL}}`, body = `formattedDiscord` |
| Send Email | Gmail / SMTP | subject + plaintext from `formattedEmail` |
| Create Notion Page | Notion | title + properties from `formattedNotion` |

Environment variables needed in n8n:
```
BASE_URL            = https://your-app.vercel.app   (or http://localhost:3000 for local)
DISCORD_WEBHOOK_URL = https://discord.com/api/webhooks/...
```

### Workflow B — Inactivity Reminder

Import `n8n/workflow-b-inactivity-reminder.json`.

Runs every 6 hours. Fires Discord/email only when `daysSinceLastSession >= 3`.
Includes n8n branching on `isFirstSession`, `hasRecurringAnomalies`, `hasPersistentWeakness`.

---

## Integration Story

> **"AI-Powered IELTS Coaching Platform with Automated Engagement Workflows"**

Built a full-stack IELTS preparation platform with:

- **Dual-engine scoring** — OpenAI LLM + local Python ML model, fused by confidence weights with quantile calibration → IELTS band scores
- **Deterministic coaching layer** — cross-session pattern detection (persistent weaknesses, recurring anomalies, trend analysis) computed without LLM calls
- **Automated weekly digest** — n8n workflows fetch `/api/weekly-summary`, branch on urgency signals, deliver formatted summaries to Discord, Email, and Notion
- **Zero-hallucination guarantee** — all coaching copy is rule-based string templates driven by structured data; no generative model in the notification pipeline
- **Test coverage** — 189 unit tests (Node test runner), 0 TypeScript errors

**Tech stack:** Next.js 14, TypeScript, Vercel KV, OpenAI API (GPT-4o + Whisper), Python (ML pipeline), n8n (workflow automation), Zod (schema validation)

---

## Screenshot / Demo Sequence

Recommended sequence for recording:

1. **Terminal** — `npx tsx scripts/demo-weekly-summary.ts` → show console output
2. **VS Code** — open `n8n/sample-output.json`, collapse to show structure
3. **Browser (dev server)** — `curl localhost:3000/api/weekly-summary?trigger=weekly&format=all | jq .data.formatted.discord`
4. **n8n canvas** — import `workflow-a-weekly-digest.json`, show node connections
5. **Discord** — paste `sample-output.json > weeklyDigest.formattedDiscord` into Postman → send to webhook → screenshot embed
6. **App UI** — submit a writing essay, show StudyPlanBlock + CoachBlock in right panel

---

## Remaining Limitations

| Item | Detail |
|---|---|
| Single-user scope | `scopeId: "default"` — no user auth; each call reads entire history |
| History limit | `listHistory({ limit: 50 })` — trends across > 50 sessions may be clipped |
| n8n BASE_URL | Must be publicly reachable; local dev requires ngrok or tunnel |
| Notion schema | `body_markdown` is a string field — caller must map it to a Notion "rich text" block |
| Calibration | Single quantile map shared by writing + speaking; exam-type-specific maps would improve accuracy |
