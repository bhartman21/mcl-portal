# Notifications and audit log

For: Department Admins, National Admins, and Site Administrators.

> **Please note:** notifications and the Ad Book audit log are saved only in the web browser on the computer where the action happened, like all Ad Book data. Shared saving is **planned — not available yet**.

## Open the page

Use either:

- The bell icon (**Notifications**) at the top of the page. A red number shows how many notifications are new.
- **Admin → Notifications & Audit Log**.

The **Notifications & Audit Log** page opens.

## Notifications

When an admin approves their own ad, every **other** admin gets a notification. It says who approved which ad, and their reason.

- New notifications are in bold.
- Press **Mark read** on one notification, or **Mark all read** for all of them.
- If there are none, you will see "No notifications."

## Ad Book Audit Log

This table lists Ad Book actions that must be recorded. Each row shows **When**, **Who**, **Action**, **Ad**, **Status** (before → after), and **Reason**.

The actions are:

| Action shown | What happened |
|--------------|---------------|
| **Self-approved own ad** | An admin approved their own ad, with a reason. |
| **Undid review** | An admin undid an approval or rejection, with a reason. |
| **Reset submission lock** | An admin reset a locked ad. The reason is optional. |

If nothing has been recorded yet, you will see "No audited actions yet."

The log can't be edited or deleted.

## Not shown here

- Role changes are also recorded (who changed whose roles, and before and after) once the portal is live. They are not shown on this page. *(From the code: role-change records are kept in the database, but no screen lists them yet.)*
- Ordinary approvals and rejections by someone other than the ad's owner are not in this log.
