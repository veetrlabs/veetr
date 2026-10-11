# Git workflow

- Commit and push completed work consistently, in focused commits that describe one coherent change.
- Before committing, review the diff and run checks appropriate to the change. Push only work that is ready; keep unfinished experiments, drafts, private data, credentials, and generated artifacts local.
- Stage explicit paths or hunks. Do not sweep unrelated pending work into a commit.
- Fetch and reconcile upstream changes before pushing. Preserve local work and existing history; do not force-push unless explicitly authorized.
- Respect the repository's release workflow. Pushing source is not authorization to publish a new store or firmware release.

# User interface guidelines

- In Czech copy, keep the brand name Veetr undeclined. Rephrase naturally using words such as „aplikace Veetr“, „projekt Veetr“, or „zařízení Veetr Vane“ instead of forms such as „Veetrem“ or „Veetru“.
- When a setting offers multiple mutually exclusive choices, use a labeled select box or platform-native picker, not a list of action buttons. Show the current selection while collapsed and clearly mark the selected option when opened.
- Reserve buttons for actions such as Save, Start, Stop, or Test. Selecting a value must not look like running an action; keep any preview or test action separate from the selector.
- Make actions visibly recognizable as buttons, with a filled or outlined shape, a comfortable tap target, and pressed/disabled feedback. Do not present actions such as Sign out or Request account deletion as plain text. Keep navigation links and the shared Back control visually distinct from action buttons.
- Keep routine settings simple: save valid changes automatically when an input loses focus or a selection changes. Do not add Save buttons or confirmation dialogs for ordinary reversible edits. Show validation or save failures beside the affected field; use explicit confirmation only when the action genuinely needs it.
- Use plain, brief user-facing guidance. Avoid framework names, implementation details, and long warning paragraphs. Detect device compatibility where possible and show version requirements or update instructions only to users who need them.
