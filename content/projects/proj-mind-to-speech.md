---
title: "Mind-to-Speech"
subtitle: "EEG imagined-speech decoding · Brain-computer interface"
summary: "Classifies EEG brain signals into imagined phrases with a CNN+LSTM (83.33% accuracy), then uses Claude Haiku 4.5 to expand them into natural speech."
tags: [eeg, bci, deep-learning, cnn, lstm, transformers, llm, accessibility, python]
start: 2025-05
end: 2025-11
weight: 3
icon: /images/mind-to-speech/logo.jpg
images:
  - /images/mind-to-speech/eeg-channels.jpg
  - /images/mind-to-speech/topomaps.png
  - /images/mind-to-speech/architecture.png
  - /images/mind-to-speech/lstm-metrics.png
  - /images/mind-to-speech/transformer-metrics.png
  - /images/mind-to-speech/confusion-matrix.png
captions:
  /images/mind-to-speech/eeg-channels.jpg: "EEG channel positions mapped on the brain"
  /images/mind-to-speech/topomaps.png: "EEG readings transformed into topomaps"
  /images/mind-to-speech/architecture.png: "CNN+LSTM architecture"
  /images/mind-to-speech/lstm-metrics.png: "Metrics for the CNN+LSTM model"
  /images/mind-to-speech/transformer-metrics.png: "Metrics for the CNN+Transformer model"
  /images/mind-to-speech/confusion-matrix.png: "Confusion matrix of the CNN+LSTM"
links:
  - { label: "GitHub", url: "https://github.com/edng5/Mind-to-Speech", kind: github }
  - { label: "Dataset (BCI2020)", url: "https://doi.org/10.34740/KAGGLE/DSV/11693877", kind: paper }
related: [skill-ml, skill-llm-apis]
---

## Introduction
EEG is a powerful tool for non-invasive brain-computer interfaces (BCI), particularly for decoding
speech directly from neural signals. This project explores translating EEG data into intelligible
sentences by classifying imagined speech. The motivation is accessibility: enabling people who
cannot verbally communicate to express themselves through thought-driven BCI systems. It uses the
Multi-class imagined speech classification (BCI2020) dataset from the BCI Competition Committee.

## Methods
The dataset has 5 classes of imagined speech: "Hi", "Yes", "Thank you", "Help me" and "Stop",
recorded from 15 subjects aged 20 to 30 across 5 EEG channels; Channel 4 is used for
subject-specific channel selection. EEG signals are split into overlapping windows and mapped into
2D topographic images (topomaps), in both RGB and greyscale variants to test robustness to noise.
The predicted phrase is fed into Claude Haiku 4.5 with a custom personality to generate enriched
speech, spoken aloud with PyTTSx3.

## Architecture
80/10/10 train/validation/test split, 10-fold cross-validation, 150 epochs, learning rate 0.0001,
batch size 32, dropout 0.2.
- Model 1: 3D CNN + LSTM for spatiotemporal EEG sequences (3 convolutional layers with max pooling,
  an LSTM, a dense layer and dropout).
- Model 2: 3D CNN + Transformer encoder (3 convolutional layers with max pooling, two transformer
  blocks with 4 attention heads, a dense layer and dropout).

## Results
The CNN+LSTM performed best with 83.33% overall accuracy; the CNN+Transformer reached 78.33%. RGB
topomaps gave higher accuracy than greyscale. Claude Haiku turned a simple "Hi" into "Hey there!
Great to meet you – I'm Edward, and I'm genuinely excited to chat with you today! What's on your
mind?", streamed into audio in real time.

## Conclusion
The project shows early-stage feasibility of decoding speech from EEG for assistive
communication. It is limited by dataset coverage and the lack of a real-time EEG test environment,
but with more data it could form the basis of a BCI communication tool for people with speech
impairments.
