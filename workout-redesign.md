Rebuild the existing **Workout** feature of this React PWA.

The current workout implementation is not good enough for regular workout tracking. Replace the current workout UX and implementation with the design below, while preserving existing functionality/data wherever practical.

## 1. First inspect the existing project

Before making changes:

1. Find the current Workout tab/page, components, hooks, state/store, API functions, persistence logic, and workout-related types/models.
2. Find the existing backend/API schema and database schema used by workouts, routines, exercises, sets, reps, weights, etc.
3. Inspect existing workout data and determine whether the current schema can support the required UX.
4. **Do not change the schema just because the new design is cleaner.**
5. Reuse the existing schema whenever it can represent the required functionality.
6. Only modify/migrate the schema when a requirement genuinely cannot be implemented safely with the existing schema.
7. If schema changes are required:
   - make the smallest possible change
   - preserve existing historical data
   - provide a migration/backward-compatible approach
   - do not silently delete or transform old workout history

8. Do not create duplicate concepts/entities if an existing entity already serves that purpose.

The implementation should fit naturally into the current project's architecture, naming conventions, API conventions, state-management solution, UI library, and styling system.

Do not replace the project's existing libraries with different ones unless there is a strong technical reason.

---

# 2. Core mental model

Separate these concepts clearly:

### Routine

A reusable workout template.

Example:

```text
PPL
 ├── Push
 │    ├── Bench Press
 │    ├── Incline Dumbbell Press
 │    └── Cable Fly
 ├── Pull
 │    ├── Lat Pulldown
 │    └── Seated Row
 └── Legs
      ├── Squat
      └── Leg Curl
```

### Workout session

What the user actually performed on a specific date.

Example:

```text
Sep 26
Push
 ├── Bench Press
 │    ├── 60kg × 10
 │    ├── 60kg × 9
 │    └── 55kg × 10
 └── Incline Dumbbell Press
      ├── 22.5kg × 10
      └── 22.5kg × 9
```

A routine must NOT contain today's actual sets/reps/weights.

Routine = template.

Workout session = performed data.

Historical workouts must remain valid even if the user later edits the routine.

---

# 3. Supported routine types

The app must support all of these:

### PPL

```text
Push
Pull
Legs
```

### Upper / Lower

```text
Upper
Lower
```

### Single muscle / custom split

Example:

```text
Chest
Back
Shoulders
Arms
Legs
```

### Custom routine

Allow any number of groups.

Do NOT hardcode the application logic around exactly 2 or 3 groups.

The actual model should support:

```text
Routine
  → N groups
      → N exercises
```

The user can name groups however they want.

---

# 4. Workout tab — first screen

The first Workout screen is the **routine overview**.

Important: **do not show a date selector on this screen.**

The purpose of this screen is to answer:

> What is my current workout routine?

Example:

```text
┌─────────────────────────────────┐
│ Workout              Manage ⚙  │
│                                 │
│ Current routine                 │
│ Push Pull Legs                  │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ PUSH                        │ │
│ │ 4 exercises              → │ │
│ │ Last performed: Sep 24     │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ PULL                        │ │
│ │ 5 exercises              → │ │
│ │ Last performed: Sep 23     │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ LEGS                        │ │
│ │ 4 exercises              → │ │
│ │ Last performed: Sep 22     │ │
│ └─────────────────────────────┘ │
│                                 │
│       Exercise History           │
└─────────────────────────────────┘
```

Each group should be tappable.

Do not imply that Push, Pull and Legs are all today's workout.

They are simply groups belonging to the current routine.

---

# 5. Routine management

Add a **Manage** button in the Workout screen header.

Clicking Manage must open a **bottom sheet above the current UI**.

The sheet should contain:

```text
Manage Workout

Current routine
[PPL ✓]

Your routines

PPL
Upper / Lower
Bro Split

+ Add Routine
```

Requirements:

- User can create multiple routines.
- User can select exactly one current/active routine.
- Selecting a routine immediately makes it active and closes the sheet.
- Existing routines can be edited.
- Existing routines can be deleted only when safe.
- Do not delete historical workout data when deleting/changing a routine.
- If deleting an active routine, require the user to choose another routine or leave no active routine.
- Keep the flow simple for newcomers.

---

# 6. Create routine

