# Ops Console Robot Hub UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-layout the FreightFlow AI homepage into a Chinese-first operations console with a dedicated robot hub rail for booking drafts and email recognition review.

**Architecture:** Keep the current single-page Next.js feature structure. Modify focused React components in `src/features/freightflow/` and preserve existing API/service behavior. Add a small presentational robot hub wrapper in `workbench-page.tsx` rather than introducing new state or routes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, lucide-react, Vitest, in-app browser verification.

---

## File Structure

- Modify `.gitignore`: ignore `.superpowers/` visual brainstorming artifacts.
- Modify `src/features/freightflow/workbench-page.tsx`: change desktop grid layout, move `AiCopilotPanel` into the robot hub rail, add robot hub header metrics.
- Modify `src/features/freightflow/booking-plan-panel.tsx`: tighten spacing and list hierarchy for right-rail use.
- Modify `src/features/freightflow/email-recognition-panel.tsx`: update copy and compact action layout.
- Modify `docs/project-overview.md`, `docs/todo.md`, or `docs/handover.md` only if final implementation changes visible behavior beyond this plan.

---

### Task 1: Protect Local Visual Companion Files

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add local brainstorm directory to gitignore**

Ensure `.gitignore` includes:

```gitignore
# local app runtime settings
.freightflow/
.superpowers/
```

- [ ] **Step 2: Verify generated visual files are not tracked**

Run:

```bash
git status --short
```

Expected: no `?? .superpowers/` entry.

---

### Task 2: Re-layout Workbench Into Queue, Execution, Robot Hub

**Files:**
- Modify: `src/features/freightflow/workbench-page.tsx`

- [ ] **Step 1: Add robot hub metrics near existing derived values**

Add after `const reminderChips = ...`:

```ts
  const robotHubMetrics = {
    bookingPlans: bookingPlans.length,
    emailRecognitions: emailRecognitions.length,
    exceptionEmails: emailRecognitions.filter((item) => item.recognitionType === "EXCEPTION").length,
  };
```

- [ ] **Step 2: Replace the main content grid**

Replace the current `mt-3 grid min-h-0 flex-1...` section with a three-zone layout:

```tsx
          <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 min-[1500px]:grid-cols-[minmax(300px,360px)_minmax(0,1fr)_minmax(360px,400px)]">
            <QueuePanel ... />

            <section className="grid min-h-0 min-w-0 grid-cols-1 gap-3 xl:grid-rows-[auto_auto_minmax(0,1fr)]">
              <ShipmentDetailPanel ... />
              <ShipmentFieldPanel ... />
              <ShipmentActionPanel ... />
            </section>

            <aside className="grid min-h-0 min-w-0 grid-cols-1 gap-3 content-start">
              <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/30">
                <p className="text-sm font-semibold text-slate-950">机器人中台</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">订舱草稿、邮件识别和人工确认写回集中处理。</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-slate-500">待发计划</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{robotHubMetrics.bookingPlans}</p>
                  </div>
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
                    <p className="text-cyan-700">待审邮件</p>
                    <p className="mt-1 text-lg font-semibold text-cyan-950">{robotHubMetrics.emailRecognitions}</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-red-700">异常邮件</p>
                    <p className="mt-1 text-lg font-semibold text-red-950">{robotHubMetrics.exceptionEmails}</p>
                  </div>
                </div>
              </section>
              <BookingPlanPanel ... />
              <EmailRecognitionPanel ... />
              <AiCopilotPanel ... />
            </aside>
          </div>
```

Keep all existing props exactly as they are today. Move the existing `AiCopilotPanel` JSX into the new `aside` and remove the old outer right-column render.

- [ ] **Step 3: Run lint for JSX mistakes**

Run:

```bash
npm run lint
```

Expected: exit code 0.

---

### Task 3: Compact Booking Plan Panel For Right Rail

**Files:**
- Modify: `src/features/freightflow/booking-plan-panel.tsx`

- [ ] **Step 1: Update panel container and header density**

Change the root section class to:

```tsx
<section className="rounded-lg border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm shadow-slate-200/30">
```

Change the header wrapper to:

```tsx
<div className="flex flex-col gap-3">
```

Keep the button full-width on narrow rail:

```tsx
className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-cyan-600 px-3.5 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
```

- [ ] **Step 2: Tighten stats and list items**

Use `px-2.5 py-2` on stat cards and change list item class to:

```tsx
className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 transition hover:border-cyan-200 hover:bg-cyan-50/30"
```

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0.

---

### Task 4: Compact Email Recognition Panel And Correct Manual Writeback Copy

**Files:**
- Modify: `src/features/freightflow/email-recognition-panel.tsx`

- [ ] **Step 1: Update root container and description**

Change root section class to:

```tsx
<section className="rounded-lg border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm shadow-slate-200/30">
```

Change description text to:

```tsx
IMAP 邮件同步后进入待确认队列；操作员确认后才写回 Shipment。
```

- [ ] **Step 2: Make card actions more rail-friendly**

Change each article class to:

```tsx
className="rounded-lg border border-slate-200 px-3 py-2.5"
```

Change the action wrapper to:

```tsx
<div className="mt-3 grid grid-cols-2 gap-2">
```

Give `忽略` the class `col-span-2` by changing its class to:

```tsx
className="col-span-2 inline-flex min-h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
```

Move the matched-shipment text below buttons:

```tsx
<p className="mt-2 text-[11px] text-slate-400">
  {item.matchedShipmentId ? `关联 ${item.matchedShipmentId}` : "未匹配 Shipment"}
</p>
```

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0.

---

### Task 5: Verify Browser Layout

**Files:**
- No source changes expected.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Start local dev server**

Run:

```bash
npm run dev
```

Expected: server prints `Local: http://localhost:3000`.

- [ ] **Step 3: Browser DOM checks**

Open `http://localhost:3000` and confirm the page contains:

```text
机器人中台
待发订舱计划
邮件识别队列
IMAP 邮件同步后进入待确认队列
```

Click `同步邮箱`, then confirm buttons appear:

```text
确认写入
标记异常
忽略
```

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add .gitignore src/features/freightflow/workbench-page.tsx src/features/freightflow/booking-plan-panel.tsx src/features/freightflow/email-recognition-panel.tsx docs/superpowers/specs/2026-06-13-ops-console-robot-hub-ui-design.md docs/superpowers/plans/2026-06-13-ops-console-robot-hub-ui.md
git commit -m "feat: refine ops console robot hub layout"
git push
```

Expected: commit and push succeed on the current feature branch.

---

## Self-Review

- Spec coverage: the plan covers the selected C layout, robot hub header, BookingPlanPanel density, EmailRecognitionPanel copy/actions, validation, and `.superpowers/` cleanup.
- Placeholder scan: no `TBD`, vague TODOs, or undefined implementation steps remain.
- Type consistency: new metric names use existing `bookingPlans` and `emailRecognitions` state; `EmailRecognitionReviewAction` values are unchanged.
