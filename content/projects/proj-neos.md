---
title: "Neuro Evolution Organism Simulator (NEOS)"
subtitle: "Evolution simulation with the NEAT algorithm"
summary: "An evolution simulator where simple organisms controlled by NEAT neural networks learn to find food, reproduce, and pass their genes to the next generation."
tags: [neuroevolution, neat, genetic-algorithms, simulation, python, artificial-life]
start: 2023-04
end: 2024-03
weight: 2
# Desktop: show the generation GIFs in a carousel instead of the floating pile.
mediaLayout: carousel
images:
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
