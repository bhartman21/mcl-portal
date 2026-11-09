# Feature Spec — Ribbon Rack Builder

> **Deferred / out of scope for `mcl-portal`.**  
> Kept as a reference for **future work in the RibbonRackBuilder repo**, not as a portal delivery phase.  
> Decision (Nov 9, 2026): keep RibbonRackBuilder as its own standalone site; focus `mcl-portal` on **VAVS + Ad Book** MVPs first.

**Product links (current):**

- Repo: https://github.com/bhartman21/RibbonRackBuilder  
- Live: https://bhartman21.github.io/RibbonRackBuilder/  
- Firebase: project `mcl-rack-builder` / collection `ribbon-profiles` (stay isolated from portal)

**Portal relationship:** optional external nav link only. No port, no shared Firestore, no Bootstrap conversion of the ribbon app inside `mcl-portal`.

---

## If revisited later (in RibbonRackBuilder repo)

The following was previously drafted for a portal integration. Treat as backlog **for that repo**:

### Possible enhancements

1. **Shopping list** for Ship’s Store (printable / emailable). Ship’s Store does not accept orders from other sites — list only, no cart API.
2. **Bootstrap conversion** of chrome (forms, header) **without** changing ribbon PNGs or rack layout; preserve legacy CSS (`ribbon-legacy.css` + git tag) for easy revert.
3. **Security backlog:** hash PINs, tighten Firestore rules, optionally bind profiles to Auth `uid`.
4. Optional later deep-link or SSO with the portal — only with an explicit decision; default remains separate Firebase projects.

### Preserve today

- Ribbon images, rack layout, star calculation, PIN save/load behavior.
- Live GH Pages URL until *that* project chooses otherwise.

### Not owned by mcl-portal implementers

Do not open PRs against RibbonRackBuilder as part of portal Phase 0–3 unless Billy reopens integration scope.

See also PROJECTPLAN.md → “Future / optional: RibbonRackBuilder”.
