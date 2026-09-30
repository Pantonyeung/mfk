# MFK Customer UX — Human Logic Interaction Gate V1

Date: 2026-09-30
Scope: Customer App UI0–UI10
Status: OWNER HARD REQUIREMENT

## Core Rule

UI must be understandable by normal human logic before explanatory copy is added.

A user should be able to look at a control and understand:
- what it is,
- what it does,
- what will happen if it is pressed,
- whether the action is complete or moves to the next step.

Copy must not be used to repair unclear hierarchy, unclear affordance, unclear state, or unclear interaction.

## Required UX Standard

1. Buttons look like buttons.
2. Tappable rows look tappable.
3. Selected / unselected states are visually obvious.
4. Primary action is visually dominant without explanatory paragraphs.
5. A completion action must feel final.
6. A next-step action must visibly lead forward.
7. Back / close / edit / delete / add / quantity / search / filter / reorder / support must use familiar interaction patterns.
8. Navigation labels are literal and short.
9. Status is shown as status, not hidden inside marketing copy.
10. Errors show what failed and the available recovery action, without unnecessary prose.
11. Empty states explain only what is missing and what usable action exists.
12. Repeated instructions are prohibited when the interaction itself already explains the action.

## Copy Rule

Allowed:
- short literal labels
- factual state
- price
- ETA
- order number / pickup code
- required warning
- irreversible-action confirmation
- permission / privacy / payment / recovery information
- concise error reason when known

Avoid:
- decorative guidance
- motivational filler
- repeated explanations
- clever copy that makes function less obvious
- paragraphs explaining where to press
- copy that compensates for bad layout

## Hard Test

For every screen, temporarily remove all non-essential copy.

If a normal user can no longer understand:
- where they are,
- what can be pressed,
- what each control does,
- what is selected,
- what is complete,
- what happens next,

the UI fails and must be redesigned before copy is added back.

## Review Gate

Every Customer page must pass:
SELF_EVIDENT_NAVIGATION
SELF_EVIDENT_ACTION
SELF_EVIDENT_STATE
SELF_EVIDENT_COMPLETION
MINIMUM_NECESSARY_COPY

Failure in any item means the page cannot be marked LOCKED.

## Permanent Principle

Human logic first.
Affordance first.
Hierarchy first.
State first.
Copy last.

UI must not teach the user how to use the UI.
The UI itself must make the intended action obvious.
