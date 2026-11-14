Status: scripts/taste_backstop.py posts each flagged, scrubbed line to Control Center's backstop route when TASTE_BACKSTOP_TOKEN is set or in a cloud session (whose proxy injects the key), and keeps the local file only as fallback; tests/taste_backstop_test.py covers posting, refusal, failure and no key.
Next: the backstop network secret for Control Center's host is saved on the cloud environment, then one cloud session's end shows its lines arriving in the taste ledger.
North Star check (2026-11-14): holds.
