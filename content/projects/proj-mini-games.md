---
title: "E.Ngine Games"
subtitle: "Top Gun · Fishy · Space Invaders · Frogger · Pong × Brick Breaker · iSpy · FishMart · Chess · Four in a Row · Block Drop · Check-up · Keyboard Karaoke"
summary: "E.Ngine Games: twelve games playable on the site. Six are Edward's high-school games (Top Gun, Fishy, Space Invaders, Frogger, Pong × Brick Breaker and iSpy), ported to TypeScript, plus FishMart, Block Drop, online Chess and Four in a Row, Check-up, motion-controlled street ball, and Keyboard Karaoke."
tags: [game-development, java, typescript, python, pygame, games, high-school, simulation, how-to-play]
weight: 2
icon: /games/engine-icon.png
cover: /games/engine-tile.png
mediaLayout: arcade
ring: true
images:
  - /images/mini-games/top-gun.gif
  - /images/mini-games/i-spy-detection.png
videos:
  - https://www.youtube.com/watch?v=FHri_2SCaCQ
  - https://www.youtube.com/watch?v=Iq97lvTS2hY
captions:
  https://www.youtube.com/watch?v=FHri_2SCaCQ: "Top Gun demo"
  https://www.youtube.com/watch?v=Iq97lvTS2hY: "Space Invaders demo"
  /images/mini-games/top-gun.gif: "Top Gun gameplay"
  /images/mini-games/i-spy-detection.png: "I Spy: spotting objects of the chosen colour"
links:
  - { label: "Classic mini-games on GitHub", url: "https://github.com/edng5/classic-minigames", kind: github }
  - { label: "I Spy on GitHub", url: "https://github.com/edng5/ispy", kind: github }
related: [int-video-games, edu-john-cabot]
---

<!-- play: engine -->

## E.Ngine Games
Twelve games playable right here: six are Edward's high-school and university Java and Python
games, ported to TypeScript, and six are new. Each has its own soundtrack, saves sync to your
account, and signed-in players get global leaderboards and online play.

<!-- details: Under the hood -->