When the user taps `+ Add Routine`, allow them to create a routine.

Recommended UX:

```text
Create Routine

Routine name
[ Push Pull Legs ]

Template

○ Push / Pull / Legs
○ Upper / Lower
○ Muscle per day
○ Custom
```

Selecting a template should only create the initial group structure.

For example:

PPL:

```text
Push
Pull
Legs
```

Upper/Lower:

```text
Upper
Lower
```

Muscle per day may start with a flexible/custom group setup.

Do not force a fixed number of groups.

Also support:

```text
Start empty
Copy existing routine
```

if this can be added without unnecessary complexity.

---

# 7. Routine group management

Inside routine editing:

```text
PPL

Workout groups

Push
Pull
Legs

+ Add workout group

Done
```

User can:

- add group
- rename group
- delete group
- reorder groups
- open a group to manage exercises

Use the project's existing drag/reorder mechanism if one already exists; otherwise keep reordering simple.

---

# 8. Exercise management inside a group

A group contains exercises but **NO actual workout sets/reps/weight**.

Example:

```text
Push

Bench Press
Incline Dumbbell Press
Cable Fly
Shoulder Press

+ Add Exercise
```

When adding an exercise:

```text
Add Exercise

Search exercises...

Bench Press
Incline Bench Press
Machine Chest Press
Cable Fly
Pec Deck
...
```

Use the existing exercise library/schema if available.

If the existing application already has an exercise entity/library, reuse it.

Allow custom exercises if the current product already supports them; otherwise structure the implementation so this can be added later without redesigning workout history.

Exercise order must be persisted.

---

# 9. After creating/editing the routine

When routine management is complete:

- close the bottom sheet
- return to the Workout overview
- show the active routine's groups
- do not show date selection here

The user should see:

```text
PPL

Push
Pull
Legs
```

---

# 10. Opening a workout group

When the user opens a group, THEN show date navigation.

Example:

```text
← Push

‹   Sep 26, 2026   ›

Today
```

Allow:

- previous day
- next day
- calendar date selection

Use left/right controls and a calendar control.

Recommended behavior:

- past dates are selectable
- today is selectable
- future dates should not be freely editable unless the existing application already supports planned/future workouts
- if future workout planning is not currently supported, disable future dates

The date belongs to the **actual workout session**, not the routine overview.

---

# 11. Workout group detail screen

Example:

```text
┌──────────────────────────────────────┐
│ ← Push                              │
│                                      │
│       ‹  Sep 26, 2026  ›             │
│              Today                   │
│                                      │
│ ▼ Bench Press                       │
│   Last session: 60kg × 10            │
│                                      │
│   Set      Weight       Reps          │
│   1        [ 60 ]      [ 10 ]         │
│   2        [ 60 ]      [  9 ]         │
│   3        [ 55 ]      [ 10 ]         │
│                                      │
│   + Add Set                           │
│                                      │
│ ▼ Incline Dumbbell Press             │
│   Last session: 22.5kg × 10           │
│                                      │
│   ...                                │
│                                      │
│          [ Save Workout ]             │
└──────────────────────────────────────┘
```

Use expandable/collapsible exercise sections.

Each exercise should show:

- exercise name
- previous-session information
- today's sets
- today's weight
- today's reps
- add set
- delete set if needed

---

# 12. Previous-session prefill

This is a required feature.

When the user starts a workout for an exercise, use the most recent completed/performed session for that exercise as a reference.

Example previous workout:

```text
Bench Press

60kg × 10
60kg × 9
55kg × 10
```

Today's workout should initially be prefilled:

```text
Set 1    60kg    10
Set 2    60kg     9
Set 3    55kg    10
```

BUT:

**these are today's draft values, not historical records.**

The user can change them.

Also display a clear reference:

```text
Previous: 60kg × 10
```

Do not overwrite historical data when the user edits today's values.

---

# 13. Suggested progressive overload UX

Do not automatically change the user's weight or reps.

Initially only show the previous values.

Later the product can optionally support:

```text
Previous: 60kg × 10
```

and a future "suggested weight" feature.

Do not build an aggressive automatic progression system unless one already exists.

---

# 14. Save behavior

Avoid one API request per set.

Do NOT do:

```text
POST set 1
POST set 2
POST set 3
POST set 4
```

