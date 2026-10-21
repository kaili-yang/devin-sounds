# devin-sounds

**别再盯着终端等 Devin 了。** Devin 干完活、需要你批准、或者翻车的时候，它会**开口说话**。

> 老板，这个得你拍板。 —— `dagong` 打工人
> 启禀大人，差事办妥了。 —— `guofeng` 国风·宫廷
> Pardon me. Your approval is required. —— `butler`

A Devin plugin that plays voice lines and chimes on Devin lifecycle events, so you can tab away and still know the
moment Devin finishes, needs your approval, or hits an error. Chinese and English packs are built in, and it plays
any of the **370+ community packs** in the [OpenPeon](https://github.com/PeonPing/openpeon) registry (the
[peon-ping](https://github.com/PeonPing/peon-ping) catalog: Warcraft Peon, GLaDOS, StarCraft, ...).

Zero dependencies, Node ≥ 18, macOS / Linux / Windows. The hook answers in ~40 ms and **never** changes what Devin
does: it prints nothing and always exits 0, even for `PermissionRequest`.

## Install

```bash
devin plugins install kaili-yang/devin-sounds
```

Start a new session — that's it. Then pick a pack:

```bash
npx -y github:kaili-yang/devin-sounds use guofeng   # settings are per user, so any copy of the CLI works
```

The plugin ships a `/devin-sounds:sounds` skill, so the easiest way is to tell Devin what you want
(*"换成打工人语音包"*, *"mute the sounds"*, *"install the GLaDOS pack"*).

<details>
<summary>Without the plugin system / from a checkout</summary>

```bash
git clone https://github.com/kaili-yang/devin-sounds && cd devin-sounds
node bin/cli.js install            # user-wide: adds hooks to ~/.config/devin/config.json (backup kept)
node bin/cli.js install --project  # or only for the current project: .devin/hooks.v1.json
node bin/cli.js uninstall          # removes only devin-sounds' entries
```

`npm link` gives you a `devin-sounds` command. Verify inside a session with `/hooks`.
</details>

## Packs

| Pack | Voice | Lines |
|---|---|---|
| `dagong` 打工人 | zh-CN | 收到收到！· 老板，搞定了！· 老板，这个得你拍板。· 翻车了，老板。· 别催了别催了，在做了！ |
| `guofeng` 国风·宫廷 | zh-CN | 遵命！· 启禀大人，差事办妥了。· 此事，还请大人定夺。· 大人恕罪，出岔子了。· 大人，粮草不济了。 |
| `butler` | en-GB | Right away. · The task is complete. · Pardon me. Your approval is required. · I'm afraid something went wrong. |
| `chime` | — | wordless bell chimes, works everywhere |

The voice packs are spoken by your machine's own text-to-speech (`say` on macOS, `espeak-ng` on Linux) the first
time each line is needed, then cached — so this repo contains no recorded audio. Without a TTS engine they fall back
to the chimes. `devin-sounds use <pack>` pre-renders everything so the first event plays instantly.

Default: `dagong` on a Chinese system locale, `butler` otherwise.

### 370+ more from OpenPeon

```bash
devin-sounds search warcraft    # browse the registry
devin-sounds add peon           # download, verify the manifest checksum, install
devin-sounds use peon
devin-sounds add ./my-pack      # or any local CESP folder (openpeon.json + sounds/)
```

Any [CESP v1.0](https://github.com/PeonPing/openpeon/blob/main/spec/cesp-v1.md) pack works. Community packs are
third-party audio with their own licenses (shown in the registry).

## When it speaks

| Devin hook | CESP category | Example (`dagong`) |
|---|---|---|
| `SessionStart` | `session.start` | 打工人，打工魂，上班了！ |
| `UserPromptSubmit` | `task.acknowledge` | 收到收到！ |
| 3 prompts within 10 s | `user.spam` | 别催了别催了，在做了！ |
| `PermissionRequest` | `input.required` | 老板，这个得你拍板。 |
| `PostToolUse` with a failed tool | `task.error` | 翻车了，老板。 (at most every 20 s) |
| `PostCompaction` | `resource.limit` | 上下文满了，省着点用。 |
| `Stop` | `task.complete` | 老板，搞定了！ |
| `SessionEnd` | `session.end` | 下班了，下班了！ |

Sounds closer than 1.5 s apart are dropped, except approvals and completions, which always play. A pack never repeats
the same line twice in a row.

## Configure

```bash
devin-sounds list                       # packs, * = current
devin-sounds preview guofeng task.complete
devin-sounds test                       # play every category of the current pack
devin-sounds volume 0.4
devin-sounds mute | unmute
devin-sounds notify on                  # also show a desktop notification with the line
devin-sounds category task.acknowledge off
devin-sounds status                     # player, TTS engine, hooks
```

Settings: `~/.config/devin/devin-sounds/config.json`. Generated audio and throttle state: `~/.cache/devin-sounds`.
Env overrides: `DEVIN_SOUNDS_PACK`, `DEVIN_SOUNDS_VOLUME`, `DEVIN_SOUNDS_DISABLE=1`.

Players: `afplay` (macOS), `paplay` / `pw-play` / `ffplay` / `mpg123` / `aplay` (Linux), PowerShell MediaPlayer (Windows).

## Make your own pack

```
my-pack/
  openpeon.json
  sounds/done.mp3
```

```json
{
  "cesp_version": "1.0",
  "name": "my-pack",
  "display_name": "My Pack",
  "categories": {
    "task.complete": { "sounds": [{ "file": "sounds/done.mp3", "label": "Done!" }] }
  }
}
```

Built-in packs also accept `"tts": { "text": "...", "lang": "zh_CN", "voices": ["Tingting"] }` or
`"synth": { "notes": [{ "n": "C5", "ms": 120 }] }` instead of `"file"` — see [`packs/`](packs).

## How it works

```
Devin hook ──stdin JSON──▶ bin/hook.js  (plans: event → category → pack → sound, ~40 ms, exits 0, no stdout)
                               └─detached─▶ bin/runner.js  (renders TTS/chime once into the cache, plays it)
```

## Development

```bash
npm test          # node --test, no dependencies
DEVIN_SOUNDS_HOME=/tmp/ds/config DEVIN_SOUNDS_CACHE=/tmp/ds/cache node bin/cli.js test guofeng
echo '{"hook_event_name":"Stop"}' | DEVIN_SOUNDS_DRY_RUN=1 node bin/hook.js   # prints the plan on stderr
```

## Credits

Event categories and pack format: [OpenPeon / CESP](https://github.com/PeonPing/openpeon), born in
[peon-ping](https://github.com/PeonPing/peon-ping). devin-sounds is an independent CESP player for Devin.

MIT © Kelly Yang
