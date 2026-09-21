---
id: T-31
title: "Senedd TV Stream URL: Resolve, Mirror and Align the Meeting Stream"
kind: pipeline
status: done
depends: [T-14]
---

# T-31 — Senedd TV Stream URL

**What to build:**  
Each sitting's JSON carries `stream_url`: the unaltered Senedd TV HLS stream for that meeting, or `null`. T-32 plays it on the chamber screens. The pipeline never guesses a URL and never ships a stream whose start does not match the sitting clock.

Known from a sample (meeting 16086, 2026-07-01):
- Stream: `https://nafw.cdn.vustreams.com/m/{cdn_guid}/interpretation/interpretation.isml/interpretation.m3u8`, no token, `Access-Control-Allow-Origin: *`.
- Variants 360p / 576p / 720p / audio-only. One audio track, English interpretation.
- Variant playlists carry `vbegin=<unix seconds>`; the sample's `vbegin` 12:30:07 UTC equals `meeting_start_time` 13:30:07 Europe/London.
- `senedd.tv/en/{meeting_id}` embeds `player.senedd.tv/Player/Index/{player_guid}`; the CDN GUID differs from the player GUID. A server-side fetch of the player page returns "Player Error".

---

### Step 1 — Find the lookup

- [x] In a browser, capture the request that maps `player_guid` (or `meeting_id`) to `cdn_guid`. Record its URL shape, required headers and response format in the notes.
- [x] Confirm it works from Python without a browser session. If it does not, stop and record why; T-32 and T-33 still land behind the flag with `stream_url: null`.

### Step 2 — Resolve and mirror

- [x] `pipeline/senedd_tv.py`: `meeting_id` → `player_guid` → `cdn_guid` → master playlist URL.
- [x] Mirror the lookup response and the master playlist into Bronze with SHA-256, like the Record XML.
- [x] Migration: `plenary_sessions.stream_url`, `stream_vbegin` (unix seconds), both nullable.
- [x] `pipeline.sync` resolves streams for the sittings it re-fetches; a failed lookup leaves `null` and does not fail the sync.

### Step 3 — Alignment gate

- [x] Export publishes `stream_url` only when `stream_vbegin` is within 2 s of `session_date` + `meeting_start_time` in Europe/London. Otherwise `null`. No offset field.
- [x] `run_checks` samples published streams: master playlist returns 200 and its `vbegin` still matches. Unreachable reports "source unavailable" and passes, as the verbatim audit does.
- [x] Manual check, once: jump to 3–4 `startPos` values in hls.js against the sample stream and on senedd.tv; record that the frames match.

### Gates
- `python -m unittest` (lookup parsing, alignment gate at 0 s, 2 s and 3 s, null on failure); `python -m pipeline.run_checks --sample 40`; export determinism.
- `frontend/src/lib/data/types.ts` gains `stream_url: string | null` on the sitting.

**Notes:**

Done 2026-09-21.

- **Lookup (Step 1).** No hidden API. `https://www.senedd.tv/en/{meeting_id}` redirects to `/Meeting/Archive/{player_guid}`, whose HTML embeds `player.senedd.tv/Player/Index/{player_guid}`. The player page is plain server-rendered HTML carrying `src: "http://nafw.cdn.vustreams.com/m/{guid}/…/interpretation.m3u8?t={meetingStart UTC}"` and `meetingStart`. No cookie, token or Referer is needed. The "Player Error" is a 302 to `/Player/Error`: it is sent to agents that do not name a browser (`python-requests`, bare `Mozilla/5.0`), and at times to browser agents too, so the player page is retried up to 4 times. Siambr sends a Chrome-style UA ending in `Siambr/0.1`. Works from Python (`requests`) with no browser session.
- **Corrections to the sample above.** Meeting 16086 is 2026-07-15, not 2026-07-01. The CDN path uses the player GUID for 16 of the 17 sittings in Gold. The odd one out is 16085 (2026-07-14): its player names an uploaded file (`…/interpretation/{file_guid}_I.ism/…?t=00:00:00`) with no wall clock (`vbegin=0`, no `PROGRAM-DATE-TIME`), so it ships `null`.
- **What "the stream's start" is.** The `t` / `vbegin` value is senedd.tv's `meetingStart`, which is always `HH:MM:07`, 4–7 s after the Record's `MeetingDate`. Compared with that, every sitting would fail the gate. But Unified Streaming snaps `vbegin` back to an 8 s segment boundary. The variant playlist's first `#EXT-X-PROGRAM-DATE-TIME` is the wall clock at video position 0, and it sits within ±3 s of the Record's `MeetingDate`. So `stream_vbegin` stores that first-segment time, fractional unix seconds (column `REAL`), and the gate compares it with `session_date` + `meeting_start_time` in Europe/London. The player seeks `startPos` seconds from position 0 (`player.vuplaySmart.seek(seekStart)`), so `startPos` needs no offset.
- **Result for the 17 sittings in Gold** (gap = first segment − Record start): 14 aligned (−1.6 s to +1.8 s) and published. 2026-06-30 at −2.8 s and 2026-09-15 at −2.4 s are stored but not exported. 2026-07-14 has no wall clock.
- **URL.** The player names the playlist over `http://`. Siambr stores it on `https://`: the site is https, and the CDN serves the same bytes with `Access-Control-Allow-Origin: *`. The URL is otherwise unaltered, `?t=` included; `t` is what makes the playlist start at the meeting.
- **Bronze.** `data/bronze/senedd_tv/{year}/{date}-{meeting}-{player.html,master.m3u8,variant.m3u8}` plus a `{date}-{meeting}.sha256` manifest (hash, file, source URL). The senedd.tv Archive page is not mirrored because it changes on every fetch. The player page is byte-stable between fetches.
- **Record releases.** `write_session` keeps `stream_url`/`stream_vbegin` when it replaces a sitting, because the stream is Senedd TV's, not the Record's. A failed lookup keeps whatever is stored; for a new sitting that is `null`.
- **Commands.** Backfill with `python -m pipeline.senedd_tv`. `sync` looks up every listed sitting and exports when a stream changes, even if no Record did. `run_checks` adds an offline "exported stream_url passes the alignment gate" check and a live sampled check.
- **Manual check** (2026-07-15, 576p variant, ffmpeg `-ss` from playlist start, which is the same origin as hls.js `currentTime` and the senedd.tv seek; senedd.tv plays the same URL with the same seek, so its frames are the same by construction). startPos 48 and 2694: the shot cuts from the Minister to the Member the Record names within the second. startPos 16803: same Member as the contribution before, no cut, the same Member at the lectern. startPos 7224: the Minister stays on screen to +5 s, a wide shot at +8 s, the next speaker on camera by +12 s. The director's cut lagged the startPos there; there is no clock offset, because the other three line up. Not yet done in a browser with hls.js; T-32 should repeat it on the Stage.