### The engine
E.Ngine is the small framework all twelve games share, built into this SvelteKit site (Svelte 5,
TypeScript, a Node server and SQLite). Each game is code-split and lazy-loaded (a dynamic
`import()`) from a registry when you open it. The arcade games implement one interface: a
fixed-rate `tick()` (the body of the original Java `run()` loop), `paint()` onto a canvas, key and
pointer handlers, and `save()`. The host runs a **fixed-timestep** loop: elapsed time goes into an
accumulator that's drained in whole ticks, so the simulation runs at the same speed on a 60 Hz
laptop or a 144 Hz phone, rendering happens once per screen refresh (and only when something
changed), and a long stall is dropped instead of fast-forwarded. The loop only runs while the game
is actually on screen (an `IntersectionObserver` plus the page's visibility). Keyboard, mouse and
touch go through one input layer, which also draws the on-screen joysticks and buttons on phones.

### Graphics and movement
Most games draw on an HTML5 Canvas 2D context at a fixed logical resolution, scaled to fit the
window. Movement is per tick: positions plus per-tick velocities, and in the ports Java-style
integer maths, so they play exactly as they did; smooth motion between grid cells (a frog's hop) is
tweened. Collision is mostly axis-aligned bounding boxes, with pixel masks where
shape matters (Fishy). Frogger and FishMart share
a tiny software voxel renderer (box models with lit tops and shaded fronts, depth-sorted with the
painter's algorithm), and Check-up is real 3D in three.js / WebGL with instanced meshes and shadow
maps.

### Sound
There are no audio files. Every soundtrack and sound effect is synthesized live with the Web Audio
API: a step sequencer schedules oscillator voices (square, triangle, sine, sawtooth, plucks and
bells) and filtered-noise drums slightly ahead of time on the audio clock, so timing stays tight
even when the page is busy.

### Saving
Progress is saved in `localStorage` as each game's own JSON. Signed in, a sync layer mirrors it to
your account: changes are pushed every few seconds and when you leave, and pulled again when the tab
regains focus or comes back online. Conflicts are handled with **optimistic concurrency**: every
save carries the version of the account copy it was based on, and the server refuses a write from
a stale copy and sends back the newer one, so an old tab can't overwrite progress you made on your
phone. Saves are validated and size-capped on the server, backed up, and a save made while signed
out never overwrites an account's progress just for being newer.

### Multiplayer
Online games use rooms with 6-digit codes or a ranked matchmaking queue. Each player keeps a
**Server-Sent Events** stream open for updates and sends actions as `POST` requests, so it all runs
over ordinary HTTPS with no extra ports. Turn-based games (Chess, Four in a Row) are
**server-authoritative**: the server validates every move with the same rules module the browser
uses and keeps the clocks. Real-time games (Fishy, Check-up) are **host-authoritative**: the host's
browser runs the simulation and streams state snapshots, the guest sends inputs, and the server
only relays between the room's two players. Ratings use Elo, and a player who drops out has a
short grace period to reconnect.

### Security
- **Passwordless sign-in** (Google OAuth or a one-time email code), so there are no passwords to
  leak. Sessions live in an `HttpOnly`, `Secure` cookie, and only a hash of each session token is
  stored, so even a copy of the database couldn't be used to log in as anyone.
- **Personal data** like emails is encrypted at rest; public leaderboards show a nickname or a
  masked email.
- **The server never trusts the client**: every request is checked against the player's session,
  only a room's two players can see or act in it, turn-based moves are rule-checked on the server,
  impossible scores are rejected, and sensitive actions are rate-limited.
- **Nicknames** are filtered for slurs and profanity, including disguised spellings.
- **Privacy**: Check-up's camera never leaves your device; online games send only a few numbers
  describing your pose.

<!-- /details -->

## ![](/images/mini-games/top-gun.jpg) Top Gun
A flight-combat game across three missions (fighter jets, cargo ships, then an army base), with
money for upgrades between them.

<!-- details: Top Gun -->

### How to play
Shoot down 75 enemy jets in mission 1, sink 30 cargo ships in mission 2, then destroy the army base
in mission 3. Kills earn money for upgrades to health, guns, missiles and a barrel roll. Each
mission has its own leaderboard.

### Controls
- <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to fly, <kbd>Space</kbd> for guns,
  <kbd>Shift</kbd> for a missile, <kbd>Enter</kbd> to pause.
- On phones: a joystick to fly, with Fire, Missile, Roll and Pause buttons.

### How it was made
Edward's high-school Java (Swing) game, ported line for line to TypeScript on an HTML5 `<canvas>`,
quirks and all. The port keeps the original's architecture: the same entity classes (jets,
ships, bullets, missiles, the base), the same fixed-tick `run()` loop with the same update order,
and Java's integer arithmetic (an `idiv` helper truncates like Java's `/`), so even hit boxes that
update a tick late behave exactly as they did. Swing's `paint()` calls map onto Canvas 2D draw
calls, and the menus were redrawn as clickable / tappable buttons that each call the Java menu
action they replace.

There's no 3D engine. The sense of flying at the enemy is depth and perspective, an art concept
Edward learned in Grade 6: enemy jets spawn as tiny specks at the vanishing point near the centre
of the screen (the horizon) and scale up as they slide out toward the edges, so they seem to rush
at you, the way things look closer the bigger they are and the further they are from the vanishing
point.

Around the original: the render loop pauses itself when the game is off screen (an
`IntersectionObserver` plus `visibilitychange`, capped at 60 fps on high-refresh displays), the
soundtrack and effects are synthesized live with the Web Audio API (oscillators and filtered
noise driven by a small step sequencer, so there are no audio files), progress is a JSON save in
`localStorage` that syncs to your account, and scores post to per-mission global leaderboards.

<!-- /details -->

## ![](/games/icons/fishy.png) Fishy
Eat smaller fish to grow, dodge the bigger ones, sharks and hooks, and unlock new characters.
Solo, two players on one keyboard, or online.

<!-- details: Fishy -->

### How to play
Eat fish smaller than you to grow; anything bigger eats you if you swim into its mouth. Medium adds
sharks and Hard adds fishing hooks; beating them unlocks the Shark and the Mooney Fish. In
multiplayer, eat the other player to win. Each difficulty has a leaderboard.

### Controls
- <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to swim (player 2: the arrow keys),
  <kbd>Enter</kbd> to pause.
- On phones: a joystick (two in multiplayer).

### How it was made
A port of Edward's Java game to TypeScript and Canvas 2D, with a few fixes. Collisions are
pixel-perfect: each sprite gets a precomputed alpha mask, and two fish only touch where both masks
have solid pixels in the overlap of their bounding boxes (the Java version compared box corners).
A bigger fish only eats you with its mouth (a hit region at the front of its sprite), and there's
a moment of invulnerability after you respawn.

Online play uses a **host-authoritative** model over the site's room service. The player who
creates the room is the host and runs the whole simulation in their browser; the guest only sends
their input (direction vectors), and the host broadcasts a compact state snapshot (every fish's
position, size and facing) about 25 times a second. The guest's screen interpolates toward each
snapshot, so movement stays smooth between packets. The transport is plain HTTPS: each player holds
a **Server-Sent Events** stream open to receive messages and sends theirs as `POST`s, which the
server relays only between the room's two authenticated players (it never simulates Fishy itself).
When the game ends, the server records the result and updates both players' Elo ratings.

<!-- /details -->

## ![](/images/mini-games/space-invaders.jpg) Space Invaders
The arcade classic, with bunkers, a bonus mothership, boss waves and an unlockable ship.

<!-- details: Space Invaders -->

### How to play
Clear each wave before it reaches you. Normal is the classic; Hard adds bosses (10 points a hit,
1,000 for the kill); No Shields is Hard without bunkers. Each has a leaderboard.

### Controls
- <kbd>A</kbd> <kbd>D</kbd> to move, <kbd>Space</kbd> to shoot, <kbd>Enter</kbd> to pause.
- On phones: arrow buttons and Fire.

### How it was made
A port of Edward's Java game and its classes (the ship, the invaders, bunkers, the mothership, the
bosses and bullets), logic kept as written. Each entity is an object with a position, a size and a
per-tick velocity (`x_speed`, `y_speed`), updated in a fixed-step loop on Canvas 2D, and hits are
axis-aligned bounding-box (AABB) overlap tests, exactly as the Java did them. The menus were
redrawn, and the original's "Shields Down" switch became a difficulty of its own, so it gets its own
leaderboard. Scores are checked against a ceiling on the server (anything impossible is rejected)
before they reach the global boards.

