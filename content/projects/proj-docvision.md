---
title: "DocVision"
subtitle: "Multimodal document AI · LayoutLMv3 + LoRA · 2026"
summary: "Document AI for multi-document business packets. One pretrained LayoutLMv3 backbone is loaded once and serves a page classifier plus eight field extractors as tiny swappable LoRA adapters, with no LLM, so PII never leaves the encoder pipeline."
start: 2026-10
tags: [document-ai, computer-vision, layoutlmv3, multimodal, lora, ocr, transformers, pytorch, python, research]
weight: 2.7
icon: /images/docvision/icon.png
images: []
links:
  - { label: "GitHub", url: "https://github.com/edng5/DocVision", kind: github }
related: [exp-bmo-tech-lead, proj-mind-to-speech, proj-neos, proj-keyattack, proj-summarize, skill-rnd, skill-ml, skill-pytorch, skill-python, skill-opencv]
---

## Overview
DocVision reads business document packets: invoices, purchase orders, shipping orders, inventory
reports, bank statements, cheques, pay stubs and utility bills. It takes page images and their OCR
and works in three stages:

1. **Pretrain** LayoutLMv3, a multimodal encoder that attends jointly to words, their 2D positions
   on the page and the pixels, on unlabelled pages using span-masked language modelling and masked
   image modelling.
2. **Plug in small task models** on the frozen backbone: a document classifier that labels every
   page of a bundle and finds where each document starts, plus one field extractor per document
   type. Each is a LoRA adapter with a small head.
3. **Serve** everything from one backbone loaded once. Switching tasks just swaps the active
   adapter, in about 0.6 ms, roughly 1,500 times faster than loading another model.

No LLM is used anywhere, so pages containing personal information never leave the encoder pipeline.

## Results
Trained and tested on deliberately degraded "bad scan" pages (skew, stains, blur, JPEG artefacts),
re-OCR'd so that real OCR errors are part of the data. 2,353 bundles and 7,064 pages, split by bundle.

- **Classification:** perfect page accuracy and document boundary detection on the test set.
- **Field extraction:** entity F1 of 0.988 to 0.999 per document type, 0.995 on average.
- **End to end:** 82.1% of returned values match the true value, which is 100% of what the OCR
  makes possible. The remaining error comes entirely from OCR, not the model.
- **Not memorising:** recall on values never seen in training stays above 0.99.
- **Small and fast:** each task adapter is 1.7 MB; the whole serving bundle is 263 MB in fp16.
  About 50 pages per second on an RTX 4070.

## Research
The project is run as an experiment, not just a pipeline. It includes a leakage and memorisation
audit, explaining why a clean template-based baseline scored perfectly, a noise study, and
ablations of the backbone pretraining (full, none, MLM only, MIM only). On this data, domain
pretraining made no measurable difference: the public weights plus LoRA already solved the
layouts. Edward notes it should matter more for handwriting or unfamiliar layouts.

## Tech
Python, PyTorch, Hugging Face LayoutLMv3, a custom multi-adapter LoRA, docTR OCR, and a fully
executed Jupyter notebook with every result.
