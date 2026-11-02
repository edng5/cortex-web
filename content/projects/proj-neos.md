---
title: "Neuro Evolution Organism Simulator (NEOS)"
subtitle: "Evolution simulation with the NEAT algorithm"
summary: "An evolution simulator where simple organisms controlled by NEAT neural networks learn to find food, reproduce, and pass their genes to the next generation."
tags: [neuroevolution, neat, genetic-algorithms, simulation, python, artificial-life]
start: 2023-04
end: 2024-03
weight: 2
# A ring makes it stand out on the graph (the simulator runs on the site).
ring: true
# The live simulator: centred beside the panel on desktop, at the top of the panel on phones.
# The original run's GIFs sit under Results.
mediaLayout: sim
cover: /images/neos/neos1.gif
carousels:
  generations:
  - /images/neos/neos1.gif
  - /images/neos/neos2.gif
  - /images/neos/gen-0.gif
  - /images/neos/gen-1.gif
  - /images/neos/gen-2.gif
  - /images/neos/gen-3.gif
  - /images/neos/gen-4.gif
  - /images/neos/gen-5.gif
captions:
  /images/neos/gen-0.gif: "Generation 0"
  /images/neos/gen-1.gif: "Generation 1"
  /images/neos/gen-2.gif: "Generation 2"
  /images/neos/gen-3.gif: "Generation 3"
  /images/neos/gen-4.gif: "Generation 4"
  /images/neos/gen-5.gif: "Generation 5"
links:
  - { label: "GitHub", url: "https://github.com/edng5/neos", kind: github }
related: [edu-queens, skill-ml]
---

## Introduction
**Try it live:** the simulator runs right here. It's one continuous world (generations never cut it
off), and you can pick the evolution algorithm (NEAT, the original genetic algorithm, an evolution
strategy, differential evolution or random search), switch selection, crossover and mutations on and
off, tune the hyperparameters, watch the stats, and save a run to pick up later.

An evolution simulator using the NEAT (NeuroEvolution of Augmenting Topologies) algorithm. It
observes a population of simple organisms (NEOS) learning to eat food. NEOS can reproduce within a
generation to create offspring with shared genes, and at the end of each generation the fittest
NEOS carry their genes into the next one.

## Method
Reproduction happens through crossover and mutation of two parents when they meet in the
environment. Only individuals of high fitness can mate; others are rejected. NEOS that grow too old
die off, which adds pressure through spatial constraints, time, and elitism. After each generation
the top 20% of the population are selected to create the next generation.

## Results
Average fitness rose sharply and peaked around generation 4 (best individual: 37 food eaten,
average 13.34). Generation 0 had a best of 42 and an average of 7.35 food eaten across 129 NEOS.
At generation 6 the whole population died of old age with no new offspring. The NEOS likely reached
a local optimum in their ability to eat food, and once age and the distance between fit individuals
grew too large, the ecosystem collapsed.

| Generation | Best | Average | Survived | Total NEOS |
|---|---|---|---|---|
| 0 | 42 | 7.35 | 20 | 129 |
| 1 | 33 | 10.51 | 49 | 162 |
| 2 | 36 | 12.13 | 4 | 98 |
| 3 | 37 | 11.09 | 6 | 117 |
| 4 | 37 | 13.34 | 4 | 113 |
| 5 | 40 | 11.63 | 21 | 137 |
| 6 | 33 | 12.52 | 0 (final) | 83 |

<!-- carousel: generations -->

## Simulator findings
The live simulator above was swept headlessly: each setting run 3 times for 25 generations, and
scored by the average food a NEOS eats in generations 15–25 (higher is better). With the defaults,
NEAT scores **10.2** and the original genetic algorithm **10.0**; random search, which learns
nothing, scores **5.3**.

**Settings that help**

