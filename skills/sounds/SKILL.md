---
name: sounds
description: Change Devin's notification sounds — switch voice pack (国风/打工人/butler/chime or any OpenPeon pack), preview, volume, mute, per-event on/off, desktop notifications
---

Translate the user's request into `devin-sounds` commands and run them. Report the output briefly.

```bash
node "$DEVIN_PLUGIN_ROOT/bin/cli.js" list                      # packs, * = current
node "$DEVIN_PLUGIN_ROOT/bin/cli.js" use guofeng               # 国风·宫廷 | dagong 打工人 | butler | chime
node "$DEVIN_PLUGIN_ROOT/bin/cli.js" preview dagong input.required
node "$DEVIN_PLUGIN_ROOT/bin/cli.js" test                      # play every event of the current pack
node "$DEVIN_PLUGIN_ROOT/bin/cli.js" search warcraft           # OpenPeon registry, 370+ packs
node "$DEVIN_PLUGIN_ROOT/bin/cli.js" add peon                  # install from the registry
node "$DEVIN_PLUGIN_ROOT/bin/cli.js" volume 0.4
node "$DEVIN_PLUGIN_ROOT/bin/cli.js" mute                      # / unmute
node "$DEVIN_PLUGIN_ROOT/bin/cli.js" notify on                 # also show a desktop notification
node "$DEVIN_PLUGIN_ROOT/bin/cli.js" category task.acknowledge off
node "$DEVIN_PLUGIN_ROOT/bin/cli.js" status
```

Events (CESP categories): `session.start`, `task.acknowledge` (prompt received), `task.complete` (turn finished),
`input.required` (approval needed), `task.error` (a tool failed), `resource.limit` (context compacted),
`user.spam` (3 prompts in 10 s), `session.end`.

Packs from the registry are third-party audio: only install one the user asked for by name.