<!-- /details -->

## ![](/games/icons/frogger-panel.png) Frogger
Edward's Grade 10 pygame game, rebuilt in chunky 3D blocks: timed Classic runs, or an endless hop
through roads, railways and rivers.

<!-- details: Frogger -->

### How to play
- **Classic:** cross the road and river to fill all five lily pads before time runs out.
- **Endless:** hop forward as far as you can; don't dawdle, or the heron gets you.
- Coins buy gumball-machine rolls that unlock 10 swamp animals. Each mode has a leaderboard.

### Controls
- <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to hop, <kbd>Enter</kbd> to pause.
- On phones: tap to hop forward, swipe to turn.

### How it was made
Rebuilt in TypeScript from the pygame original (FroggerV15). Classic mode keeps the original
lanes, timer and lily pads. Endless mode is **procedurally generated**: rows (grass, roads,
railways, rivers of logs or lily pads) are produced from weighted rules a screen ahead of you and
recycled behind you, with spawn rates and speeds that scale with distance, and the camera creeps
forward so idling gets you caught.

The 3D "voxel" look doesn't use WebGL: it's a small software renderer on Canvas 2D (shared with
FishMart). Every car, log, train, tree and character is a model made of boxes in tile units, each
painted with a lit top face and a darker front face. Models are depth-sorted (painter's algorithm:
farther and lower boxes first), and the world draws the ground back to front, then everything
standing on it back to front, so nearer things correctly cover farther ones. Movement is
tile-based: each hop tweens the character from one tile to the next, while cars, trains and
logs move continuously in pixels per second, and anything riding a log is carried with it. The
gumball machine always rolls a character you don't have yet, with fixed odds for a rare hidden
one; coins, characters and best runs sync to your account.

<!-- /details -->

## ![](/games/icons/pong.png) Pong × Brick Breaker
Two paddle games in one: keep the ball alive as it speeds up, or clear all 50 bricks.

<!-- details: Pong × Brick Breaker -->

### How to play
In Pong, the ball speeds up and a second ball joins as the score climbs. In Brick Breaker, clear
the bricks, catching power-ups as they fall. Each game has a leaderboard.

### Controls
- <kbd>A</kbd> <kbd>D</kbd> (or the mouse) to move the paddle, <kbd>Space</kbd> to serve.
- On phones: arrow buttons in the middle, with Serve beside them.

