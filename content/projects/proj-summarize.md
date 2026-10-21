---
title: "Summarize"
subtitle: "Text summarizer for PDFs · 2023"
summary: "A Python app that summarizes PDFs, text files and journal websites into a PDF, using either an extractive TextRank summary or an abstractive Pegasus transformer summary."
start: 2023-01
end: 2023-11
tags: [nlp, summarization, transformers, pegasus, spacy, python, pdf, tkinter]
weight: 1
images: []
links:
  - { label: "GitHub", url: "https://github.com/edng5/summarize", kind: github }
related: [skill-ml, skill-python]
---

## Overview
Summarize, built by Edward in 2023, condenses text and extracts the key information into a PDF. It
works with PDFs, text files and journal websites.

## Two ways to summarize
- **Extractive:** a TextRank algorithm picks out the most important sentences and compiles them
  into a summary.
- **Abstractive:** a pretrained Pegasus transformer model tries to understand the meaning of the
  text and writes a summary in its own words.

## Tech
Python with spaCy (the en_core_web_sm model), Hugging Face Transformers (Pegasus) and a Tkinter
desktop interface.
