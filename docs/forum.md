# Forum

`/forum` requires the existing active-member session. All writes use Firebase Auth
and Firestore rules. Topics start empty; browser demo content is never migrated.

Public collections:

- `forumTopics/{topic}`
- `forumTopics/{topic}/replies/{reply}`
- `forumTopics/{topic}/replies/{reply}/comments/{comment}`

Public documents contain the selected signature and content, not a UID, email or
private profile. Each document has a matching identity at the same path under
`forumAuthors`. The identity contains the authenticated UID, email, authorized
profile display name and server timestamp. A batch creates both documents; rules
require this pairing and prevent forged attribution. Only admins may read identity
documents. Profile signatures must match `authorizedUsers.displayName`.

Only these three levels are writable. No comment replies, arbitrary extra fields,
identity edits or ordinary-user moderation are allowed. Live listeners use single
field `state == active` queries; no composite indexes are required. Response and
comment counts come from the visible replies and comments.

Moderation changes `state` to `deleted` with a server timestamp. Removing a topic
or reply denies member access to the entire subtree and denies new descendants,
including a descendant written in the same batch that removes the parent.
Moderated content and identities remain accessible to admins for audit; this is
not physical deletion. The normal UI omits moderated records.

Permission tests execute the real repository on `demo-nemrod40`, including identity
privacy, inactive/unknown/anonymous access, impersonation, orphan writes, input
bounds, immutable content, two-level nesting and moderation races. Pages runs these
checks before deployment. Existing device and Storage rules are unchanged.
