# Architecture — MCL Portal

## Summary

Single **Angular 21** SPA with **Bootstrap 5**, backed by **Firebase Auth + Firestore + Storage** on project **`mcl-rack-builder`**. Feature modules lazy-loaded under a shared shell. Code lives in a **new** GitHub repo `mcl-portal` (recommended); RibbonRackBuilder remains until cutover.

## High-level diagram

```
Browser (Angular SPA + Bootstrap)
    │
    ├─ Firebase Auth (email link / optional Google)
    ├─ Firestore (users, roles, detachments, vavs*, adBooks, ads, audits, ribbon-profiles)
    └─ Storage (ad-images/{uid}/{adId}/...)
```

## Angular application structure (target)

```
src/
  app/
    core/                 # singleton services, auth, guards, interceptors
      auth/
      guards/
      models/
      services/
    shared/               # presentational components, pipes, Bootstrap wrappers
      components/
        shell-header/
        shell-footer/
        status-badge/
    features/
      home/
      vavs/
      ad-book/
      ribbon-rack/        # ported from RibbonRackBuilder
      admin/              # users, roles, detachments, size config
    app.routes.ts
    app.config.ts
  styles/
    _variables.scss       # Bootstrap variable overrides (STYLE_GUIDE)
    styles.scss
    ribbon-legacy.css     # preserved RibbonRack chrome (revert path)
  environments/
public/
  ribbons/                # PNGs (unchanged from RibbonRackBuilder)
```

**Inferred:** standalone components + `loadComponent` / `loadChildren` lazy routes (matches existing RibbonRack pattern).

## Routes (target)

| Path | Feature | Guard |
|------|---------|--------|
| `/` | Landing / home | Public |
| `/sign-in` | Auth | Public |
| `/vavs` | VAVS hub (period + detachment picker) | `authGuard` |
| `/vavs/entries` | Activity + in-kind editor | `authGuard` + member or VAVS rep |
| `/vavs/reports` | CSV / print | VAVS rep (detachment or department) or admin |
| `/ad-book` | Books list | `authGuard` |
| `/ad-book/books/:bookId` | Book detail / layout | `authGuard` |
| `/ad-book/ads/new` | Create ad | `authGuard` |
| `/ad-book/ads/:adId` | Edit / view ad | owner or approver |
| `/ad-book/queue` | Approval queue | `adBookApprover` or admin |
| `/ribbons` | Ribbon Rack builder | Public read/build; save uses existing PIN model |
| `/ribbons/admin` | Ribbon profiles admin | `departmentAdmin` or `nationalAdmin` (replace hard-coded email) |
| `/admin/users` | Role assignment | department/national admin |
| `/admin/detachments` | Detachment directory | department/national admin |
| `/admin/ad-sizes` | Configurable ad sizes | ad approver or admin |
| `/**` | Redirect `/` | — |

Exact child paths may vary; keep feature prefixes stable.

## Shared shell

- Header: MCL branding, nav links by role, user email, sign-out.
- Footer: DoF attribution, print-hide class.
- Theme: Bootstrap 5 with SCSS variable overrides from `STYLE_GUIDE.md`.
- Content projection pattern from RibbonRack `HeaderComponent` can be merged into `shell-header` (inferred reuse).

## Firebase: collections & data models

### `users/{uid}`

```ts
{
  uid: string;
  email: string;
  displayName?: string;
  memberNumber?: string;       // open / inferred
  defaultDetachmentId?: string;
  roles: RoleId[];             // denormalized for UI; source of truth may be custom claims
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
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
  number: string;              // e.g. '52'
  name: string;                // e.g. 'PFC BRUCE W CARTER'
  displayName: string;         // full label for selects
  active: boolean;
  needsVerification?: boolean; // true for entries with unconfirmed number (e.g. S/Sgt Ted Archambault)
  notes?: string;
}
```

Seed from VAVS sample options. #54 = Morris F Dixon Jr. Detachment (confirmed Nov 9, 2026); seed S/Sgt Ted Archambault Detachment as a separate doc with `needsVerification: true` and no number.

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

Activity + in-kind can be one collection with `worksheet: 'activity' | 'kind'` **or** two collections. Recommend **one collection** for simpler rep queries.