Instead construct the complete workout/group payload in memory and save it in one API call.

For example conceptually:

```json
{
  "date": "2026-09-26",
  "groupId": "push",
  "exercises": [
    {
      "exerciseId": "bench-press",
      "sets": [
        {
          "setNumber": 1,
          "weight": 60,
          "reps": 10
        },
        {
          "setNumber": 2,
          "weight": 60,
          "reps": 9
        },
        {
          "setNumber": 3,
          "weight": 55,
          "reps": 10
        }
      ]
    }
  ]
}
```

Use the existing API shape if equivalent functionality already exists.

Do not create a new endpoint merely because the payload example differs.

---

# 15. Complete workout/group

Provide a clear action:

```text
[ Complete Workout ]
```

or the appropriate equivalent based on the current screen structure.

The user should be able to complete the current workout/group after saving.

If some exercises are not logged, do not silently discard them.

Instead warn:

```text
You haven't logged all exercises.

Do you want to complete anyway?

[Go Back] [Complete]
```

The user should still be allowed to complete a workout even when some exercises were skipped.

Skipped exercises are not failures and should not block the user permanently.

---

# 16. Draft persistence is mandatory

This is one of the most important requirements.

The user must NOT lose workout progress because they:

- switch tabs
- navigate to another screen
- press Back
- close the app/browser
- refresh the page
- temporarily lose network connectivity

Do NOT rely only on React component state.

Use persistent client-side storage.

Preferred approach:

```text
IndexedDB
```

or the project's existing persistent storage abstraction if it is already robust enough.

Recommended architecture:

```text
User input
    ↓
React state/store
    ↓
Persistent local draft
    ↓
API save
```

Every meaningful workout-draft change should be persisted locally.

For example:

```text
User enters:
Bench Press
60kg × 10

↓
React state updated
↓
draft persisted locally
```

When the user returns to the workout:

```text
60kg × 10
```

must still be present.

---

# 17. Draft vs historical data

Do not mix these concepts.

Today's unsaved draft:

```text
local persistent draft
```

Saved workout:

```text
server workout data
```

Completed workout:

```text
server workout marked completed
```

If the user edits today's draft, do not mutate previous dates.

---

# 18. Offline-friendly behavior

The app should at least preserve drafts while offline.

Example:

```text
Network unavailable

User logs:
60kg × 10

↓
Save locally
```

Then when connectivity is restored / user presses Save again, sync with API using the existing application architecture.

Do not build a massive offline-sync system unless the current project already has one. The important requirement is that the user's local draft is never lost.

---

# 19. Date/cache/API optimization

Optimize the Workout feature so that it does NOT fetch unnecessary historical workout data.

When the user enters a workout group for today:

```text
GET today's workout
```

and also prefetch:

```text
GET yesterday's workout
```

For example:

```text
Current:
Sep 26

Prefetch:
Sep 25
```

When the user navigates to yesterday:

```text
Current:
Sep 25

Prefetch:
Sep 24
```

Then:

```text
Current:
Sep 24

Prefetch:
Sep 23
```

So the navigation behaves like:

```text
Open Sep 26
   ↓
fetch Sep 26
prefetch Sep 25

go to Sep 25
   ↓
use cached Sep 25
prefetch Sep 24

go to Sep 24
   ↓
use cached Sep 24
prefetch Sep 23
```

Do not repeatedly request the same date if valid cached data already exists.

If the project already uses TanStack Query/React Query or another query/cache library, use that rather than creating a new caching system.

---

# 20. Avoid loading all workout history on the Workout screen

Do NOT do:

```text
GET all workouts
```

when opening the Workout tab.

The Workout screen should fetch only what it needs for the selected date.

Exercise history is a separate feature and should have its own API/query.

---

# 21. Exercise History

The Workout overview should have:

```text
Exercise History
```

Open it to show all exercises the user has performed historically.

Example:

```text
Exercise History

🔍 Search exercise

Bench Press
Last: 60kg × 10
Best: 80kg × 6

Incline Dumbbell Press
Last: 22.5kg × 10

Cable Fly
Last: 35kg × 12
```

Search/filter should be implemented if the existing project architecture supports it cleanly.

---

# 22. Exercise details / progressive overload

When the user opens an exercise:

