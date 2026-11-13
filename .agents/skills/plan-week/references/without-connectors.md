# Without the connectors

The Sunday ideas run in GitHub Actions has no Drive and no Firecrawl
connector. Then research with the built-in web search and web fetch instead,
and skip the Cold Ideas & Inspo folder rather than guessing what is in it.
Say which sources were unavailable on the week's board item, in one plain line
at the end of its detail, for example "Researched with web search only: Drive
and Firecrawl were not connected, so the Cold Ideas & Inspo folder was not
read." Write it with `POST /api/workbench {"action": "upsert_items",
"client": "claude_code", "items": [{"id": "week-<Monday>", "detail": "..."}]}`,
keeping the detail already there (read it first with `GET /api/workbench`); if
the item does not exist yet, give it `"lane": "on_you"`, a `"title"`,
`"only_you": "judgment"`, `"link": "https://controlcenter.krishraja.com/#/week"`,
`"link_label": "Open the week"` and `"closes_on": "week_planned"` too, or
the engine refuses it, naming the field it lacks (`WORKBENCH.md`, the
board).
Put the same line in `WORKBENCH.md`, because the slate cron rewrites the week
item's text each morning.

The server sends approved scripts to Teleprompter itself; only a `no_key`
answer needs the Teleprompter connector (step 12). Without it, name each
waiting cut in one line on its day's tab. Descript was retired on 12
October (Krish: "Descript is permanently gone, teleprompter.com is
permanently in, connected via MCP here"): nothing is sent there. The active web board needs the existing engine
operator credential, not an Artifact connector. If authenticated board reads
fail, record that specific blocker; never treat inaccessible feedback as empty.
