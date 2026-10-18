"""G7, quiet scripts (docs/COST_GUARDS.md): a script that fails prints one line saying what failed, and the full
traceback goes to .cache/logs/<name>.log. Every line a script prints lands in the session's context and is re-read
on every later step (docs/COST_AUDIT_2026-10-18.md). Set QUIET_ERRORS=0 to see the traceback in place."""
import os
import sys
import time
import traceback
from pathlib import Path

LOGS = Path(__file__).resolve().parents[1] / '.cache' / 'logs'


def run(main, name):
    """Call main() and return its exit code; an unexpected error becomes one line and a log file."""
    if os.environ.get('QUIET_ERRORS') == '0':
        return main()
    try:
        return main()
    except (SystemExit, KeyboardInterrupt):
        raise
    except Exception as error:  # noqa: BLE001  the whole point: nothing escapes as a traceback
        LOGS.mkdir(parents=True, exist_ok=True)
        log = LOGS / f'{name}.log'
        with log.open('a', encoding='utf-8') as f:
            f.write(f'--- {time.strftime("%Y-%m-%d %H:%M:%S")} {" ".join(sys.argv)}\n{traceback.format_exc()}\n')
        first = (str(error).strip().splitlines() or [''])[0][:200]
        sys.stderr.write(f'{name}: {type(error).__name__}: {first} (traceback in {log})\n')
        return 1