### How it was made
A port of Edward's Java game, quirks included. Even the menu buttons keep their original hit boxes,
shifted by the Java window's title bar and border (the original measured clicks in window
coordinates). Pong's ball reflects off the paddle at an angle based on where it hits, and speeds up
with the rally; Brick Breaker resolves ball-brick collisions per axis so the ball bounces off the
correct face. Both run in a single Canvas 2D loop that stops drawing when the game isn't visible.

<!-- /details -->

## ![](/games/icons/ifish.png) FishMart
Run an aquarium shop with 800+ real species: stock tanks, breed rare fish, go fishing and trade with
other players.

<!-- details: FishMart -->

### How to play
- **Store:** build and stock sale tanks, keep them clean, and expand the floor.
- **Shipments:** supplier crates, seasonal crates and a free daily gift.
- **Show tanks:** decorate up to five, plus a partner fish you raise.
- **Staff and research:** hire up to 8; scientists research fish so you can order them.
- **Breeding:** pairs can produce albinos, hybrids and rare mythics.
- **Fishing** and the **Market**, where you trade fish and visit other players' stores.

### Controls
Click or tap; everything is menus and panels.

### How it was made
Made for the site as a set of Svelte 5 components (runes for reactive state) rather than a canvas
game: the store floor, tanks, fishing and market are UI, with the fish themselves drawn
procedurally from body plans (fin, tail and pattern parameters per species) so hundreds of
species need no image files.

The simulation is **timestamp-based**: every timed thing (a staff task, a breeding pair, dirty
water, a hungry centrepiece) stores when it started, and an `advance()` step replays everything
that would have happened while the game was closed, so the shop keeps running while you're away.
Breeding rolls albinos, hybrids and mythics from odds tables. Saves sync to your account with
conflict handling, so an old tab can't overwrite newer progress from another device. The Market
is server-side: a listed fish is held by the server, and a sale transfers it to the buyer at once
while the payment waits for the seller to collect it.

<!-- /details -->

## ![](/images/mini-games/i-spy.jpg) iSpy
"I spy with my little eye, something red…": find matches in busy scenes before time runs out, or
stump the computer.

<!-- details: iSpy -->

### How to play
- **Seek & Find:** click a match for each clue. Quick finds build a combo; wrong clicks cost time.
  Later levels add lookalikes and clues like "something green you can eat". On the leaderboards.
- **Stump the Computer:** think of something in the scene and say its colour; it gets three
  guesses.

### Controls
- Click or tap; <kbd>H</kbd> for a hint, <kbd>Enter</kbd> to pause.

### How it was made
Edward's original I Spy was Python and OpenCV: the computer guessed an object from its colour.
This version turns it round into an arcade game.

The six scenes (bedroom, garden, ocean, space, kitchen, jungle) are drawn entirely in code on
Canvas 2D: no image assets. Each scene defines **spots**: regions where things belong (books on
shelves, fruit on the counter, frogs in the pond), resting on a ground line or floating (sky,
water, space), with a depth factor so objects further back are drawn smaller and placement reads as
a real scene. Every game procedurally re-rolls which objects appear, where, and the clues (colour,
category, "something green you can eat"), with lookalikes added at higher levels. Clicks are
hit-tested against the placed objects, and the combo and timer run in the game loop.
"Stump the Computer" flips the roles: you pick a colour, and the computer makes up to three guesses
from the objects in the scene that match it.

<!-- /details -->

## ![](/games/icons/blockdrop.png) Block Drop
A falling-block puzzle: fill rows to clear them as the pieces fall faster.

<!-- details: Block Drop -->

### How to play
Seven shapes fall into a 10 × 20 well; fill a row and it clears. Every 10 rows the level goes up and
pieces fall faster. Clearing more rows at once scores more. On the global leaderboards.

### Controls
- <kbd>A</kbd> <kbd>D</kbd> to move, <kbd>S</kbd> soft drop, <kbd>W</kbd> rotate,
  <kbd>Space</kbd> hard drop, <kbd>Enter</kbd> pause.
- On phones: arrow buttons, Rotate and Drop.

