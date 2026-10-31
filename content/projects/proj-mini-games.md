---
title: "E.Ngine Games"
subtitle: "Top Gun · Fishy · Space Invaders · Frogger · Pong × Brick Breaker · FishMart · I Spy"
summary: "E.Ngine Games: six games playable right here on the site. Five are games Edward made in high school (Top Gun, Fishy, Space Invaders, Frogger and Pong × Brick Breaker), ported from Java and Python to TypeScript with global leaderboards, plus FishMart, a new fish-store sim with a global showcase and market."
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
Six games to play right on this site: open them with the PLAY button in the header (or this node's
Play button). Five are Edward's high-school Java and Python games, rebuilt to play in the browser;
the sixth, FishMart, is new. Each game's code was
ported to TypeScript and draws on a canvas, keeping the original art, menus and gameplay (Frogger
got all-new 3D graphics). On a computer, movement uses W, A, S and D instead of the arrow keys and
the menus are clicked; on phones and tablets, a translucent on-screen joystick and buttons take
over, and the game fills the screen's width. Every game has its own original soundtrack and
sound effects.
Signed-in players choose a leaderboard name and their best scores go on global leaderboards
for each game, with monthly boards too. Progress (coins, upgrades, unlocked characters, settings
and FishMart stores) is saved in the browser and, when signed in, synced to the player's account
so it's the same on phone and computer. On phones, the page stays put (no scrolling) while you
play.

## ![](/images/mini-games/top-gun.jpg) Top Gun

A flight-combat simulation game where the player completes missions against waves of fighter jets
to win the war. Players progress through three missions of varying difficulty (fighter jets, then
ships, then an army base), earning money for upgrades to health, missiles, guns and evasive moves.

How to play: W, A, S and D to fly, Space to fire the guns, Shift for a missile, Enter to pause;
menus are clicked. On phones, a joystick flies the jet and on-screen buttons fire. Each mission
has its own leaderboard.

## ![](/games/icons/fishy.png) Fishy
An underwater survival game: eat smaller fish to grow, and avoid anything bigger. Medium adds
sharks and Hard adds fishing hooks; eating a shark or beating Hard unlocks new characters. There
is also a two-player mode where players race to grow and then eat each other. In the browser
version, collisions are pixel-perfect: fish only touch where their bodies actually meet, not
where their bounding boxes overlap.

How to play: W, A, S and D to swim (player 2 uses the arrow keys), Enter to play again. Eat fish
smaller than you, avoid anything bigger. Easy, Medium and Hard each have a leaderboard.

## ![](/images/mini-games/space-invaders.jpg) Space Invaders

A remake of the classic arcade game: the player controls a spaceship at the bottom of the screen,
shooting down waves of descending alien invaders while dodging their projectiles. It has
destructible bunkers, a bonus mothership and an unlockable ship, and three difficulties: Normal,
Hard (with boss fights) and No Shields (Hard without the bunkers).

How to play: A and D to move, Space to shoot, Shift to pause. Hide behind the bunkers, shoot the
mothership for bonus points, and clear every wave. Each difficulty has its own leaderboard.

## ![](/games/icons/frogger-panel.png) Frogger
Edward's Grade 10 Python (pygame) game, rebuilt with chunky 3D block graphics in the spirit of
Crossy Road, with two modes. Classic (timed) is the original: get the frog across a busy road and
a river of logs to the five lily pads at the top before time runs out, with levels that speed up
each time all five are filled. Endless is a Crossy Road-style hop forward through randomly
generated grass, roads, railways with trains, and rivers of logs or lily pads, for as far as you
can go. Characters turn to face where they hop, and coins picked up along the way buy rolls of a
gumball machine that unlocks 10 swamp animals to play as, from a toad and a turtle to a baby
alligator, a heron and a dragonfly. On phones, it's tap to hop and swipe to turn.

How to play: W, A, S and D to hop (Enter to pause). Time your hops between cars and trains, ride
logs and lily pads across the water (falling in ends the run), and grab coins. Classic and Endless
each have a leaderboard.

## ![](/games/icons/pong.png) Pong × Brick Breaker
Two paddle games in one. In Pong, the ball speeds up, the paddle shrinks and a second ball joins
as the score climbs; in Brick Breaker, the goal is to clear all 50 bricks.

How to play: A and D (or the mouse, or the on-screen stick on phones) to move the paddle, Space to
serve, Enter for the menu after a game over. Keep the ball in play; each game has a leaderboard.

## ![](/games/icons/ifish.png) FishMart
A fish-store simulation, new for the site (not a high-school game): run your own aquarium shop
with 800+ real fish species, from guppies and neon tetras to arowanas and stingrays, in seven
rarities (Common, Uncommon, Rare, Ultra-rare, Epic, Legendary and Mythic). It works with a mouse or
touch, keeps running while you're away (timed tasks finish and customers keep buying), and has
its own soundtrack that changes between the store, fishing and the market.

How to play FishMart:
- Store: build sale tanks (Nano up to Giant, and Giant tanks upgrade to a Mega tank for XXL fish),
  fresh or salt water, tropical or cold, and stock them with fish. Customers buy from the sale
  tanks and the supply shelf (fish food, water conditioner, filters, nets). Keep tanks clean and
  plants trimmed, place decorations, and expand the store's floor as it grows.
- Shipments: buy supplier crates (3 random fish each, a gacha) and seasonal event crates, and open
  free daily gifts in the morning, afternoon and evening. Rare treasure chests hold mythic
  decorations and the current season's limited edition.
- Show tank: build up to five show tanks (upgrade them up to level 10, or combine two into a bigger
  one) to make the store popular, with decorations, plants and a partner fish: a pet centrepiece
  you name, feed and play with to raise its bond.
- Staff: hire builders, aquarists, senior aquarists (who clean and restock on their own) and
  research scientists, up to 8 people.
- Fish wiki and research: every species you've had goes in the wiki; scientists research fish up
  to level 5 in a lab, after which you can order that fish directly.
- Breeding: a breeding tank pairs a male and a female. Babies can come out albino, crosses within
  a genus can make hybrids, two Magikarp can make a Shiny Magikarp, and crossing a Platinum Arowana
  with an Albino Silver Arowana can make the mythic Celestial Dragon Arowana.
- Fishing: a Stardew Valley-style minigame. Cast (bait costs a little cash), wait for a bite, then
  hold (Space, the left mouse button or a finger) to keep the green bar on the fish until the catch
  meter fills. Rarer fish dart about more and the bar is smaller; legendaries live out there.
- Market: list your rare fish for other players to buy (for cash or gems) and buy theirs, and walk
  around other players' stores in the global showcase, which shows off each player's favourite
  show tank and partner fish.
- Some fish eat smaller tank mates, so check who you put together (alligator gars spare the
  legendary stingrays).

## ![](/images/mini-games/i-spy.jpg) I Spy

The classic children's game I Spy, where the user chooses an object of a specific colour and the
computer has to guess what that object is. (I Spy isn't playable on the site; its code is on GitHub.)
