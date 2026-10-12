#!/usr/bin/env python3
"""transcriber: whether faster-whisper works on this machine, and how to fix
it when it does not. make.py --doctor and recording_match.py
--check-transcriber (the recordings upload's -Check) both ask here.

An import proves nothing. On 2026-10-12 an unpinned `pip install
faster-whisper` gave faster-whisper 1.2.1 with av 19.0.1: they import, then
fail on every take ("open() got an unexpected keyword argument
'metadata_errors'"). requirements.lock.txt pins faster-whisper 1.2.0 with av
18.1.0, which work. So the check decodes a second of sound with
faster-whisper's own decoder (decode_audio, PyAV underneath), as it does
before every transcription.

    python transcriber.py          exit 0 when it decodes, 1 (and the fix) when not
"""
import sys
import tempfile
import wave
from pathlib import Path

FIX = ('install the pinned set: python -m pip install --require-hashes -r requirements.lock.txt '
       '(on a home computer, npm run bootstrap:python builds the pinned runtime), never an unpinned pip install faster-whisper')


def decodes():
    """(ok, detail): whether faster_whisper decodes a one second tone here."""
    try:
        import faster_whisper
    except Exception as e:  # noqa: BLE001 any import failure is the answer
        return False, f'not importable ({type(e).__name__}): {FIX}'
    with tempfile.TemporaryDirectory() as tmp:
        tone = Path(tmp) / 'one-second.wav'
        with wave.open(str(tone), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(16000)
            w.writeframes(b''.join(int(8000 * ((n // 20) % 2 * 2 - 1)).to_bytes(2, 'little', signed=True) for n in range(16000)))
        try:
            audio = faster_whisper.decode_audio(str(tone))
        except Exception as e:  # noqa: BLE001 any decoding failure is the answer
            return False, f'it imports but cannot decode sound ({type(e).__name__}: {str(e)[:160]}): {FIX}'
    if not 15000 <= len(audio) <= 17000:
        return False, f'it decoded a one second tone as {len(audio)} samples, not 16000: {FIX}'
    return True, 'decodes a one second tone (faster_whisper.decode_audio)'


if __name__ == '__main__':
    ok, detail = decodes()
    print(('ok    ' if ok else 'FAIL  ') + f'faster_whisper: {detail}')
    sys.exit(0 if ok else 1)
