# Roles: who can do what

For: Department Admins, National Admins, and Site Administrators.

Each person in the portal has one or more roles. Roles decide which pages and buttons a person sees.

## The roles

These are the role names shown in **Users & Roles**.

| Role | What it lets the person do today |
|------|----------------------------------|
| **MCL Member** | Sign in. Make, save, submit, withdraw, and delete (drafts only) their own ads in Ad Book Studio. See **Open** program books. Open the VAVS Tracker page (a placeholder for now). |
| **Ad Book Approver** | Everything a member can do. Also: the **Approval Queue** (approve and reject other people's ads), **Ad Sizes**, **New Event Book**, the **Book Controls** on each program book, and seeing books that are not open. |
| **Detachment VAVS Rep** | Same as a member today. You must pick one detachment for this role. The VAVS rep tools are **planned — not available yet**. |
| **Department VAVS Rep** | Same as a member today. The VAVS rep tools are **planned — not available yet**. |
| **Department Admin** | Everything an Ad Book Approver can do. Also: approve their own ad with a reason, **Undo Review**, **Reset Lock**, and the **Admin** menu (**Users & Roles**, **Detachments**, **Activity**, **Registration Settings**). |
| **National Admin** | Same as Department Admin today. |
| **Site Administrator** | Same as National Admin. It is the top role, for the site owner. |

A person can have more than one role. For example, **MCL Member** and **Ad Book Approver**.

The portal shows your highest role in your account menu (the round button with your initials at the top right).

## Who can give which roles

| If you are a… | You can give or take away… |
|---------------|----------------------------|
| **Site Administrator** | Every role, including **Site Administrator**, **National Admin**, and **Department Admin** |
| **National Admin** | **National Admin**, **Department Admin**, and all non-admin roles |
| **Department Admin** | **Department Admin** and all non-admin roles |

The **Edit Roles** box only shows the roles you are allowed to give.

Also:

- **Nobody can change their own roles or status.** On your own row you will see "You (another admin must change your roles)".
- **You can't manage someone above you.** If a person has a role you couldn't give, their row says "Higher admin level". You can't edit, suspend, or activate them.

## Give someone a role

1. Press **Admin** at the top of the page. On a phone or narrow screen, press the menu button (☰) at the top right first. The Admin links are listed under **Admin**.
2. Press **Users & Roles**.
3. Find the person under **Directory & Roles**.
4. Press **Edit Roles** on their row.
5. The **Edit Roles** box opens below the list.
6. Under **Assigned Roles**, check each role the person should have. Uncheck any they should not have.
7. If you checked **Detachment VAVS Rep**, pick their detachment in **Detachment VAVS Rep Scope**.
8. Press **Save Role Assignment**.

To close without saving, press **Cancel**.

**Good to know:**

- If you uncheck every role, the person is saved as **MCL Member**.
- A Detachment VAVS Rep can only be given **one** detachment on this screen.
- Once the portal is live, every role change is recorded: who made it, when, and the roles before and after. No page shows these records yet.
- If a change is not allowed, a red message explains why.

## Suspend or turn someone back on

On the **Directory & Roles** list:

- Press **Suspend** to stop an active person from using the portal. They will see **Account Suspended** when they sign in.
- Press **Activate** to let a suspended or pending person back in.

There is no "Are you sure?" question. The change happens right away.

## The first Site Administrator

The very first Site Administrator is set up by hand, one time, by the site owner. See the [Firebase setup checklist](./firebase-setup.md), Part 12 ("Make yourself the first site admin").

## Planned — not available yet

These parts of `ROLES_AND_PERMISSIONS.md` are not built yet:

- The **Company Advertiser** role (for outside businesses).
- VAVS rep powers: viewing and correcting other members' hours, reports, and history.
- Limiting a Department Admin to their own department (today there is only one department).
