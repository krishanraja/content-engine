# The Teleprompter send

Moved here verbatim from make-piece/SKILL.md on 16 Nov 2026, when the skill core reached its byte cap (scripts/check_skill_core.py).

**The Teleprompter send.** Krish, 2026-10-28: "Once I approve, the two
scripts will go to teleprompter" and "Server sends directly". That replaces
the standing yes of 12 October ("Yes, automatic, Monday now"). Once both
cuts pass "The Scripts step" (steps 1 to 5), they go on the day's tab for
his Approve scripts press, which binds to their exact sha256; the server
then sends them (`sendApprovedScripts` in
`apps/control-plane/api/_teleprompter.ts`) and reads them back. A session
calls the Teleprompter connector only when his press for those exact words
answered `no_key` (the server's key is not set yet), and then on the terms
he set on 12 October ("Also note that Descript is permanently gone,
teleprompter.com is permanently in, connected via MCP here"; "One script per
cut, in a folder per piece (e.g. "Mon 12 Oct follow.the.money"). When the
words change, the same script is updated in place. Nothing is ever
deleted."), with only these Teleprompter tools (`config/teleprompter.json`,
`allowed_tools`): `list_folders`, `list_scripts`, `list_scripts_in_folder`,
`get_folder` and `get_script` to look; `create_folder`, one folder per piece,
only when the record holds none and none of that name is listed;
`create_script`, one script per cut, only when the record holds none and
none of that title is in the folder; and `update_script` of a cut's own
script, sending only its `text` and `duration`. Never `move_script` or
`update_folder`, never his `fontSize`, `speed`, `alignment` or `timedSpeed`
(they are his to set), and nothing is ever deleted: Teleprompter has no
delete tool and none is ever used. Descript was retired the same day: no
session calls it, and nothing is sent there.