```text
Bench Press

Last workout
60kg × 10

Best
80kg × 6
```

Then show historical progression.

The user specifically wants:

- weight progression
- reps progression

Do not put weight and reps on the exact same Y-axis because they are different units.

Prefer either:

```text
Weight
[graph]

Reps
[graph]
```

or a tab/toggle:

```text
Weight | Reps | Volume
```

For the first implementation, Weight + Reps are enough.

Also show the underlying recent history, for example:

```text
Sep 26   60kg × 10
Sep 24   60kg × 9
Sep 20   57.5kg × 10
Sep 18   55kg × 10
```

Use the project's existing chart library if one already exists.

Do not introduce a new chart dependency unnecessarily.

---

# 23. Historical workout integrity

Historical workouts must not depend on the current routine configuration.

Example:

Current routine:

```text
Push
 ├── Bench Press
 └── Cable Fly
```

User later deletes Cable Fly from the routine.

Old workouts must still show:

```text
Sep 10
Cable Fly
35kg × 12
```

Therefore:

- never reconstruct historical workouts from the current routine
- preserve historical exercise/workout references
- if schema changes are required, retain old IDs/references or snapshot the necessary historical information in the smallest possible way

---

# 24. Routine switching

If the user switches:

```text
PPL
```

to:

```text
Upper / Lower
```

do not delete or rewrite old PPL workouts.

Existing historical sessions remain unchanged.

Current routine only determines what the Workout overview displays for new/current sessions.

Also do not delete a partially completed workout merely because the user changed routines.

---

# 25. New-user experience

When there is no routine yet, don't show an empty technical-looking screen.

Show:

```text
Workout

Create your first routine

Choose how you train:

Push / Pull / Legs
Upper / Lower
Muscle per day
Custom

[Create Routine]
```

After the first routine exists, show the normal routine overview.

Keep terminology simple and avoid exposing technical concepts such as "WorkoutGroup entity" etc.

---

# 26. UI/UX principles

The new Workout feature should be easy for someone using the app for the first time.

Priorities:

1. Clear hierarchy
2. Minimal number of controls per screen
3. Large touch targets
4. Obvious primary action
5. Avoid unnecessary confirmation dialogs
6. Do not make the user understand internal data concepts
7. Never lose entered workout data
8. Make previous workout data immediately visible
9. Keep date navigation only where it is relevant: inside the actual workout/group screen
10. Make completion status obvious

The Workout overview should represent:

```text
What is my routine?
```

The workout detail screen should represent:

```text
What did I do on this date?
```

Do not combine these two concepts.

---

# 27. Suggested frontend structure

Adapt this to the existing project; do not force exact filenames.

A reasonable structure is:

```text
workout/
  components/
    WorkoutHome
    RoutineManagerSheet
    RoutineForm
    RoutineGroupEditor
    ExercisePicker
    GroupCard
    WorkoutGroup
    ExerciseAccordion
    SetRow
    DateNavigator
    ExerciseHistory
    ExerciseProgress

  hooks/
  store/
  api/
  db/
  types/
  utils/
```

Reuse existing patterns in the project whenever possible.

---

# 28. State/caching separation

If the project already has a query library such as TanStack Query:

Use query/cache state for server data:

```text
selected date workout
previous date workout
exercise history
```

Use persistent local state for:

```text
today's draft
unsaved edits
```

Do not put the entire historical workout database into global React state.

---

# 29. Save lifecycle

Recommended flow:

```text
Open Push for Sep 26
        ↓
Load server data for Sep 26
        ↓
Load previous workout/reference values
        ↓
Build editable local draft
        ↓
User enters/edits sets
        ↓
Persist draft locally
        ↓
User presses Save
        ↓
ONE API request
        ↓
Update query/cache
        ↓
Mark saved
        ↓
User may Complete
```

If an existing saved workout is opened again:

```text
server data
+
local unsaved draft (if present)
```

must be reconciled carefully so that unsaved user input is not accidentally overwritten.

---

# 30. Error handling

If Save fails:

```text
Workout could not be synced.
Your changes are saved locally.
```

Do not clear the draft.

Provide a retry action.

If the user leaves the screen after a failed save, the local draft must remain available.

---

# 31. Performance expectations

Avoid unnecessary renders and network requests.

