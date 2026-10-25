---
title: "E.Ngine Games"
subtitle: "Top Gun · Fishy · Space Invaders · Frogger · Pong × Brick Breaker · I Spy · Made in high school"
summary: "A collection of games Edward made in high school. Five of them (Top Gun, Fishy, Space Invaders, Frogger and Pong × Brick Breaker) are playable right here as E.Ngine Games, ported from Java and Python to TypeScript, with global leaderboards."
tags: [game-development, java, typescript, python, pygame, games, high-school]
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
Edward's high-school Java and Python games, rebuilt to play in the browser on a computer. Each
game's code was ported to TypeScript and draws on a canvas, keeping the original art, menus and
gameplay (Frogger got all-new 3D graphics). Movement uses W, A, S and D instead of the arrow keys,
and the menus are clicked. Every game has its own original soundtrack and sound effects.
Signed-in players choose a leaderboard name and their best scores go on global leaderboards
for each game.

## ![](/images/mini-games/top-gun.jpg) Top Gun

A flight-combat simulation game where the player completes missions against waves of fighter jets
to win the war. Players progress through three missions of varying difficulty, earning money for
upgrades to health, missiles, guns and evasive moves (W, A, S and D to fly, Space for guns, Shift
for missiles).

## ![](/games/icons/fishy.png) Fishy
An underwater survival game: eat smaller fish to grow, and avoid anything bigger. Medium adds
sharks and Hard adds fishing hooks; eating a shark or beating Hard unlocks new characters. There
is also a two-player mode where players race to grow and then eat each other. In the browser
version, collisions are pixel-perfect: fish only touch where their bodies actually meet, not
where their bounding boxes overlap.

## ![](/images/mini-games/space-invaders.jpg) Space Invaders

A remake of the classic arcade game: the player controls a spaceship at the bottom of the screen,
shooting down waves of descending alien invaders while dodging their projectiles. It has
destructible bunkers, a bonus mothership and an unlockable ship, and three difficulties: Normal,
Hard (with boss fights) and No Shields (Hard without the bunkers).

## ![](/games/icons/frogger-panel.png) Frogger
Edward's Grade 10 Python (pygame) game: get the frog across a busy road and a river of logs to the
five lily pads at the top, before time runs out. The browser version is rebuilt with chunky 3D
block graphics in the spirit of Crossy Road, one hop per key press, levels that speed up each time
all five lily pads are filled, and diving turtles. Coins picked up along the way buy rolls of a
gumball machine that unlocks 10 swamp animals to play as, from a toad and a turtle to a baby
alligator, a heron and a dragonfly.

## ![](/games/icons/pong.png) Pong × Brick Breaker
Two paddle games in one. In Pong, the ball speeds up, the paddle shrinks and a second ball joins
as the score climbs; in Brick Breaker, the goal is to clear all 50 bricks.

## ![](/images/mini-games/i-spy.jpg) I Spy

The classic children's game I Spy, where the user chooses an object of a specific colour and the
computer has to guess what that object is.
