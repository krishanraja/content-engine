Status: ve dispatch runs Codex cards under the Studio's own Codex home (runtime\codex-home, built by scripts/overnight/codex_home.py): no MCP server, no plugin, sign-in and sessions shared with ~/.codex. Krish keeps buffer and teleprompter in his everyday Codex. LORIMER (standby) has it built and passes preflight 9/9.
Next: on SURFACE, run `python scripts/overnight/codex_home.py build`, then the preflight, so its card runs also drop ~/.codex's plugins.
North Star check (2026-10-30): holds.
Changed: Codex cards no longer inherit the everyday Codex's MCP servers and plugins (on LORIMER 38 plugins, GitHub, Supabase, Stripe, Vercel and Gmail among them); Krish, 30 Oct, "do the separate settings folder fix".
