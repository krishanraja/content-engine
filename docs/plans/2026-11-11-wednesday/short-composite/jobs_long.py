# One-off for the Wed 11 long cut (Ruling, Krish, 2026-11-10: one-off composite). Device jobs in TAKE time
# (the long take's own clock); the stage is 1240 x 860, 30 fps.
import json, sys
W, H = 1240, 860
def ev(verb, state, f, obj="song"): return {"id": f"{verb}{f}{len(str(state))}", "obj": obj, "verb": verb, "toState": state if isinstance(state, str) else json.dumps(state), "atFrame": int(f)}
def L(t, t0): return round((t - t0) * 30)
jobs = {}

# Suno slot machine: the press at 77.5, songs at 81.4, press again 88.4, "slot machine that pays out in songs" 90.4
t0 = 77.3
jobs['slotL'] = {"device": "slot_machine", "object": {"obj": "song", "device": "slot_machine", "meaning": "House rebuild of Suno create",
  "params": {"lyrics": "I’m movin’ to the sun", "style": "deep house, female singer, summer vibes", "source": "rebuilt from suno.com, Nov 2026",
             "songs": [{"title": "Movin’ To The Sun (v1)", "length": "3:24"}, {"title": "Movin’ To The Sun (v2)", "length": "3:11"}]},
  "fromFrame": 0, "toFrame": 600},
  "events": [ev("enter", "visible", 0), ev("type", "lyrics", 0), ev("type", "style", 0), ev("pick", "machine", L(77.5, t0)), ev("send", "spin", L(77.9, t0)),
             ev("fill", "songs", L(81.4, t0)), ev("highlight", "1", L(82.4, t0)), ev("bounce", "again", L(88.4, t0)), ev("fill", "songs", L(90.4, t0))],
  "from": L(77.3, t0), "to": L(94.2, t0), "t0": t0}

# How a song is built: 94.1 -> 158.0
t0 = 94.1
lanes = [{"id": "drums", "name": "DRUMS", "kind": "human", "hidden": True}, {"id": "bass", "name": "BASS", "kind": "human", "hidden": True},
         {"id": "chords", "name": "CHORDS", "kind": "human", "hidden": True}, {"id": "voice", "name": "VOICE", "kind": "human", "hidden": True},
         {"id": "guitar", "name": "GUITAR", "kind": "sample", "hidden": True}, {"id": "choir", "name": "CHOIR", "kind": "ai", "hidden": True},
         {"id": "sitar", "name": "SITAR", "kind": "ai", "hidden": True}, {"id": "robot", "name": "ROBOT", "kind": "ai", "hidden": True}]
jobs['build'] = {"device": "arrangement", "object": {"obj": "song", "device": "arrangement", "meaning": "a song is a stack of layers",
  "params": {"lanes": lanes, "fromWave": True, "title": "A song, in layers"}, "fromFrame": 0, "toFrame": 2200},
  "events": [ev("enter", "visible", L(96.7, t0)), ev("add", "drums", L(101.6, t0)), ev("add", "bass", L(102.4, t0)), ev("add", "chords", L(103.4, t0)),
             ev("add", "voice", L(104.6, t0)), ev("move", {"zoom": 1.25, "x": 0.1}, L(107.7, t0)),
             ev("stamp", {"lane": "bass", "tag": "SYNTH"}, L(112.8, t0)), ev("fill", {"lane": "bass", "layers": [{"kind": "synth", "weight": 1}]}, L(112.8, t0)),
             ev("stamp", {"lane": "drums", "tag": "SAMPLE"}, L(117.9, t0)), ev("fill", {"lane": "drums", "layers": [{"kind": "sample", "weight": 1}]}, L(117.9, t0)),
             ev("move", {"zoom": 1, "x": 0.5}, L(122.3, t0)), ev("add", "guitar", L(123.1, t0)), ev("stamp", {"lane": "guitar", "tag": "sample pack"}, L(126.3, t0)),
             ev("type", {"lane": "choir", "text": "add a choir"}, L(142.5, t0)),
             ev("add", "sitar", L(153.8, t0)), ev("add", "robot", L(155.6, t0)), ev("move", "count", L(156.4, t0))],
  "from": 0, "to": L(158.0, t0), "t0": t0}

# Upload flood: 190.6 -> 207.6
t0 = 190.6
jobs['flood'] = {"device": "upload_flood", "object": {"obj": "flood", "device": "upload_flood", "meaning": "Uploads versus discovery",
  "dataset": {"unit": "share", "denominator": None, "producerLabel": "Deezer, Apr and Jul 2026", "rows": [{"label": "50%+", "value": 0.5}, {"label": "1-3% of listens", "value": 0.02}]},
  "params": {"tiles": 300, "query": "what is this song", "answer": {"title": "Movin’ To The Sun", "artist": "Imael Angel"}}, "fromFrame": 0, "toFrame": 600},
  "events": [ev("enter", "enter", L(190.8, t0), "flood"), ev("fill", "fill", L(193.0, t0), "flood"), ev("count_to", "count_to", L(196.4, t0), "flood"),
             ev("draw", "draw", L(198.7, t0), "flood"), ev("type", "type", L(203.6, t0), "flood"), ev("pick", "pick", L(206.0, t0), "flood")],
  "from": 0, "to": L(207.7, t0), "t0": t0}