### How it was made
An original game for the site, on Canvas 2D. Pieces come from a **7-bag randomizer**: all seven
shapes are shuffled (Fisher–Yates) into a bag and dealt in order, so you never wait long for the
one you need. The well is a 10 × 20 grid of cells; a move or rotation is accepted only if the
piece's cells land inside the grid on empty squares, and rotations try small offsets ("kicks")
off walls and the floor. Gravity speeds up every 10 lines and scoring rewards clearing more rows at
once. Scores past a ceiling no real game could reach are rejected by the server before they reach
the leaderboard.

<!-- /details -->

## ![](/games/icons/chess.png) Chess and Four in a Row
Online against other players: ranked matchmaking with a rating, or a custom game with a friend's
room code.

<!-- details: Chess and Four in a Row -->

### How to play
- **Ranked:** matched with someone else who's looking; random first move, 10 minutes each, rated.
- **Custom:** share a 6-digit room code; choose who goes first, takebacks and a clock. Not rated.
- Resign, offer a draw (chess), ask for a takeback or a rematch. Pick a board theme.

### Controls
Click or tap a piece, then where it goes (or the column to drop in).

### How it was made
Both games are **server-authoritative**. The rules live in a dependency-free TypeScript module
shared by the browser (to highlight legal moves) and the server (which checks every online move),
so a modified client can't make an illegal move or cheat its way up the ratings. Chess generates
pseudo-legal moves per piece on a 64-square board, then filters out any that leave your own king in
check; castling, en passant, promotion, threefold repetition, the fifty-move rule and insufficient
material are all handled. The move generator was verified with **perft** counts (the number of
legal positions a few moves deep from known test positions).

Rooms live in the Node server's memory. Each player opens a **Server-Sent Events** stream for
updates and sends moves as authenticated `POST`s; the server validates each one, runs the chess
clock itself (so lag can't steal time), and pushes the new position to both players. Ranked games
pair players from a matchmaking queue and update an Elo rating; a player who disconnects
mid-game has a short grace period to come back before it counts as a loss.

<!-- /details -->

## ![](/games/icons/checkup.png) Check-up
1-on-1 street ball where your body is the controller: the webcam tracks you and your voxel player
copies you, against fifteen AI-pun legends or a friend online.

<!-- details: Check-up -->

### How to play
- **Practice:** record your own jump shot and layup, then drill them and your moves.
- **Street Ladder:** fifteen games to 11 (ones and twos, make it take it, a 24-second shot clock), from Spud Web 1.0 through Derrick
  ROWS, A.I. and Kobe BYTEant to AI Jordan. Each win brings a bigger crowd and that player's
  reward, like AI Jordan's AI 1s, Shaq's shattered backboard or the King's crown.
- **Online 1-on-1** with a friend's room code and a 24-second shot clock.
- **My player:** appearance, gear, court styles and seven attributes, with achievements to earn.

### Controls
No buttons, just your body:
- Dribble to move; lean in while dribbling to speed up, lean back to retreat. Turn your body while
  dribbling to head that way; stop, or face forward, and you turn back to the rim.
- Step back from the camera for a step-back. Shoot while turned away for a fadeaway: harder to
  guard, harder to make, with a later release.
- Both hands up together, then release over your head to shoot (time it to the green); reach one
  hand high at the rim for a layup (or a dunk, at Finishing 70).
- Crossover, in-and-out or spin with your hands low to break ankles; pump fake to make him jump.
- On defense, lean to step up or sag off, slide sideways, and jump with his release to block.
- Make it, take it: score and you keep the ball. First to 11, with a 24-second shot clock.

### How it was made
**Pose tracking.** The webcam feed goes through Google's MediaPipe Pose Landmarker (the "lite"
model, running on WebAssembly with GPU delegation) entirely in the browser; no video is stored or
sent. Each frame yields 33 body landmarks, which are reduced to a small, scale-invariant feature
vector measured in shoulder widths: each wrist's height relative to its shoulder, elbow and knee
angles, hip height, hand spread, and a forward lean from the landmarks' depth estimates.

**Gesture recognition.** A motion layer turns that stream into game input with hand-written
detectors on short rolling windows: lean (smoothed with an exponential moving average, a dead
zone, and a slowly re-centring baseline), side steps against a calibrated stance, jumps (hips
rising fast against a slow-moving average), crossovers (the hands crossing the body inside 450 ms,
direction from the order of the extremes), spins (the shoulders narrowing as you turn side-on),
step-backs, running in place (counting alternating knee or arm swaps per second), pounding the
dribble (the low hand oscillating), and steal swipes (a wrist sweeping across the body fast).
Shots are matched against your own recorded template using **dynamic time warping** (DTW) for form,
and the release time against your recorded timing: a few hundred bytes saved locally.

