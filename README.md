# devin-sounds

**Stop babysitting the terminal.** When Devin finishes, needs your approval, or breaks something, it **speaks up**.

> Boss, I need your sign-off on this one. — `intern`
> Your Majesty, the deed is done. — `royal`
> Pardon me. Your approval is required. — `butler`

### Listen

**[▶ Play all samples in your browser](https://kaili-yang.github.io/devin-sounds/)** (GitHub does not play audio
inside a README, so the samples live on the project page). Or click a line below to play it:

| When | `butler` (default) | `royal` | `intern` | `chime` |
|---|---|---|---|---|
| Session starts | [At your service.](https://kaili-yang.github.io/devin-sounds/samples/butler-session-start.mp3) | [Your humble servant awaits.](https://kaili-yang.github.io/devin-sounds/samples/royal-session-start.mp3) | [Morning, boss! Coffee's on, let's ship.](https://kaili-yang.github.io/devin-sounds/samples/intern-session-start.mp3) | [ready](https://kaili-yang.github.io/devin-sounds/samples/chime-session-start.mp3) |
| You send a prompt | [Right away.](https://kaili-yang.github.io/devin-sounds/samples/butler-task-acknowledge.mp3) | [As you command.](https://kaili-yang.github.io/devin-sounds/samples/royal-task-acknowledge.mp3) | [On it, boss!](https://kaili-yang.github.io/devin-sounds/samples/intern-task-acknowledge.mp3) | [ok](https://kaili-yang.github.io/devin-sounds/samples/chime-task-acknowledge.mp3) |
| Devin needs your approval | [Your approval is required.](https://kaili-yang.github.io/devin-sounds/samples/butler-input-required.mp3) | [This matter awaits your royal decree.](https://kaili-yang.github.io/devin-sounds/samples/royal-input-required.mp3) | [Boss, I need your sign-off on this one.](https://kaili-yang.github.io/devin-sounds/samples/intern-input-required.mp3) | [ding-ding](https://kaili-yang.github.io/devin-sounds/samples/chime-input-required.mp3) |
| A tool fails | [I'm afraid something went wrong.](https://kaili-yang.github.io/devin-sounds/samples/butler-task-error.mp3) | [Forgive me, Your Majesty. Something went wrong.](https://kaili-yang.github.io/devin-sounds/samples/royal-task-error.mp3) | [Uh oh. I broke something.](https://kaili-yang.github.io/devin-sounds/samples/intern-task-error.mp3) | [error](https://kaili-yang.github.io/devin-sounds/samples/chime-task-error.mp3) |
| Devin finishes | [The task is complete.](https://kaili-yang.github.io/devin-sounds/samples/butler-task-complete.mp3) | [Your Majesty, the deed is done.](https://kaili-yang.github.io/devin-sounds/samples/royal-task-complete.mp3) | [Done, boss!](https://kaili-yang.github.io/devin-sounds/samples/intern-task-complete.mp3) | [done](https://kaili-yang.github.io/devin-sounds/samples/chime-task-complete.mp3) |

The recordings were made with macOS `say`; on your machine the voice packs are spoken by your own text-to-speech
(regenerate them with `node scripts/render-samples.js`).

## What it is

A Devin plugin that plays voice lines and chimes on Devin lifecycle events, so you can tab away and still know the
moment Devin finishes, needs your approval, or hits an error. Four packs are built in, and it plays
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
npx -y github:kaili-yang/devin-sounds use royal   # settings are per user, so any copy of the CLI works
```

The plugin ships a `/devin-sounds:sounds` skill, so the easiest way is to tell Devin what you want
(*"switch the sounds to the intern"*, *"mute the sounds"*, *"install the GLaDOS pack"*).

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
| `butler` (default) | en-GB | Right away. · The task is complete. · Pardon me. Your approval is required. · I'm afraid something went wrong. |
| `royal` | en-GB | As you command. · Your Majesty, the deed is done. · This matter awaits your royal decree. · The royal treasury runs low. |
| `intern` | en-US | On it, boss! · Done, boss! · Boss, I need your sign-off on this one. · Uh oh. I broke something. |
| `chime` | — | wordless bell chimes, works everywhere |

The voice packs are spoken by your machine's own text-to-speech (`say` on macOS, `espeak-ng` on Linux) the first
time each line is needed, then cached — so this repo contains no recorded audio. Without a TTS engine they fall back
to the chimes. `devin-sounds use <pack>` pre-renders everything so the first event plays instantly.

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

| Devin hook | CESP category | Example (`intern`) |
|---|---|---|
| `SessionStart` | `session.start` | Morning, boss! Coffee's on, let's ship. |
| `UserPromptSubmit` | `task.acknowledge` | On it, boss! |
| 3 prompts within 10 s | `user.spam` | Okay, okay, I'm on it! |
| `PermissionRequest` | `input.required` | Boss, I need your sign-off on this one. |
| `PostToolUse` with a failed tool | `task.error` | Uh oh. I broke something. (at most every 20 s) |
| `PostCompaction` | `resource.limit` | My brain is full. Summarizing! |
| `Stop` | `task.complete` | Done, boss! |
| `SessionEnd` | `session.end` | Clocking out. See you tomorrow! |

Sounds closer than 1.5 s apart are dropped, except approvals and completions, which always play. A pack never repeats
the same line twice in a row.

## Configure

```bash
devin-sounds list                       # packs, * = current
devin-sounds preview royal task.complete
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
DEVIN_SOUNDS_HOME=/tmp/ds/config DEVIN_SOUNDS_CACHE=/tmp/ds/cache node bin/cli.js test royal
echo '{"hook_event_name":"Stop"}' | DEVIN_SOUNDS_DRY_RUN=1 node bin/hook.js   # prints the plan on stderr
```

## Credits

Event categories and pack format: [OpenPeon / CESP](https://github.com/PeonPing/openpeon), born in
[peon-ping](https://github.com/PeonPing/peon-ping). devin-sounds is an independent CESP player for Devin.

MIT © Kelly Yang
