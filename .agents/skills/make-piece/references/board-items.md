# Board items about this piece

Every board item you write about this piece carries `"idea_id": "<uuid>"`
and, when one step finishes it, `"closes_on": "<step>"` (WORKBENCH.md, "The
board"). Control Center's done-check sweep closes it when that step lands,
and closes every item about the piece once its publish step is done (the
standing five ticked), so nothing about a finished piece lingers on Krish's
board. An item waiting on
him (`"lane": "on_you"`, such as recording both cuts) also carries
`"only_you"` (`"face"` for a recording) and an `https://` `"link"` to what he
acts on; without all of them, and the `idea_id` and `"closes_on"` above, the
engine refuses it and names the field it lacks. A job of his that no step
closes goes `"in_progress"` with `"closes_on": "session"`, its detail
saying what would show it done, and you ask him in your reply. Every new
open item says how it ends (the engine refuses one that does not,
`open_needs_closes_on`). Record the fact; the check closes the item. Close
only items you hold (`closes_on` `session`): the engine refuses any other
close from a session (`409 check_closes_it`) and any reopen of a check's
close (`409 check_closed_it`), unless you relay Krish's own words in
`"said"`. It never lets a session turn a check's item into `session` work
(`409 kind_is_the_checks`); a close he made is relayed as the close.