# HUGEL rebuilds it: 213.9 -> 264.4 (pulled apart, kept a few, rebuilt by hand, Ultra Nate, the thin AI layer, the robot hum)
t0 = 213.9
lanes = [{"id": "drums", "name": "DRUMS", "kind": "ai", "hidden": False}, {"id": "bass", "name": "BASS", "kind": "ai", "hidden": False},
         {"id": "chords", "name": "CHORDS", "kind": "ai", "hidden": False}, {"id": "melody", "name": "MELODY", "kind": "ai", "hidden": False},
         {"id": "voice", "name": "VOICE", "kind": "ai", "hidden": False},
         {"id": "sdrums", "name": "DRUMS", "kind": "sample", "hidden": True}, {"id": "sbass", "name": "SYNTH BASS", "kind": "synth", "hidden": True},
         {"id": "piano", "name": "PIANO", "kind": "human", "hidden": True}, {"id": "strings", "name": "STRINGS", "kind": "human", "hidden": True},
         {"id": "hum", "name": "AI HUM", "kind": "ai", "hidden": True}]
hv = {"lane": "voice", "layers": [{"kind": "human", "weight": 1.0}]}
jobs['rebuild'] = {"device": "arrangement", "object": {"obj": "song", "device": "arrangement", "meaning": "HUGEL's rebuild, layer by layer",
  "params": {"lanes": lanes, "fromWave": True, "title": "Movin’ To The Sun"}, "fromFrame": 0, "toFrame": 1600},
  "events": [ev("enter", "visible", 0),
             ev("mark", {"lane": "voice", "pin": True}, L(215.6, t0)), ev("mark", {"lane": "melody", "pin": True}, L(215.9, t0)),
             ev("mark", "drums", L(216.7, t0)), ev("mark", "bass", L(216.9, t0)), ev("mark", "chords", L(217.1, t0)),
             ev("add", "sdrums", L(220.6, t0)), ev("stamp", {"lane": "sdrums", "tag": "SAMPLE LIBRARY"}, L(221.4, t0)),
             ev("add", "sbass", L(222.6, t0)), ev("add", "piano", L(223.5, t0)), ev("add", "strings", L(224.0, t0)),
             ev("stamp", {"lane": "sdrums", "tag": "NO ONE PLAYED"}, L(227.1, t0)),
             ev("highlight", "voice", L(231.1, t0)), ev("fill", hv, L(231.4, t0)),
             ev("fill", {"lane": "voice", "layers": [{"kind": "human", "weight": 0.85}, {"kind": "ai", "weight": 0.15}]}, L(250.5, t0)),
             ev("add", "hum", L(256.2, t0)), ev("highlight", "all", L(261.3, t0))],
  "from": 0, "to": L(264.5, t0), "t0": t0}

# Who did which bit: 302.2 -> 328.0 (take time; the first try 302.35-311.35 is cut, so the credits run on the second try)
t0 = 311.0
lanes2 = [{"id": "lyrics", "name": "THE IDEA", "kind": "human", "hidden": False}, {"id": "first", "name": "FIRST VERSION", "kind": "ai", "hidden": False},
          {"id": "found", "name": "MADE IT FAMOUS", "kind": "human", "hidden": False}, {"id": "build", "name": "REBUILD", "kind": "human", "hidden": False},
          {"id": "voice", "name": "VOICE", "kind": "human", "hidden": False}, {"id": "hum", "name": "AI HUM", "kind": "ai", "hidden": False}]
who = [("lyrics", "a Reiki healer", 312.0), ("first", "Suno", 313.9), ("found", "strangers on TikTok", 316.5), ("build", "HUGEL", 318.4),
       ("voice", "Ultra Naté", 321.1), ("hum", "the AI singer", 322.4)]
evs = [ev("enter", "visible", 0)] + [ev("chip", {"lane": l, "who": n}, L(at, t0)) for l, n, at in who]
evs.append(ev("highlight", "all", L(324.6, t0)))
evs += [ev("fill", {"lane": l, "layers": [{"kind": "human", "weight": 0.5}, {"kind": "ai", "weight": 0.5}]}, L(325.5, t0)) for l, _, _ in who]
jobs['credits'] = {"device": "arrangement", "object": {"obj": "song", "device": "arrangement", "meaning": "who did which bit",
  "params": {"lanes": lanes2, "fromWave": False, "title": "Movin’ To The Sun"}, "fromFrame": 0, "toFrame": 900},
  "events": evs, "from": 0, "to": L(328.1, t0), "t0": t0}

step = int(sys.argv[1]) if len(sys.argv) > 1 else 1
for k, j in jobs.items():
    j.update(w=W, h=H, aspect="16:9", step=step, out=f"/tmp/claude-0/w11l/{k}" + ("" if step == 1 else "_t"))
    json.dump(j, open(f"/tmp/claude-0/w11l/jobs_{k}.json", "w"))
print({k: (j['from'], j['to']) for k, j in jobs.items()})
