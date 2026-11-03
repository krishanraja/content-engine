#!/usr/bin/env python3
"""Summarise a make-piece run's Claude Code session record for the GitHub run page.

Reads the execution file claude-code-action writes (a JSON list of stream messages) and prints Markdown: how the
session ended, its turns and cost, every tool call it was refused (with the tool and the first part of its
input), and its last words. The chat itself is never printed in the log, so without this a run that stops early
looks the same as one that worked (two Wednesday runs, 3 Nov 2026).

  python3 scripts/make_run_report.py <execution_file>
  python3 scripts/make_run_report.py --self-test
"""
import json
import sys


def load(path):
    with open(path, encoding='utf-8') as f:
        text = f.read().strip()
    if not text:
        return []
    try:
        data = json.loads(text)
        return data if isinstance(data, list) else [data]
    except json.JSONDecodeError:
        return [json.loads(line) for line in text.splitlines() if line.strip().startswith('{')]


def short(value, n=300):
    s = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    s = ' '.join(s.split())
    return s if len(s) <= n else s[:n] + '...'


def report(messages):
    result = next((m for m in reversed(messages) if m.get('type') == 'result'), {})
    last_text = ''
    for m in messages:
        if m.get('type') == 'assistant':
            for block in (m.get('message') or {}).get('content') or []:
                if block.get('type') == 'text' and block.get('text', '').strip():
                    last_text = block['text']
    denials = result.get('permission_denials') or []
    out = ['## Make run: what the session did', '']
    out.append(f"- Ended: {result.get('subtype', 'unknown')}{' (error)' if result.get('is_error') else ''}")
    out.append(f"- Turns: {result.get('num_turns', '?')}; list-price cost: ${result.get('total_cost_usd', 0):.2f}")
    out.append(f"- Tool calls refused: {len(denials)}")
    for d in denials:
        out.append(f"  - `{d.get('tool_name', '?')}`: {short(d.get('tool_input', {}))}")
    out += ['', '### Its last words', '', short(result.get('result') or last_text or '(none)', 3000)]
    return '\n'.join(out) + '\n'


def self_test():
    msgs = [
        {'type': 'assistant', 'message': {'content': [{'type': 'text', 'text': 'I need the Drive file.'}]}},
        {'type': 'result', 'subtype': 'success', 'is_error': False, 'num_turns': 3, 'total_cost_usd': 0.5,
         'permission_denials': [{'tool_name': 'Bash', 'tool_input': {'command': 'curl https://drive.google.com/x'}}],
         'result': 'Stopped: no Drive access.'},
    ]
    r = report(msgs)
    assert 'Tool calls refused: 1' in r and '`Bash`' in r and 'drive.google.com' in r and 'Stopped: no Drive access.' in r, r
    assert 'Turns: 3' in report(msgs) and report([]).startswith('## Make run')
    lines = '\n'.join(json.dumps(m) for m in msgs)
    import tempfile, os
    with tempfile.NamedTemporaryFile('w', delete=False, suffix='.json') as f:
        f.write(lines)
    try:
        assert 'Tool calls refused: 1' in report(load(f.name))
    finally:
        os.unlink(f.name)
    print('make_run_report: self-test passed')


if __name__ == '__main__':
    if sys.argv[1:] == ['--self-test']:
        self_test()
    elif len(sys.argv) == 2:
        try:
            sys.stdout.write(report(load(sys.argv[1])))
        except (OSError, ValueError) as e:
            print(f'## Make run\n\nThe session record could not be read: {e}')
    else:
        sys.exit(__doc__)
