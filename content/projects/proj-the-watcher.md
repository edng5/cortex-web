---
title: "The Watcher"
subtitle: "Google Gemini Long Context competition · Kaggle"
summary: "Uses Gemini's 2-million-token context window over MCU transcripts to recommend which Marvel movies and shows you actually need to watch."
tags: [llm, gemini, long-context, kaggle, marvel, recommendation, web-scraping]
start: 2024-12
end: 2024-12
weight: 2
images: []
videos:
  - https://www.youtube.com/watch?v=NY0BU2m-3ZI
captions:
  https://www.youtube.com/watch?v=NY0BU2m-3ZI: "The Watcher demo"
links:
  - { label: "GitHub", url: "https://github.com/edng5/the-watcher/tree/main", kind: github }
related: [int-marvel, skill-llm-apis]
---

Edward's entry to the Google Gemini Long Context Competition on Kaggle recommends the most relevant
MCU movies so viewers can save time while staying on top of the main storyline. It leverages
Gemini's 2-million-token context window and content caching to build a tool for casual MCU fans,
letting them skip watching all 34 movies and 11 TV shows while still grasping the core narrative.

The project uses web scraping and a Kaggle dataset of MCU transcripts as input to answer key
questions: whether a story is essential to the overall MCU narrative, which movies are
prerequisites, and which plot points matter for future developments. Gemini analyzed the
transcripts effectively and recommended movies successfully, showing its potential for processing
very long inputs.
