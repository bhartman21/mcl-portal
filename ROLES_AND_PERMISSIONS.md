# Roles and Permissions — MCL Portal

## Principles

1. **Least privilege** for VAVS and Ad Book (operational data).
2. Prefer **Firebase Auth + custom claims** or `roleAssignments` docs over hard-coded admin emails.
3. Scope: `none` | `detachment` | `department` (`dof`) | `national`.
4. Ribbon Rack permissions are **out of scope** for this portal (separate site). See deferred note below.

## Role catalog

| Role id | Display name | Typical people | Scope |
|---------|--------------|----------------|-------|
| `guest` | Public / guest | Not signed in | none |
| `member` | MCL member | DoF members | optional default detachment |
| `companyAdvertiser` | Company advertiser | External businesses | none (post-MVP) |
| `detachmentVavsRep` | Detachment VAVS rep | Detachment VAVS chair/rep | one or more detachments |
| `departmentVavsRep` | Department VAVS rep | DoF VAVS staff | department `dof` |
| `adBookApprover` | Ad book editor / approver | Staff who build books | department (MVP) |
| `departmentAdmin` | Department admin | DoF staff admins | department `dof` |
| `nationalAdmin` | National admin | National staff (later) | national |
| `siteAdmin` | Site administrator | Billy (only one at launch) | everything (above national) |

**Inferred:** A user may hold multiple roles (e.g. member + detachmentVavsRep).

**Decided:** Members log their own VAVS hours; reps monitor/modify for their detachment or department.

**Decided:** Anyone may build ads today (members); companies later with approval. MVP: authenticated users create ads; approval required before inclusion in a book.

## Admin role grants (decided Nov 14, 2026)

| Granting role | Can grant / revoke |
|---------------|--------------------|
| `siteAdmin` | Any role, including `siteAdmin`, `nationalAdmin`, `departmentAdmin` |
| `nationalAdmin` | `nationalAdmin`, `departmentAdmin`, and all non-admin roles |
| `departmentAdmin` | `departmentAdmin` (own department) and non-admin roles in scope; **not** `nationalAdmin` or `siteAdmin` |

- Billy is the only `siteAdmin` at launch, set by the one-time first-admin bootstrap; he assigns the other admins.
- **Decided (Nov 14, 2026):** revoking follows the same table as granting. `siteAdmin` can revoke any admin level, `nationalAdmin` can revoke `nationalAdmin` and `departmentAdmin`, and `departmentAdmin` can revoke `departmentAdmin` only, so no one can revoke or demote a role above their own. Every grant and revoke is written to `audits`.
- **Inferred (confirm):** nobody, `siteAdmin` included, can change their own roles or status (prevents accidental self-lockout).
- `siteAdmin` has every power of `nationalAdmin`; wherever this repo says "department or national admin" (ad lock reset, admin self-approval, undo review), `siteAdmin` is included.
- Enforced in Firestore rules with emulator tests, not only in the UI.

## Permission matrix

Legend: **C** create, **R** read, **U** update, **D** delete, **—** none, **own** = only own records, **scope** = within role scope.

### Portal & admin

| Action | guest | member | company* | det VAVS | dept VAVS | ad approver | dept admin | national admin |
|--------|-------|--------|----------|----------|-----------|-------------|------------|----------------|
| View landing | R | R | R | R | R | R | R | R |
| Sign in | C | — | — | — | — | — | — | — |
| Edit own user profile | — | U | U | U | U | U | U | U |
| Assign roles | — | — | — | — | — | — | CUD scope (see grant table) | CUD (see grant table) |
| Manage detachments | R (active only) | R | R | R | R | R | CRUD | CRUD |
| Manage ad sizes | — | R | R | — | — | RU | CRUD | CRUD |
| Toggle registration mode | — | — | — | — | — | — | U | U |
| Approve pending users | — | — | — | — | — | — | U | U |

\*companyAdvertiser = post-MVP; treat as member-like for ads until then.

`siteAdmin` has every permission in the national admin column. The detachment directory is publicly readable, including by signed-out visitors, but only `active` entries (decided Nov 14, 2026).

### VAVS

| Action | guest | member | det VAVS | dept VAVS | ad approver | dept admin | national admin |
|--------|-------|--------|----------|-----------|-------------|------------|----------------|
| Create own entry | — | C | C | C | — | C | C |
| Read own entries | — | R | R | R | — | R | R |
| Update/delete own entries | — | UD | UD | UD | — | UD | UD |
| Read detachment entries | — | — | R scope | R dept | — | R dept | R |
| Update/delete others’ entries | — | — | UD scope | UD dept | — | UD dept | UD |
| Export CSV / print report | — | own only (**inferred**) | scope | dept | — | dept | all |
| Read audit logs | — | — | R scope | R dept | — | R dept | R |

**Pushback:** All rep/admin edits of others’ entries **MUST** write audit logs (Phase 1 AC).

### Ad Book

| Action | guest | member | company* | ad approver | dept admin | national admin |
|--------|-------|--------|----------|-------------|------------|----------------|
| Create draft ad | — | C | C | C | C | C |
| Edit own draft / rejected | — | U own | U own | U | U | U |
| Submit ad | — | U own | U own | U | U | U |
| Approve / reject | — | — | — | U | U | U |
| Place approved ad in book | — | — | — | CU | CU | CU |
| Create / lock book | — | — | — | CU | CU | CU |
| Print book | — | R if shared | R | R | R | R |
| Payment | — | — | — | — | — | — | *(out of MVP)* |

### Deferred: Ribbon Rack

Ribbon profiles, PIN save/load, shopping list, and ribbon admin are **not** portal permissions. They remain in [RibbonRackBuilder](https://github.com/bhartman21/RibbonRackBuilder). See `features/RIBBON_RACK.md` (deferred).

## Assignment workflow (Phase 0)

1. User signs in → `users/{uid}` upserted.
2. Default role: **`member`**, auto-granted on first sign-in (decided Nov 9, 2026).
   - **Registration mode** (lock-down mechanism): Firestore doc `settings/registration` with `mode: 'open' | 'approval'` (default `'open'`), editable only by `departmentAdmin`/`nationalAdmin`.
   - `open`: new users get `status: 'active'`, role `member`.
   - `approval`: new users get `status: 'pending'`, no write access; admins approve/reject via pending queue.
   - Every user doc carries `status: 'active' | 'pending' | 'suspended'`; security rules require `status == 'active'` for writes.
   - Switching mode affects only new sign-ins; existing active users are untouched.
3. Department admin assigns `detachmentVavsRep` + `detachmentId`, or `departmentVavsRep`, or `adBookApprover`.
4. Guards read claims or `roleAssignments` query.

## Guard checklist for implementers

- `authGuard` — must be signed in.
- `activeUserGuard` — `status == 'active'`.
- `roleGuard([...])` — any of listed roles.
- `detachmentScopeGuard` — resource `detachmentId` ∈ user’s scopes.
- `adOwnerOrApproverGuard` — owner OR adBookApprover OR admin.

## Open role questions

See `OPEN_QUESTIONS.md`: whether guests can draft ads without Auth; national role timing; Auth providers.
