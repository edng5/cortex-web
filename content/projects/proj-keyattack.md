---
title: "KeyAttack"
subtitle: "Acoustic keyboard side-channel attack · team project"
summary: "A team project implementing a deep-learning acoustic side-channel attack that identifies laptop keystrokes from their sound, trained and tested on public and self-recorded keystroke audio."
start: 2023-11
end: 2023-12
tags: [security, side-channel, deep-learning, audio, pytorch, coatnet, python, research]
weight: 2
images: []
videos:
  - https://youtu.be/8WNH14IboPQ
captions:
  https://youtu.be/8WNH14IboPQ: "Identifying Keystrokes with Deep Learning: the team's presentation"
links:
  - { label: "GitHub", url: "https://github.com/kevin-zhang02/KeyAttack", kind: github }
  - { label: "Original paper (arXiv)", url: "https://arxiv.org/pdf/2308.01074v1.pdf", kind: paper }
related: [skill-ml, skill-pytorch, skill-python, skill-rnd]
---

## Overview
KeyAttack is a team project by Curtis Heinzl, Edward Ng, Kevin Zhang and Nayan Bhasin (led by Kevin) that implements the
approach from the paper "A Practical Deep Learning-Based Acoustic Side Channel Attack on Keyboards".
The idea: the sound of each key press is distinctive enough that a deep learning model can work out
what was typed from an audio recording, for example from a nearby phone or a Zoom call. The paper
reports 95% accuracy on keystrokes recorded by a nearby phone and 93% over Zoom, and proposes ways
to protect against such attacks.

## How it works
Keystroke audio is converted into WAV clips and classified with a CoAtNet model (a hybrid of
convolution and attention) built in PyTorch. Parts of the project build on the open-source
Keystroke-Datasets (MacBook Pro and Zoom recordings) and DeepKeyAttack repositories, and the team
also recorded their own keystroke datasets on different keyboards, including a MacBook Pro and a
mechanical keyboard. Test scripts evaluate the model per key (confusion matrix, accuracy,
precision, recall and F1), interpret predictions back into text, and a typing aid prompts one
character at a time to collect clean recordings.

## Presentation
The team presented the project in "Identifying Keystrokes with Deep Learning" (video on this page).