Optimize for:

- instant navigation between cached dates
- minimal API calls
- local persistence
- lazy loading of exercise history
- no full-history fetch on workout entry
- no API call per set

Use memoization/selectors only where they actually help; do not introduce unnecessary complexity.

---

# 32. Data/schema rule — very important

Before changing any backend schema, explicitly inspect whether the current schema already supports:

- routines
- routine groups
- routine exercises
- workout date
- workout exercises
- sets
- reps
- weight
- completion status
- historical exercise tracking

If it does, **keep it**.

Only change the schema when the current representation fundamentally prevents one of the required features.

If a schema change is unavoidable:

1. Explain internally in the implementation comments/documentation why it is required.
2. Preserve all existing workout records.
3. Add migration logic where necessary.
4. Keep compatibility with existing API consumers where practical.
5. Avoid destructive database changes.

Do not rewrite the entire backend model merely to match the UI terminology.

---

# 33. Acceptance criteria

The implementation is complete only when all of the following work:

### Routine management

- [ ] Manage opens a bottom sheet
- [ ] User can create multiple routines
- [ ] User can select the active routine
- [ ] Selecting active routine closes the sheet
- [ ] User can manage groups
- [ ] Groups support any number of exercises
- [ ] Routine exercises have no actual workout set/rep/weight data

### Routine overview

- [ ] No date selector on the first screen
- [ ] Current routine is clearly identified
- [ ] Groups are displayed as Push/Pull/Legs, Upper/Lower, etc.
- [ ] Group cards open the actual workout screen
- [ ] Exercise History is accessible

### Workout logging

- [ ] Date navigation exists inside the workout group screen
- [ ] Previous/next day works
- [ ] Calendar date selection works
- [ ] Exercises are expandable
- [ ] User can add/edit/remove sets
- [ ] User can enter weight and reps
- [ ] Previous workout values are shown/prefilled
- [ ] Prefilled values are editable drafts
- [ ] Save uses a single API call for the relevant workout/group payload
- [ ] Complete action exists
- [ ] User can complete even if some exercises were skipped, after warning

### Persistence

- [ ] Switching tabs doesn't lose input
- [ ] Back navigation doesn't lose input
- [ ] Refresh doesn't lose input
- [ ] Closing and reopening the PWA doesn't lose unsaved draft
- [ ] Failed API calls do not destroy the local draft

### Data fetching

- [ ] Only today's selected workout is fetched initially
- [ ] Yesterday is prefetched
- [ ] Moving to yesterday uses the prefetched/cache data
- [ ] The next older date is then prefetched
- [ ] Duplicate fetches are avoided
- [ ] Entire workout history is not fetched on Workout tab load

### History

- [ ] User can see exercises they have performed historically
- [ ] Individual exercise history is accessible
- [ ] Weight progression is visualized
- [ ] Rep progression is visualized
- [ ] Historical data remains available after routine edits/deletions

---

# 34. Implementation process

Follow this order:

### Phase 1 — Inspect

Understand current workout UI, API, schema, state, persistence and existing data.

### Phase 2 — Data compatibility decision

Determine exactly what can be reused and what, if anything, needs migration.

### Phase 3 — Routine overview + routine management

Build the new first screen and Manage bottom sheet.

### Phase 4 — Group/exercise configuration

Implement routine group and exercise management.

### Phase 5 — Daily workout logging

Implement group detail, date navigation, previous-session prefill, set editing and save.

### Phase 6 — Persistent drafts

Implement IndexedDB or the project's existing equivalent.

### Phase 7 — Query/cache strategy

Implement today's fetch + yesterday prefetch + progressive older-date prefetch.

### Phase 8 — Exercise history

Implement exercise list and historical progression graphs.

### Phase 9 — Migration/testing

Verify old workout data still works and test all persistence/navigation/error cases.

---

# 35. Final instruction

Do not merely create mock screens.

Implement the feature end-to-end using the project's existing:

- frontend architecture
- backend APIs
- schema
- state management
- persistence approach
- component library
- styling system
- chart library

Preserve existing data.

Prefer incremental changes over rewriting unrelated parts of the application.

Most importantly:

**Do not change the database/API schema unless it is genuinely necessary for the requested functionality. Reuse the current schema wherever possible.**
