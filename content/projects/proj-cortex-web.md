---
title: "Cortex-Web"
subtitle: "Interactive portfolio · this website · 2026"
summary: "This website: Edward's career mapped as a living network of neurons, with Cortex, a voice AI assistant that answers questions about him using retrieval-augmented generation and a large language model (Gemini, with Claude supported)."
start: 2026-10
tags: [svelte, typescript, llm, rag, voice, data-visualization, claude, sqlite, security, oauth, gemini]
weight: 2
icon: /images/cortex-web/graph.png
images: []
links: []
related: [proj-cortex-discord, skill-typescript, skill-llm-apis, skill-rag]
---

## Overview
Cortex-Web is Edward's interactive portfolio. Instead of pages, his experience, education, projects,
skills, publications and interests are neurons in a force-directed graph that drifts and glows.
Related neurons are linked by connections, computed from the meaning of their content using text
embeddings. It's named after Edward's earlier Discord assistant, also called Cortex.

## Exploring
- Click any neuron to open its details, with pictures and videos floating alongside as a pile of
  draggable cards, a lightbox for full-size images, and carousels for larger galleries.
- Click a legend colour to line that type up on the left, ordered by date (most recent first) or by
  importance, while everything else glides to the right.
- The header opens a timeline of Edward's work experience and a floating deck of all his projects.

## Talking to Cortex
Visitors can type or turn on the microphone and ask Cortex a question. The question is embedded, the
most relevant passages are retrieved from a vector store of Edward's content, and a large language model (Gemini) answers out
loud in Cortex's own personality while the most relevant neuron opens. The neurons speed up while
Cortex listens and light up as it thinks and speaks. Guardrails keep Cortex to questions about Edward
and itself, and turn chat off for anyone who asks something explicit or inappropriate.

## Accounts and members
Visitors get a few free questions; signing in with Google or a one-time email link raises the daily
limit, and whitelisted members unlock a hidden surprise. Personal data such as emails and questions
is encrypted at rest, sessions are stored only as hashes, and an audit log of sign-ins and questions
is kept for 90 days.

## Tech
SvelteKit and TypeScript, d3-force on HTML canvas, the Web Speech API for voice, transformers.js
embeddings with a JSON vector store, the Gemini API (with a Claude API option), and SQLite for accounts, question limits and
the audit log.