```ts
{
  id: string;
  departmentId: string;
  detachmentId: string;
  periodId: string;
  worksheet: 'activity' | 'kind';
  ownerUid: string;            // member who created / primary owner
  // activity fields (nullable when kind):
  date?: string;
  endDate?: string;
  member: string;              // description / member name (sample field)
  vaHours?: number;
  vaDollars?: number;
  vetHours?: number;
  vetDollars?: number;
  otherHours?: number;
  otherCash?: number;
  otherDollars?: number;       // tolls on activity
  miles?: number;
  notes?: string;
  // kind fields:
  category?: string;           // enum from sample list
  recipient?: 'va' | 'nonVA' | '';
  estimatedCost?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Keep sample semantics: app does **not** convert hours/miles to money.

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

Seed full / half from sample; add quarter + business card as configurable defaults.

### `adBooks/{id}`

```ts
{
  id: string;
  departmentId: string;
  title: string;
  eventName: string;           // convention / banquet
  eventDate?: string;
  status: 'draft' | 'open' | 'locked' | 'printed';
  pageSize: 'letter';           // MVP
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `ads/{id}`

```ts
{
  id: string;
  bookId?: string;             // assigned when placed; may be null while draft
  departmentId: string;
  sizeId: string;
  title: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  rejectionNotes?: string;
  createdBy: string;           // uid
  createdByType: 'member' | 'company' | 'guest'; // company later
  companyName?: string;
  imagePath?: string;          // Storage path
  fit?: 'cover' | 'contain';
  position?: { x: number; y: number };
  // optional multi-slot later
  submittedAt?: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Payment:** no fields in MVP (or `paymentStatus: 'not_applicable'` reserved — open).

### `adBookPages/{id}` (optional MVP+)

```ts
{
  bookId: string;
  pageIndex: number;
  slots: { adId: string; sizeId: string }[];
}
```

MVP may assemble pages client-side from approved ads ordered by size.

### `ribbon-profiles/{profileId}` (EXISTING — do not rename)

Preserve RibbonRackBuilder `UserRackProfile` shape:

```ts
{
  profileId: string;
  memberName: string;
  detachmentName: string;
  detachmentNumber: string;
  detachmentLocation: string;
  email?: string;
  phone?: string;
  awards: { ribbonId: number; count: number; marksmanshipLevel?; isFramed? }[];
  updatedAt: Timestamp;
  pin?: string;                // keep as-is for MVP (accepted risk)
}
```

### Storage paths

```
ad-images/{uid}/{adId}/{filename}
```

Images: jpeg/png/webp; max size policy e.g. 10–15 MB (**open**; sample used 30 MB client-side — prefer lower on Storage).

## Security rules outline (by role)

Implement with **custom claims** (preferred) or Firestore `roleAssignments` reads. Outline only — write real rules in repo before production.

| Collection | guest | member | det VAVS rep | dept VAVS rep | ad approver | dept admin | national admin |
|------------|-------|--------|--------------|---------------|-------------|------------|----------------|
| users own doc | — | read/write own | same | same | same | read all | read all |
| detachments | read active | read | read | read | read | CRUD | CRUD |
| vavsEntries | — | CRUD own (`ownerUid==auth.uid`) | R/W where `detachmentId` in scope | R/W department | — | R/W dept | R/W all |
| vavsAuditLogs | — | read own-related? | read scope | read dept | — | read | read |
| ads | — | CRUD own drafts; submit own | — | — | read submitted+; update status | full | full |
| adBooks | — | read open books | — | — | R/W | R/W | R/W |
| adSizes | read active | read | read | read | R/W | R/W | R/W |
| ribbon-profiles | **current behavior** (weak) until backlog | keep | keep | keep | keep | keep | keep |
| Storage ad-images | — | write own path; read if approved or owner | — | — | read | read | read |

**Pushback:** Do **not** copy RibbonRack’s open profile reads into VAVS. VAVS hours are operational data; require Auth + rules from day one.

**Ribbon:** Owner accepted PIN-as-is; rules may remain permissive temporarily — isolate that risk to `ribbon-profiles` only.

## Totals & reporting (VAVS)

Compute in client (like sample) for MVP; optional Cloud Function later for department rollups. Formulas:

- Sum numeric fields per worksheet.
- In-kind VA total = sum `estimatedCost` where `recipient=='va'`.
- Unassigned in-kind with cost > 0 → UI warning (sample behavior).
- Print filter: activity overlapping date range; in-kind all (or period-tagged — sample used undated in-kind; **keep sample behavior** unless product changes).

## Hosting & deploy

| Option | Pros | Cons |
|--------|------|------|
| **Firebase Hosting (recommended)** | SPA rewrites, same project as Auth/Firestore, custom domain easy, matches `firebase.json` already in RibbonRack | Leaves GH Pages URL for old app until redirect |
| GitHub Pages | Familiar for RibbonRack | Static only (OK for SPA); awkward for multi-feature base-href; Auth authorized domains must include `*.github.io` |

**Recommendation:** Deploy `mcl-portal` to **Firebase Hosting** on `mcl-rack-builder`. Keep RibbonRackBuilder on GitHub Pages until Phase 3 cutover, then redirect `/RibbonRackBuilder/` → portal `/ribbons` (or banner with link).

### CI (inferred)

GitHub Actions: install → inject firebase config secret → `ng build` → `firebase deploy --only hosting` (and optionally rules).

## Environments

- `local` — emulators encouraged for VAVS rules testing.
- `prod` — `mcl-rack-builder`.
- Staging project (**open** / recommended before broad DoF rollout).

## Versioning & revert (Ribbon CSS)

1. Import Bootstrap for shell/forms.
2. Keep rack visualizer + ribbon tile CSS in `ribbon-legacy.css` initially.
3. Tag `ribbon-chrome-pre-bootstrap` before converting chrome.
4. Feature flag `useLegacyRibbonChrome` if needed for emergency revert.

## Out of scope for architecture MVP

- Multi-region tenancy
- Payment providers
- Native mobile apps (responsive web only)
