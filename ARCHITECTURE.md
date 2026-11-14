# Architecture — MCL Portal

## Summary

Single **Angular 21** SPA with **Bootstrap 5**, backed by **Firebase Auth + Firestore + Storage** on a **dedicated** Firebase project (preferred id **`mcl-portal`** → default Hosting URL `https://mcl-portal.web.app`). Feature modules lazy-loaded under a shared shell. Code: GitHub `bhartman21/mcl-portal`.

**Scope:** VAVS + Ad Book only. **RibbonRackBuilder** is a separate site/repo with its own Firebase project (`mcl-rack-builder`); this portal does **not** host `ribbon-profiles` or ribbon routes. Shared look-and-feel only via `STYLE_GUIDE.md`. Optional header link out to https://bhartman21.github.io/RibbonRackBuilder/.

## High-level diagram

```
Browser (Angular SPA + Bootstrap)
    │
    ├─ Firebase Auth (email + one-time code via Cloud Functions custom token; Google possible later)  [project: mcl-portal]
    ├─ Firestore (users, roles, detachments, settings, vavs*, adBooks, ads, audits)
    └─ Storage (ad-images/{uid}/{adId}/...)
```

RibbonRackBuilder (separate browser app / GH Pages) → its own Firebase project — **no shared Auth/Firestore with this portal** for MVP.

## Firebase project (decided direction)

| Item | Guidance |
|------|----------|
| **Recommended project id** | `mcl-portal` |
| **Default Hosting URL** | `https://mcl-portal.web.app` (and `*.firebaseapp.com`) |
| **If id taken** | Create nearest available id; record actual id in env docs / CI secrets; keep domain-agnostic app config |
| **Do not use** | `mcl-rack-builder` (RibbonRackBuilder production — isolate ribbon data/auth) |

Decided Nov 9, 2026: launch on **Firebase Hosting default URL** (custom domain later optional).

## Angular application structure (target)

```
src/
  app/
    core/                 # singleton services, auth, guards
      auth/
      guards/
      models/
      services/
    shared/               # presentational components, pipes, Bootstrap wrappers
      components/
        shell-header/     # includes optional external Ribbon Rack link
        shell-footer/
        status-badge/
    features/
      home/
      vavs/
      ad-book/
      admin/              # users, roles, detachments, registration mode, ad sizes
    app.routes.ts
    app.config.ts
  styles/
    _variables.scss       # Bootstrap variable overrides (STYLE_GUIDE)
    styles.scss
  environments/
public/
  # logos / static assets (not ribbon PNGs)
```

**Inferred:** standalone components + `loadComponent` / `loadChildren` lazy routes.

## Routes (target)

| Path | Feature | Guard |
|------|---------|--------|
| `/` | Landing / home | Public |
| `/sign-in` | Auth | Public |
| `/vavs` | VAVS hub (period + detachment picker) | `authGuard` + active member |
| `/vavs/entries` | Activity + in-kind editor | `authGuard` + member or VAVS rep |
| `/vavs/reports` | CSV / print | VAVS rep (detachment or department) or admin |
| `/ad-book` | Books list | `authGuard` |
| `/ad-book/books/:bookId` | Book detail / layout | `authGuard` |
| `/ad-book/ads/new` | Create ad | `authGuard` |
| `/ad-book/ads/:adId` | Edit / view ad | owner or approver |
| `/ad-book/queue` | Approval queue | `adBookApprover` or admin |
| `/admin/users` | Role assignment + pending queue | department/national admin |
| `/admin/detachments` | Detachment directory | department/national admin |
| `/admin/ad-sizes` | Configurable ad sizes | ad approver or admin |
| `/admin/settings` | Registration mode lock-down | department/national admin |
| `/**` | Redirect `/` | — |

**No** in-app `/ribbons` routes. External link only.

## Shared shell

