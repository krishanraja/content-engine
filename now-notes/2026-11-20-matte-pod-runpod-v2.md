Status: The GPU matte runner now speaks Runpod's REST API v2 (api.runpod.io/v2): v1 (rest.runpod.io) was retired on 15 Nov and no longer resolves, so the first matte-trial run died before making a pod, at no cost. It reads the live GPU catalog and tries each affordable card in stock, cheapest first. scripts/velib/maxine_pod.py still calls v1 and is broken the same way.
Next: Dispatch matte-trial.yml once more (the one approved retry) and compare the GPU mattes with the CPU matte on the AI music take.
North Star check (2026-11-20): holds.
