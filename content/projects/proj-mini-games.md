---
title: "E.Ngine Games"
subtitle: "Top Gun · Fishy · Space Invaders · Pong × Brick Breaker · I Spy · Made in high school"
summary: "A collection of games Edward made in high school. Four of them (Top Gun, Fishy, Space Invaders and Pong × Brick Breaker) are playable right here as E.Ngine Games, ported from Java to TypeScript, with global leaderboards."
tags: [game-development, java, typescript, python, pygame, games, high-school]
weight: 2
icon: /games/engine-card.svg
mediaLayout: arcade
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
Edward's high-school Java games, rebuilt to play in the browser on a computer. Each game's Java
code was ported to TypeScript and draws on a canvas, keeping the original art, menus and
gameplay. Movement uses W, A, S and D instead of the arrow keys, and the menus are clicked.
Signed-in players choose a leaderboard name and their best scores go on global leaderboards
for each game.

## Top Gun
![Top Gun logo](/images/mini-games/top-gun.jpg)

A flight-combat simulation game where the player completes missions against waves of fighter jets
to win the war. Players progress through three missions of varying difficulty, earning money for
upgrades to health, missiles, guns and evasive moves (W, A, S and D to fly, Space for guns, Shift
for missiles).

## Fishy
An underwater survival game: eat smaller fish to grow, and avoid anything bigger. Medium adds
sharks and Hard adds fishing hooks; eating a shark or beating Hard unlocks new characters. There
is also a two-player mode where players race to grow and then eat each other. In the browser
version, collisions are pixel-perfect: fish only touch where their bodies actually meet, not
where their bounding boxes overlap.

## Space Invaders
![Space Invaders logo](/images/mini-games/space-invaders.jpg)

A remake of the classic arcade game: the player controls a spaceship at the bottom of the screen,
shooting down waves of descending alien invaders while dodging their projectiles. It has
destructible bunkers, a bonus mothership and an unlockable ship, and three difficulties: Normal,
Hard (with boss fights) and No Shields (Hard without the bunkers).

## Pong × Brick Breaker
Two paddle games in one. In Pong, the ball speeds up, the paddle shrinks and a second ball joins
as the score climbs; in Brick Breaker, the goal is to clear all 50 bricks.

## I Spy
![I Spy logo](/images/mini-games/i-spy.jpg)

The classic children's game I Spy, where the user chooses an object of a specific colour and the
computer has to guess what that object is.
