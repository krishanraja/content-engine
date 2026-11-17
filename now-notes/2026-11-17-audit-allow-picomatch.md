Status: CI's dependency audit allows GHSA-fc5q-39xc-vjpf (picomatch ReDoS, every version, no fixed release, reached only through vite and vitest) until 2026-11-24, by config/audit-allow.json and scripts/audit_check.mjs; every other high or critical advisory still fails CI. Pull requests merge themselves again.
Next: On or before 2026-11-24, recheck picomatch; if a fixed release is out, run npm audit fix and remove the entry, otherwise move recheck_by a week on.
North Star check (2026-11-17): holds.
