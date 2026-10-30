# Costume Song Board: notes for Claude

Iana's tap-to-play board: kids tap a photo of the costume they're wearing and that character's song plays in Spotify.
Live: https://ianaharsono.github.io/costume-song-board/ · Repo: ianaharsono/costume-song-board (public, GitHub Pages from `main`, root).

## How Iana works (read first)
- Direct, no filler. No em dashes in anything written for her. Plain words, not tech jargon.
- She tests on her **iPhone (Safari)** and on her **Mac** (a "Mac mini" also shows up as a Spotify device). Spotify **Premium**.
- She's a product designer: give her visual changes she can see, and keep the top of the board compact (she wants to see cards fast).
- She often edits characters herself from the live page, so **always `git pull --rebase` before editing and before pushing** (commits like "Update Minion", "Add photo for X" are hers).
- When she reports a bug, ask for (or use) a screenshot of **Spotify details** (filter button → Spotify details, or tap the song name in the player bar). It logs every Spotify call with status, device and song.
- Don't guess Spotify track IDs. If you can't verify a link, add the character with `spotifySearch` (see below).
- Only commit/push what she asked for. End commits with the attribution lines from the session's system reminder.

## Files
- `index.html`: the whole app (HTML + CSS + JS in one file, ~1700 lines). No build step.
- `characters.json`: `{ "characters": [ { id, name, songName, spotify, spotifySearch?, tags[], photo, order, createdAt } ] }`. `photo` is a path like `photos/<slug>-<ts>.jpg` or "".
- `photos/`: costume photos, 1000×1000 JPEGs (cropped square in the editor).
- `config.json`: `{ "spotifyClientId": "df55a26c05364902888f0d1a503d6b00" }` (public Client ID of her Spotify developer app; not a secret).
- `sw.js`: service worker that caches only `/photos/` and fonts (never the page or JSON).
- `README.md`: short public readme.
- `icons/` + `manifest.webmanifest`: home screen icon (original ghost + music note; source `icons/icon.svg`, rendered with Playwright). Manifest uses `display: "browser"` on purpose so the home screen icon opens in Safari, where all playback rules were tested (a standalone web app has separate storage and different link handling).