- Header: MCL branding, nav (VAVS, Ad Book), optional **external** “Ribbon Rack” → RibbonRackBuilder live URL, user email, sign-out.
- Footer: DoF attribution, print-hide class.
- Theme: Bootstrap 5 with SCSS overrides from `STYLE_GUIDE.md` (aligned visually with RibbonRackBuilder palette, not shared CSS files).

## Firebase: collections & data models

### `users/{uid}`

```ts
{
  uid: string;
  email: string;
  displayName?: string;
  memberNumber?: string;       // open / inferred
  defaultDetachmentId?: string;
  status: 'active' | 'pending' | 'suspended';
  roles: RoleId[];             // denormalized for UI; source of truth may be custom claims
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `settings/registration`

```ts
{ mode: 'open' | 'approval' }  // default 'open'; admin-editable lock-down switch
```

### `roleAssignments/{id}` (optional if using custom claims only)

```ts
{
  uid: string;
  role: RoleId;
  scopeType: 'none' | 'detachment' | 'department' | 'national';
  scopeId?: string;            // detachmentId or departmentId e.g. 'dof'
  createdBy: string;
  createdAt: Timestamp;
}
```

`RoleId` values: see `ROLES_AND_PERMISSIONS.md`.

### `departments/{id}`

```ts
{ id: 'dof', name: 'Department of Florida', organizationLabel: 'Marine Corps League — Department of Florida' }
```

### `detachments/{id}`

```ts
{
  id: string;                  // stable slug or number-based id — open
  departmentId: 'dof';
  number: string;              // e.g. '52'; omit/empty when unconfirmed
  name: string;                // e.g. 'PFC BRUCE W CARTER'
  displayName: string;         // full label for selects
  active: boolean;
  needsVerification?: boolean; // e.g. S/Sgt Ted Archambault until number confirmed
  notes?: string;
}
```

Seed from VAVS sample options. **#54 = Morris F Dixon Jr. Detachment** (confirmed Nov 9, 2026). Seed S/Sgt Ted Archambault as a separate doc with `needsVerification: true` and no number.

### `vavsPeriods/{id}`

```ts
{
  id: string;                  // e.g. dof_2026_h2
  departmentId: string;
  year: number;
  half: 1 | 2;                 // 1 = Jan–Jun, 2 = Jul–Dec
  start: string;               // ISO date
  end: string;
  label: string;
}
```

### `vavsEntries/{id}`

Recommend **one collection** with `worksheet: 'activity' | 'kind'`.

```ts
{
  id: string;
  departmentId: string;
  detachmentId: string;
  periodId: string;
  worksheet: 'activity' | 'kind';
  ownerUid: string;
  date?: string;
  endDate?: string;
  member: string;
  vaHours?: number;
  vaDollars?: number;
  vetHours?: number;
  vetDollars?: number;
  otherHours?: number;
  otherCash?: number;
  otherDollars?: number;       // tolls on activity
  miles?: number;
  notes?: string;
  category?: string;
  recipient?: 'va' | 'nonVA' | '';
  estimatedCost?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

App does **not** convert hours/miles to money.

### `vavsAuditLogs/{id}`

```ts
{
  id: string;
  entryId: string;
  action: 'create' | 'update' | 'delete';
  actorUid: string;
  actorRole: string;
  detachmentId: string;
  at: Timestamp;
  before?: object | null;
  after?: object | null;
}
```

Required when actor is a VAVS rep editing another member’s data; recommended for all writes.

### `adSizes/{id}`

```ts
{
  id: string;                  // 'full' | 'half' | 'quarter' | 'business_card' | custom
  label: string;
  widthIn: number;
  heightIn: number;
  slotsPerPage: number;        // e.g. full=1, half=2, quarter=4, business_card=8 (inferred)
  layoutHint: 'full' | 'horizontal-split' | 'grid';
  active: boolean;
  sortOrder: number;
}
```

### `adBooks/{id}`

```ts
{
  id: string;
  departmentId: string;
  title: string;
  eventName: string;
  eventDate?: string;
  status: 'draft' | 'open' | 'locked' | 'printed';
  pageSize: 'letter';
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `ads/{id}`

```ts
{
  id: string;
  bookId?: string;
  departmentId: string;
  sizeId: string;
  title: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  rejectionNotes?: string;
  submissionCount: number;      // max 3; only increased by submit, never lowered by owner
  maxSubmissions: number;       // default 3; approver/admin may raise by 1 (audited)
  locked?: boolean;             // true after 3rd rejection
  createdBy: string;
  createdByType: 'member' | 'company' | 'guest';
  companyName?: string;
  imagePath?: string;
  fit?: 'cover' | 'contain';
  position?: { x: number; y: number };
  submittedAt?: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Payment:** no fields in MVP (or reserved later — open).

### `adBookPages/{id}` (optional MVP+)

```ts
{
  bookId: string;
  pageIndex: number;
  slots: { adId: string; sizeId: string }[];
}
```

### Storage paths

```
ad-images/{uid}/{adId}/{filename}
```

Images: jpeg/png/webp; max size recommend **10 MB** (sample allowed 30 — prefer lower).

### Not in this project

- Collection `ribbon-profiles` — lives only on RibbonRackBuilder’s Firebase project.
- Ribbon PNG assets / rack modules.

## Security rules outline (by role)

Implement with **custom claims** (preferred) or Firestore `roleAssignments` reads. Outline only — write real rules before production. All writes require `users/{uid}.status == 'active'` when registration mode / suspension is enforced.

| Collection | guest | member | det VAVS rep | dept VAVS rep | ad approver | dept admin | national admin |
|------------|-------|--------|--------------|---------------|-------------|------------|----------------|
| users own doc | — | read/write own | same | same | same | read all | read all |
| settings/registration | — | read | read | read | read | R/W | R/W |
| detachments | read active | read | read | read | read | CRUD | CRUD |
| vavsEntries | — | CRUD own | R/W scope | R/W dept | — | R/W dept | R/W all |
| vavsAuditLogs | — | — | read scope | read dept | — | read | read |
| ads | — | CRUD own drafts; submit own | — | — | read submitted+; update status | full | full |
| adBooks | — | read open books | — | — | R/W | R/W | R/W |
| adSizes | read active | read | read | read | R/W | R/W | R/W |
| Storage ad-images | — | write own path; read if approved or owner | — | — | read | read | read |

**Pushback:** VAVS hours are operational data — require Auth + rules from day one. Do not import permissive patterns from the ribbon site.

## Totals & reporting (VAVS)

Compute in client for MVP; optional Cloud Function later. Formulas:

- Sum numeric fields per worksheet.
- In-kind VA total = sum `estimatedCost` where `recipient=='va'`.
- Unassigned in-kind with cost > 0 → UI warning.
- Print filter: activity overlapping date range; in-kind all (sample undated behavior) unless product changes.

## Hosting & deploy

| Option | Pros | Cons |
|--------|------|------|
| **Firebase Hosting on `mcl-portal` (decided for launch)** | SPA rewrites; same project as Auth/Firestore; default URL reads as portal | Custom domain optional later |
| GitHub Pages | Familiar elsewhere | Not preferred for this SPA; Auth authorized domains more awkward |

RibbonRackBuilder continues on GitHub Pages independently — no cutover required from this project.

### CI (inferred)

GitHub Actions: install → inject firebase config secret → `ng build` → `firebase deploy --only hosting` (and optionally Firestore/Storage rules).

## Environments

- `local` — emulators encouraged for rules testing.
- `prod` — Firebase project `mcl-portal` (or recorded alternate id).
- Staging project (**open** / recommended before broad DoF rollout).

## Out of scope for architecture MVP

- Ribbon rack modules / `ribbon-profiles`
- Multi-region tenancy
- Payment providers
- Native mobile apps (responsive web only)
- Shared Auth SSO with RibbonRackBuilder
