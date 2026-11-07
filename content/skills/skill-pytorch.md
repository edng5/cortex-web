---
title: "PyTorch & TensorFlow"
subtitle: "AI / ML"
summary: "PyTorch for BMO's document-processing models, DocVision, KeyAttack and Summarize; TensorFlow (Keras) for Mind-to-Speech's EEG models."
tags: [skill, pytorch, tensorflow, deep-learning]
weight: 1
icon: /images/skills/pytorch.svg
images: []
links: []
related: [exp-bmo-tech-lead, exp-bmo-lead-dev, proj-docvision, proj-keyattack, proj-mind-to-speech, proj-summarize, skill-ml]
---

**PyTorch**
- **At BMO:** the machine learning models for automated document processing (classification and
  information extraction).
- **DocVision:** a LayoutLMv3 backbone with small LoRA adapters for page classification and field
  extraction, served from one model at about 50 pages a second.
- **KeyAttack:** a CoAtNet model trained on mel spectrograms of keystroke audio, to work out what
  was typed from a recording.
- **Summarize:** Pegasus summaries through Hugging Face Transformers' PyTorch backend.

**TensorFlow (Keras)**
- **Mind-to-Speech:** the 3D CNN + LSTM and CNN + Transformer models that classify imagined speech
  from EEG topomaps (83.33% accuracy for the CNN + LSTM).
