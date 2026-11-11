---
title: "E.Ngine Games"
subtitle: "Top Gun · Fishy · Space Invaders · Frogger · Pong × Brick Breaker · iSpy · FishMart · Chess · Four in a Row · Block Drop · Check-up"
summary: "E.Ngine Games: eleven games playable on the site. Six are Edward's high-school games (Top Gun, Fishy, Space Invaders, Frogger, Pong × Brick Breaker and iSpy), ported to TypeScript, plus FishMart, Block Drop, online Chess and Four in a Row, and Check-up, motion-controlled street ball."
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
Eleven games playable right here: six are Edward's high-school and university Java and Python
games, ported to TypeScript, and five are new. Each has its own soundtrack, saves sync to your
account, and signed-in players get global leaderboards and online play.

<!-- details: Under the hood -->

### The engine
E.Ngine is the small framework all eleven games share, built into this SvelteKit site (Svelte 5,
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
phone. Saves are size-capped, a copy is put aside once a day before it's replaced (the two newest
are kept, with a rollback script), and a save made while signed out never overwrites an account's
progress just for being newer.

### Multiplayer
Online games use rooms with 6-digit codes or a ranked matchmaking queue. Each player keeps a
**Server-Sent Events** stream open for updates and sends actions as `POST` requests, so it all runs
over ordinary HTTPS with no extra ports. Turn-based games (Chess, Four in a Row) are
**server-authoritative**: the server validates every move with the same rules module the browser
uses and keeps the clocks. Real-time games (Fishy, Check-up) are **host-authoritative**: the host's
browser runs the simulation and streams state snapshots, the guest sends inputs, and the server
only relays between the room's two players. Ratings use Elo (K = 32), and a player who drops out
has 45 seconds to reconnect.

### Security
- **Sign-in** is passwordless: Google OAuth 2.0 with PKCE, or a one-time email code (stored as an
  HMAC, single use, 10-minute expiry, with attempt limits so it can't be brute-forced).
- **Sessions** are 32 random bytes in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie; the database
  stores only a SHA-256 hash of the token, so a leaked database can't be replayed as live logins.
- **Personal data** like emails is encrypted at rest with AES-256-GCM and looked up through an HMAC
  blind index; public leaderboards show a nickname or a masked email.
- **The server never trusts the client**: every room action is checked against the player's
  session, only a room's two players can read or post to it, chess and Four in a Row moves are
  rule-checked, scores past an impossible ceiling are rejected, and room creation, joining and
  the FishMart market are rate-limited per account.
- **Nicknames** are filtered for slurs and profanity, including spellings with numbers and symbols.
- **Headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and a strict referrer
  policy on every response. Check-up's camera never leaves your device: only a few numbers
  describing your pose are sent in online games.

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
Edward's high-school Java (Swing) game, ported line for line to TypeScript and a canvas, quirks
and all. Instead of a 3D engine, the sense of flying toward the enemy comes from depth and
perspective, an art concept Edward learned in Grade 6. Enemy jets start as tiny specks near the centre of the
screen, where the horizon is, then grow larger as they slide out toward the edges, so they seem to
rush at you, the way things look closer the bigger they are and the further they are from the
vanishing point.

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
A port of Edward's Java game, with a few fixes: collisions are pixel-perfect (two fish only touch
where both sprites have solid pixels), a bigger fish only eats you with its mouth, and there's a
moment of safety after losing a life. Online games run in the host's browser, which sends the
other player where everyone is several times a second.

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
A port of Edward's Java game and its classes, logic kept as written. The menus were redrawn, and
the original's "Shields Down" switch became a difficulty of its own, so it gets a leaderboard.

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
Rebuilt in TypeScript from the pygame original. Endless mode generates rows as you go and speeds
up the further you get. The "voxel" look is drawn by hand on a canvas: every car, log, train and
character is built from little blocks, each drawn with a lit top and a shaded front.

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
A port of Edward's Java game, quirks included. Even the menu buttons keep their original hit
boxes, shifted by the Java window's title bar and border.

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
Made for the site, as Svelte components rather than a canvas game. Timed tasks keep running
while you're away, and progress syncs to your account.

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
This version turns it round into an arcade game. The six scenes (bedroom, garden, ocean, space,
kitchen, jungle) are drawn in code, with things placed where they belong, differently every game.

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
An original game for the site. Pieces come from a shuffled bag of all seven, so you never wait
long for the one you need.

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
Both games' rules run on the server, which checks every move and keeps the clocks, so ratings
can't be cheated. The chess rules were checked against known move counts for test positions.
Players get live updates over the site's connection, and ratings move like chess Elo.

<!-- /details -->

## ![](/games/icons/checkup.png) Check-up
1-on-1 street ball where your body is the controller: the webcam tracks you and your voxel player
copies you, against fifteen AI-pun legends or a friend online.

<!-- details: Check-up -->

### How to play
- **Practice:** record your own jump shot and layup, then drill them and your moves.
- **Street Ladder:** fifteen games to 11 (ones and twos), from Spud Web 1.0 through Derrick
  ROWS, A.I. and Kobe BYTEant to AI Jordan. Each win brings a bigger crowd and that player's
  reward, like AI Jordan's AI 1s, Shaq's shattered backboard or the King's crown.
- **Online 1-on-1** with a friend's room code and a 24-second shot clock.
- **My player:** appearance, gear, court styles and seven attributes, with achievements to earn.

### Controls
No buttons, just your body:
- Lean forward to drive, lean back to retreat; you go toward the hand you dribble with.
- Both hands up together, then release over your head to shoot (time it to the green); reach one
  hand high at the rim for a layup (or a dunk, at Finishing 70).
- Crossover, in-and-out or spin with your hands low to break ankles; pump fake to make him jump.
- On defense, lean to step up or sag off, slide sideways, and jump with his release to block.

### How it was made
The camera runs MediaPipe's pose model in the browser; no video is saved or sent. Each frame
becomes a few numbers (arm and knee bends, how high the hands are, the lean), and shots are judged
against your own recorded template, a few hundred bytes of timing and motion. The voxel park is
three.js, the opponents' trash talk is read in the Cortex voice, and online games send only those
few numbers, never video.

<!-- /details -->
