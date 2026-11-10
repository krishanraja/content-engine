# One-off for the Wed 11 short: device jobs timed to his words (trimmed timeline, 30 fps).
import json, sys
W, H = 1080, 1240
def ev(obj, verb, state, f): return {"id": f"{verb}{f}", "obj": obj, "verb": verb, "toState": state if isinstance(state, str) else json.dumps(state), "atFrame": int(f)}
def L(t, t0): return round((t - t0) * 30)
jobs = {}
# slot machine 15.9 -> 25.5
t0 = 15.9
jobs['slot'] = {"device": "slot_machine", "object": {"obj": "song", "device": "slot_machine", "meaning": "House rebuild of Suno create",
  "params": {"lyrics": "I’m movin’ to the sun", "style": "deep house, female singer, summer", "source": "rebuilt from suno.com, Nov 2026",
             "songs": [{"title": "Movin’ To The Sun (v1)", "length": "3:24"}, {"title": "Movin’ To The Sun (v2)", "length": "3:11"}]},
  "fromFrame": 0, "toFrame": 400},
  "events": [ev("song", "enter", "visible", 2), ev("song", "type", "lyrics", L(19.9, t0)), ev("song", "type", "style", L(21.6, t0)),
             ev("song", "pick", "machine", L(22.8, t0)), ev("song", "send", "spin", L(23.1, t0)), ev("song", "fill", "songs", L(24.4, t0)),
             ev("song", "highlight", "1", L(24.9, t0))],
  "from": 0, "to": L(25.6, t0)}
# arrangement 37.1 -> 58.4 : pulled apart, rebuilt by hand, Ultra Nate, thin AI layer, robot hum
t0 = 37.1
lanes = [{"id": "drums", "name": "DRUMS", "kind": "ai", "hidden": False}, {"id": "bass", "name": "BASS", "kind": "ai", "hidden": False},
         {"id": "chords", "name": "CHORDS", "kind": "ai", "hidden": False}, {"id": "voice", "name": "VOICE", "kind": "ai", "hidden": False},
         {"id": "piano", "name": "PIANO", "kind": "human", "hidden": True}, {"id": "strings", "name": "STRINGS", "kind": "human", "hidden": True},
         {"id": "robot", "name": "AI HUM", "kind": "ai", "hidden": True}]
hum = lambda lane: {"lane": lane, "layers": [{"kind": "human", "weight": 1.0}]}
jobs['arr1'] = {"device": "arrangement", "object": {"obj": "song", "device": "arrangement", "meaning": "the song, layer by layer",
  "params": {"lanes": lanes, "fromWave": True, "title": "Movin’ To The Sun"}, "fromFrame": 0, "toFrame": 800},
  "events": [ev("song", "enter", "visible", 2),
             ev("song", "fill", hum("drums"), L(38.4, t0)), ev("song", "fill", hum("bass"), L(38.9, t0)),
             ev("song", "fill", hum("chords"), L(39.3, t0)), ev("song", "add", "piano", L(39.8, t0)), ev("song", "add", "strings", L(40.4, t0)),
             ev("song", "stamp", {"lane": "chords", "tag": "BY HAND"}, L(40.3, t0)), ev("song", "stamp", {"lane": "piano", "tag": "BY HAND"}, L(40.6, t0)),
             ev("song", "highlight", "voice", L(42.6, t0)), ev("song", "fill", hum("voice"), L(42.6, t0)),
             ev("song", "fill", {"lane": "voice", "layers": [{"kind": "human", "weight": 0.85}, {"kind": "ai", "weight": 0.15}]}, L(51.1, t0)),
             ev("song", "add", "robot", L(56.3, t0)), ev("song", "highlight", "robot", L(56.6, t0))],
  "from": 0, "to": L(58.4, t0)}
# credits 74.4 -> 84.5
t0 = 74.4
lanes2 = [{"id": "lyrics", "name": "LYRICS", "kind": "human", "hidden": False}, {"id": "first", "name": "FIRST VERSION", "kind": "ai", "hidden": False},
          {"id": "found", "name": "FOUND IT", "kind": "human", "hidden": False}, {"id": "build", "name": "REBUILD", "kind": "human", "hidden": False},
          {"id": "voice", "name": "VOICE", "kind": "human", "hidden": False}, {"id": "hum", "name": "AI HUM", "kind": "ai", "hidden": False}]
who = [("lyrics", "a Reiki healer"), ("first", "Suno"), ("found", "strangers on TikTok"), ("build", "HUGEL"), ("voice", "Ultra Naté"), ("hum", "the AI singer")]
evs = [ev("song", "enter", "visible", 2)]
for k, (lane, name) in enumerate(who):
    evs.append(ev("song", "chip", {"lane": lane, "who": name}, L(77.6, t0) + k * 9))
evs.append(ev("song", "highlight", "all", L(80.0, t0)))
for lane, _ in who:
    evs.append(ev("song", "fill", {"lane": lane, "layers": [{"kind": "human", "weight": 0.5}, {"kind": "ai", "weight": 0.5}]}, L(82.4, t0)))
jobs['arr2'] = {"device": "arrangement", "object": {"obj": "song", "device": "arrangement", "meaning": "who did which bit",
  "params": {"lanes": lanes2, "fromWave": False, "title": "Movin’ To The Sun"}, "fromFrame": 0, "toFrame": 400},
  "events": evs, "from": 0, "to": L(84.6, t0)}
step = int(sys.argv[1]) if len(sys.argv) > 1 else 1
for k, j in jobs.items():
    j.update(w=W, h=H, aspect="9:16", step=step, out=f"/tmp/claude-0/w11s/{k}" + ("" if step == 1 else "_t"))
    json.dump(j, open(f"/tmp/claude-0/w11s/jobs/{k}.json", "w"))
print({k: (j['from'], j['to']) for k, j in jobs.items()})