**Rendering.** The park is three.js (WebGL): a voxel world drawn with instanced cube meshes
batched by colour (one draw call per colour instead of one per block), with shadow maps,
lighting that switches to night games under floodlights, a crowd that grows as you climb the
ladder (and raises arms, holds up "3" cards, groans, and throws confetti made from a particle
system), and players rigged as simple joint hierarchies. Your player copies your pose, with
clamped joint limits so tracking noise can't twist a limb; the computer plays keyframed
animations eased with smoothstep. The camera eases between gameplay views and cut-scene shots.

**Game logic and AI.** The game runs in a fixed update with each opponent defined by a few ratings
and a play style (pull-up shooter, slasher, dunker, deep range). The CPU defender predicts your
path to the rim and reacts with a delay that shrinks with its defense rating; the CPU ball handler
runs a small state machine (size up, drive, step back, shoot, dribble move) that reads your
position. Outcomes are probabilistic, weighting your attributes, the contest, and timing.

**Multiplayer.** Online games reuse the room service (SSE down, `POST` up, relayed by the server
between two authenticated players) with a **host-authoritative** design: the host's browser runs
the simulation, the guest streams compact inputs (lean, side step, ball hand, running and dribble
state, and quantized joint angles for the avatar) about 15 times a second, and the host broadcasts
positions, score and events about 12 times a second. Discrete events like shots, moves and steals
are sent once each, and the guest interpolates positions between snapshots. Only those numbers
cross the network, never video.

**Audio and voice.** The soundtracks and every effect (swishes, the crowd, air horns) are
synthesized with the Web Audio API, and opponents' trash talk and the cut scenes are read aloud in
the Cortex voice, choosing from a pool of lines so they don't repeat.

<!-- /details -->

## ![](/games/icons/karaoke.png) Keyboard Karaoke
Queue songs from YouTube and sing: synced lyrics scroll with the video, a pitch guide shows the
notes, and you're scored on pitch and timing. Sing solo or in a room with a friend.

<!-- details: Keyboard Karaoke -->

### How to play
- **Pick songs** from the song book, a YouTube search, or a pasted video or playlist link, and
  queue them up.
- **Sing** into your microphone (headphones help). The lyrics fill with colour as each word is
  sung.
- **The pitch guide:** note bars scroll toward a "now" line; your voice is the trail of dots, green
  when you're on the note. Any octave counts.
- **Grades** from S+ down to F, revealed when the song ends, with your best per song. The crowd bar
  across the top works like a life bar: it starts full, nailed notes fill it back up and misses
  drain it. It pulses on every word, glows as you sing, and catches fire when you're on a roll.
  Finish well for cheers and confetti; finish badly and the crowd boos and throws tomatoes. Nail a note and it pops: Good,
  Great!, Perfect!, or GOLDEN! on a golden note.
- **Lenient on purpose:** within 1½ semitones counts, in any octave, and a little early or late is
  fine, since videos and lyrics are rarely perfectly in step. Turn scoring off to just sing, jump
  past a long intro, restart a song, or skip it any time. Songs without lyrics end on confetti, not a
  grade.
- **Lyrics versions:** when several versions of a song's lyrics are found, pick another from a
  drop-down; your choice and your timing tweaks are remembered per song (the last 1,000 songs,
  favourites kept longest).
- **Favourites:** star up to 100 songs and they wait in your song book.
- **Sing with a friend:** make a room and share the code. The host runs the queue, and you see
  each other's score and pitch live.

### Controls
- <kbd>Space</kbd> pause, <kbd>←</kbd> <kbd>→</kbd> nudge the lyrics, <kbd>T</kbd> "the first line
  starts now", <kbd>N</kbd> skip.
- Everything else is clicks or taps.

### How it was made
**Hearing you.** The microphone goes into the Web Audio API, and each frame (about 46 ms of
sound) runs through **YIN**, a pitch-detection algorithm designed for voices. It finds the delay at
which the waveform best repeats itself, normalises it so it doesn't lock onto half or double the
real pitch, and refines it between samples with a parabolic fit. It's accurate to well under a
cent on test tones. A noise gate and a clarity threshold separate singing from background noise,
and nothing is recorded or sent.

