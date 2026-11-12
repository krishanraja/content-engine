Status: A closeout note's North Star line is written with no dash in front (AGENTS.md, "Commit and closeout", now shows it in a code block), and `npm run check:now-notes`, part of verify and so of CI, runs the fold's own code over every note before a merge, so a note that passes CI always folds. The three notes stuck on main since 11 and 12 Nov fold with this merge.
Next: The fold step of every auto-merge run passes again; a note that would not fold turns its pull request red instead of sitting on main.
North Star check (2026-11-12): holds.
