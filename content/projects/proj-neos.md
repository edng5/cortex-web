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
An evolution simulator where simple organisms (NEOS), each driven by a small neural network, learn
to find food, breed and pass on their genes. **Try it live above:** pick the algorithm, tune the
settings, draw walls, and save runs.

## Method
Two fit NEOS that meet have a baby by crossover and mutation; NEOS die of old age. In the original,
the top 20% of each generation seeded the next.

## Results
Average fitness rose until generation 4 (best 37, average 13.34), then the population aged out
with no offspring and collapsed at generation 6, likely stuck at a local optimum.

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
Each setting was run 3 times for 25 generations and scored by average food eaten (NEAT 10.2,
original GA 10.0, random search 5.3).

| Helps | Avg food | Hurts | Avg food |
|---|---|---|---|
| More food (250) | 19.2 | Elitism at top 60% | 4.1 |
| Faster NEOS | 19.6 | Scarce food (30) | 4.1 |
| Uniform crossover | 13.5 | Slow turning | 6.6 |
| Differential evolution | 13.1 | One hidden node | 8.0 |
| Elitism at top 5% | 12.8 | Unfit NEOS breeding | 8.0 |

- **Strict elitism matters most:** breeding only the best roughly triples food eaten.
- **No safety net:** worlds without enough food, life or breeding die out, as the original did.
- **Predators in balance:** digestion, poor conversion of prey into babies, and meat-eaters
  reverting to plants keep herbivores, omnivores and carnivores in predator–prey cycles (the
  ⚖ balanced defaults held in 6 of 6 runs).
- **Prey learn to flee:** in 5 of 6 runs, prey evolved to turn away from hunters.
- **Size trade-offs:** small NEOS have big litters; big ones last longer between meals and resist
  lone hunters, so sizes spread out (×0.7–1.7).