**Playing songs.** Videos play in YouTube's official IFrame Player. Its audio is cross-origin, so
the page can't analyse it; instead the game follows the player's clock, polling its current time
every frame to drive the lyrics, the pitch guide and the score. Search reads YouTube's results page
server-side (no API key), and pasted links are resolved through YouTube's oEmbed endpoint.

**Lyrics in sync.** The server looks up time-stamped lyrics in **LRCLIB**, an open database of
synced lyrics in LRC format (a time per line, sometimes per word). Where words have their own times
they fill with colour as they're sung; where only lines do (most songs), the whole line lights up
with a bar running to the next one. Guessing word times would be wrong whenever a singer holds a
word. It parses video titles into
artist and track: "Artist - Song (Official Video)", the K-pop style `aespa 에스파 'Switchblade (Feat.
Ty Dolla $ign)' MV` (the song in quotes, a name written in two scripts, a featured artist) and the
J-pop style 「…」, titles split into `|` sections, "Song By Artist", and "SONG - ARTIST" the
wrong way round. Both the **song and the singer** have to check out before lyrics are used: the
song's exact name ("Free" isn't "Free Free Free"), and the artist (or, for a soundtrack, the album,
say "KPop Demon Hunters") matching something about the video. When a title doesn't name the singer,
the video's own description and tags are read for it. No lyrics beats the wrong lyrics: when
none can be trusted, the video plays with YouTube's own subtitles switched on, if it has any (drawn
by YouTube's player; the song is then scored on pitch control).

**The right timing for the right video.** The versions timed to the selected video's own length come
first, so a music video gets lyrics timed to the music video (intro and all) and a lyric video gets
the recording's. The other versions stay in a drop-down.

**No waiting.** A song never starts before its lyrics are ready: a loading screen covers the lookup.
Lookups start the moment a song is queued, and the next songs in the queue are looked up while the
current one plays, so by the time a song comes up its lyrics are usually already there. Each search
runs on its own, so one failed request (a timeout, rate limiting) can't sink the rest, and a failure
is never remembered as “no lyrics”.

**Cross-checking.** LRCLIB often holds many versions of a song, sent in by different people, and
some are wrong (junk lines, the wrong song, shifted timings), sometimes submitted several times
over. The server compares all versions of the song with each other: one vote per distinct file,
scored on shared words, on agreeing when the first line starts, and on whether its opening lines
are in everyone else's lyrics at all (junk like "Let's Go karaoke… Are You Ready" isn't). The
version most of the others agree with wins. When the video runs longer than the recording the lyrics were timed to (usually
an intro), the game offers to shift the lyrics by the difference. Lines without word timings get their words spread across the line by length for the
colour wipe. Music videos often have an intro the album recording doesn't, so each song keeps an
offset you can nudge, or set by tapping when the first line starts.

**The pitch guide.** Pitch targets come from note charts in the open **UltraStar** format: notes
with a start beat, length and pitch, converted to seconds from the chart's BPM and gap. A built-in
public-domain warm-up plays on a small Web Audio synth driven by its own chart, and you can paste a
chart for any song. Without a chart, a song is scored on timing (singing while lines are up, not
over the gaps) and pitch control (holding steady notes in the key you've been singing in, found by
fitting your notes to a major scale).

**Scoring.** Out of 100 behind the scenes, shown as a letter grade (S+ … F): live, over what you've
sung so far, and finally over the whole song. A health bar adds the arcade feel: each note's
verdict fills or drains it, more steeply on hard. The page can't hear the YouTube audio, so the bar,
the lyrics and the light show move to the song's rhythm as the game knows it (every word and note
starting) and to your voice's loudness from the microphone. With a chart, every moment of every note counts: full marks within half a semitone,
partial marks within a semitone and a half, octave-independent, with a quarter-second of timing
slack either way and golden notes worth double. Getting the right note at the wrong time misses, so pitch and timing are judged
together.

**Rooms.** Rooms use the site's room service (Server-Sent Events down, `POST`s up). The host's queue
and video clock lead: start, pause and a time sync every two seconds go out to the other player,
whose video seeks back into step if it drifts. Each singer is scored on their own device against
their own video, so network delay never costs points. Live scores and pitch are shared a few times
a second. Hearing each other is left out on purpose: voices sent over the internet arrive a beat
late against music playing in time on each screen.

<!-- /details -->