| Setting | Avg food |
|---|---|
| More food (250) / faster NEOS (max speed 1.0) | 19.2 / 19.6 |
| Uniform crossover, or no crossover at all | 13.5 / 13.1 |
| Differential evolution / evolution strategy | 13.1 / 12.9 |
| Elitism at the top 5% | 12.8 |
| Gaussian mutation at strength 0.5 | 13.1 |
| Fast turning (1440°/s) | 12.5 |
| NEAT growing nodes often (20%) vs never | 11.3 vs 7.5 |

**Settings that hurt**

| Setting | Avg food |
|---|---|
| Elitism at the top 40% / 60% | 6.1 / 4.1 |
| Scarce food (30) | 4.1 |
| Slow turning (180°/s) | 6.6 |
| A single hidden node | 8.0 |
| Letting unfit NEOS breed | 8.0 |
| Gaussian mutation at a small strength (0.1) | 7.9 |
| Tournament or roulette selection | 9.2 / 8.9 |

Strict elitism matters most: breeding only from the very best roughly triples food eaten
compared with letting the top 60% breed. (These scores were measured with the population topped up
by elitism.)

**Surviving on their own.** The live simulator now runs without that top-up by default (it's an
option), and nothing brings an extinct world back. Babies cost food, so NEOS must eat before they
can breed; a NEOS ready to breed goes after a mate it can see (its own species and fitter ones
first; the fittest attract their species from far away) and slows down to meet it. With maturity
at 120 steps, 80 steps' rest between births and one food a baby, and food that comes back at once,
herbivores alone grow until they fill the world (random search too, on numbers alone, though it doesn't get any better at
eating), while any population with too little food, too short a life or too dear babies dies out. The original's settings (maturity at 200, rest of 150) die out within two
generations, the same collapse the original hit at generation 6. When litter size, maturity and
rest evolve, NEOS settle on litters of about 3, mature later (around 400 steps, buying a longer
life) and rest less. Blending both parents' weights (the original's
crossover) does worse than taking each weight whole, because averaging pulls every baby toward the
middle.

**The balanced defaults.** The simulator starts (and its ⚖ button resets) with NEAT, omnivores
and carnivores on, and food regrowing at 10 a second, without topping up: in 6 of 6 test runs,
herbivores (about 30–95), omnivores and carnivores were all still going at generation 40.

**Predators in balance.** Predators used to overrun the prey and the whole world collapsed. Five
checks fixed it, as in real ecosystems: a hunter digests after a kill before hunting again, prey
converts poorly into babies (a carnivore needs two kills per baby share), omnivores get half as much
from plants and only hunt when hungry, predators are no faster than prey, and meat-eaters' babies
drift back to eating plants the more common meat-eaters get. With food regrowing at 6–20 a second,
every run held an equilibrium without topping up: herbivores the majority, and carnivores rising
and falling (about 4–30) in predator–prey cycles over 60 generations.

**Predators.** With plenty of food, no predators take hold. With food regrowing at 3 a second,
omnivores appear (1–16 at a time) and some become carnivores (up to 5); with omnivores turned off,
carnivores appear directly (3–25). Once the refill bred only from the living, prey evolved to turn
away from hunters almost every time in 5 of 6 runs. Hand-wired prey that flee escape 56% of chases,
against 29% for ones that turn toward the hunter.

**Body size.** With hunters about, herbivores grew larger (×1.2–2.0, where a lone smaller hunter
can't eat them). Without hunters, size just drifted (×0.6–1.5), as being big only costs energy.

**Hunger and size, as in real ecosystems.** Every NEOS can starve: herbivores need to eat often,
omnivores less so, and carnivores can go twice as long between kills (and digest after one). Small
NEOS have big litters of cheap babies; big ones have fewer, dearer babies and rest longer between
births, but store more food, so they last longer between meals. With all of that on, herbivore sizes
spread out (about ×0.7 to ×1.7) instead of all going one way, and most herbivores that die starve
rather than get eaten, while carnivores almost never starve.
