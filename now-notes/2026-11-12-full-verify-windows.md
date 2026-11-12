Status: Full verify was red on main on windows-latest from 11 Nov: the board-desk test that checks a live board press hashes each off-day option the way week_board.py does read ideas.json with a bare open() in its Python helper, which is cp1252 on Windows, so the proactiveai option's "›" and "📲" hashed as other words. The helper now reads UTF-8 as week_board.py does, and the test asserts the file still carries a non-ASCII option so a wrong reader is caught. week_board.py and the live board were never wrong. The board-web red on 11 Nov was fixed by PR #564.
Next: Confirm the next Full verify run on main is green on Linux and Windows and that it closes the "Full verify is red on main" issue.
Changed: tests/control-plane/board-desk.test.ts.
North Star check (2026-11-12): holds.
