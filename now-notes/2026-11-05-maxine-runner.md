Status: the Maxine pod runner (scripts/velib/maxine_pod.py) now gets past RunPod: it names its client (Cloudflare refused Python's default agent, error 1010), waits for the pod's own server rather than the proxy's boot page, and moves the take in 32 MB pieces under Cloudflare's 100 MB cap. Two trial runs so far cost $0.0032 in all; run 42072590168 is the third, within the $1.00 cap.
Changed: a refused or failed Maxine pod now names RunPod's own error in its receipt, and costs nothing when no pod was made.
Next: read run 42072590168's receipt; on success run ve eyeline --backend maxine --maxine-copy, measure the iris shift, and get a blind review of the strips.
North Star check (2026-11-05): holds.