## How it works
- **Data**: page reads `characters.json` straight from the GitHub API (if a GitHub key is saved) or `raw.githubusercontent.com` (fallback: site copy), and re-checks on focus/visibility and every 60s so edits on one device show on others within seconds.
- **Editing**: ✏️ button on each card (photo top-left) and an "Add character" card always last. Saving writes to the repo through the GitHub contents API with a **fine-grained token** the user pastes once per device (Contents: Read and write, only this repo). The connect dialog has a prefilled-token link (unique name per device; GitHub refuses duplicate token names). **Never create or hand out a token for her**: she must make it herself.
- **Link cleanup**: `normalizeSpotify()` strips `?si=`, `utm_*`, `/intl-xx/`, pulls the URL out of share text, converts `spotify:` URIs. Runs on paste/blur.
- **`spotifySearch`**: characters may have a search string instead of a link. On a Spotify-connected device `findSongs()` searches (`market=from_token`, skips `is_playable:false`), caches in `songFind`, and saves the link to the repo if a GitHub key is present.
- **Song check** (filter sheet → Song check): `checkSong()` asks `GET /tracks/{id}?market=from_token` → `is_playable`. Blocked/broken tracks get swapped to a playable version via search (`songFix`), saved to repo if GitHub key present. Runs slowly in background, pauses 15s after any tap.
- **Spotify connection**: PKCE login (no secret), scopes `user-modify-playback-state user-read-playback-state`. Redirect URI must be exactly `https://ianaharsono.github.io/costume-song-board/`. A full-screen gate blocks the board until a device connects. Auto-reconnects if a previously connected device lost its token (`spEver`).
- **Player bar** (bottom): song + play/pause + Next + Queue. Queue lives per device (`songQueue`). Repeat-one when nothing is queued; with a queue, songs play once and auto-advance.
- **Filter & sort sheet**: sort (A–Z default, Z–A, Newest, My order), tags (8 most used, "Show all"), Open-songs-in switch (phones only), links to Song check / Spotify details / Disconnect GitHub, and a **"Board version" tag** (bump the version tag (currently `icon-1`) in two places when shipping a notable fix so she can confirm she's not on a stale copy).

### localStorage keys
`spTok` (Spotify tokens), `spEver`, `spAutoTried`, `spPhone` (this phone's Spotify device id), `spVerifier`/`spState` (login), `ghToken`, `openMode` (`app`|`web`), `boardPrefs2` (sort + tags), `songQueue`, `songCheck2`, `songFix`, `songFind`.

## Playback rules (hard-won: don't regress these)
1. **iPhone only lets a page open another app inside the tap itself.** Any `await` before opening Spotify = silently blocked. Decide synchronously in `tapPlay()`; play buttons are real `<a href>` links so the tap itself opens Spotify. Fallbacks after a network wait must show the yellow **wake bar** with an "Open Spotify" link button (a fresh tap).
2. **Use `https://open.spotify.com/...` links, not `spotify:` URIs**: `spotify:` triggers Safari's "Open in Spotify?" prompt.
3. **A backgrounded Spotify on iPhone can't START a song, only skip.** `PUT /me/player/play` stops the old song and leaves silence ("paused, no song info" in the log). While a song is playing on the phone, switch with **queue + next** (`skipTo()`). Skipping returns 403 when nothing is playing.
4. **Paused counts as stopped on iPhone.** Only control Spotify remotely when it was just seen *playing* on this phone (`playingHere()`); otherwise the tap opens the Spotify app with the song (Spotify autoplays when nothing else is playing).
5. **Never resend "play" over a song that's already playing here** (kills it). After returning from the Spotify app, if something is playing on this device, accept it.
6. **Right device only.** Phones: only phone/tablet devices (never "Mac mini" or speakers); if the Spotify app sent the song to another device, `moveToPhone()` transfers it. Computers: **always the browser's Spotify web player** ("Web Player (…)") in one reused named tab (`costume-song-board-spotify`, no `noopener` or the tab can't be reused); never the desktop app; `startInWebPlayer()` waits for the web player to appear after opening the tab and starts the song.
7. **Spotify can answer OK and play nothing.** `verifyPlaying()` checks ~2s later, resends once, then shows the wake bar.
8. **Spotify relinks tracks** (regional copies with a different id; album/playlist links report the inner track). `normalizeState()` maps back via `linked_from`/`context` before comparing. Note: Feb 2026 API changes removed `linked_from`/`available_markets` from some objects; `is_playable` with `market=from_token` still works.
9. **Right after switching back from the Spotify app, the first request often fails.** `spApi` waits ~700ms after resume and retries network/5xx/401 twice. Token refresh is single-flight (Spotify rotates refresh tokens; parallel refreshes log the user out).
10. **Latest tap wins** (`playSeq`). Use Spotify's freshest report (`lastRaw`) for decisions, not the bar's copy.

## Error → cause → fix (from real sessions)
| What she saw | Cause | Fix |
|---|---|---|
| Tap does nothing, Spotify doesn't open | Opening the app after an `await` (iOS blocks it) | Open within the tap; real links |
| "Open in Spotify?" prompt | `spotify:` URI | Use https links |
| Bar says Now playing, no sound; old song stopped | Background `play` on iPhone | queue + skip while playing |
| Works for first song, second goes silent | Board thought Spotify wasn't playing (stale state / relinked track) and sent `play` | `lastRaw` + `normalizeState` |
| "Paused · on Mac mini" | Song sent to an unresponsive desktop app | Phones: phones only. Computers: web player only |
| `PUT player/play → ok` then paused "no song info", later 404 | Spotify accepted but iOS froze it | `verifyPlaying` + wake bar; tell her to press ▶ once in Spotify |
| `POST player/next → 403 UNKNOWN` | Skip attempted while paused | Only skip when playing; otherwise open the app |
| "Couldn't reach Spotify" right after returning | First request after resume fails | resume delay + retries |
| Signed out of Spotify randomly | Parallel token refresh / Safari Private tab | single-flight refresh; tell her not to use Private tabs |
| New tab per song on computer | `noopener` / `_blank` | named tab, no noopener (computers only) |
| Edits on desktop not on phone | GitHub Pages cache (10 min) | read JSON from GitHub API/raw; she can Cmd+Shift+R |
| Page looks old after a push | GitHub Pages / browser cache | hard reload; check "Board version" tag |
| Song "Not available in your region" | Region-blocked track | Song check swaps it; else she pastes a new link |
| GitHub "token already generated" | Duplicate token name | prefilled link uses a unique name; don't "Regenerate" (kills the other device's key) |
| Connect error 401/403/404 | Bad/expired token or wrong repo scope | New fine-grained token: only this repo, Contents read+write |

## Testing (no real Spotify or iPhone here)
The cloud session can't reach open.spotify.com, github.io, or Spotify with her account. Test with Playwright against a **fake Spotify** routed in-page:
- Serve the repo files at a fake origin (`http://board.test/`), route `api.spotify.com` to a model of the iPhone/Mac Spotify, seed `localStorage.spTok`.
- Model iOS rules: app opens only within ~300ms of a click with no fetch in between; background `play` → silence; skip only while playing; paused → frozen; Spotify app may play on the Mac; regional relinks; "OK but nothing".
- Measure: songs sent to the wrong device = 0, blocked app opens = 0, right song playing after each tap.
- Always run the old version through a new scenario first to confirm the test reproduces her bug, then the fix.
- Syntax check: extract the last `<script>` and `node --check` it.
- Screenshot at 390×844 (phone) in dark mode to check layout.

## Characters
About 85 characters, mostly Halloween costumes for kids. Tags in use: classic, movies, disney, tv, princess, superhero, game, sports, celebrities, monster. Name prefixes group related ones ("Princess Elsa", "Mario Yoshi", "Star Wars Darth Vader", "Wicked Glinda", "Kpop Huntrix", "Encanto Mirabel"). Avoid duplicates (check names, case-insensitive) when she asks to add.
Photos: she uploads her own; don't add photos of real people or studio images on her behalf to this public repo.
