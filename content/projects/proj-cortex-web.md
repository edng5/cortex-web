---
title: "Cortex-Web"
subtitle: "Interactive portfolio · this website · 2026"
summary: "This website: Edward's career mapped as a living network of neurons, with Cortex, a voice AI assistant that answers questions about him using retrieval-augmented generation and Google's Gemini (with Claude supported)."
start: 2026-10
tags: [svelte, sveltekit, typescript, llm, rag, voice, data-visualization, gemini, claude, sqlite, security, oauth, d3]
weight: 2
icon: /images/cortex-web/graph.png
images: []
links:
  - { label: "GitHub", url: "https://github.com/edng5/cortex-web", kind: github }
related: [proj-cortex-discord, skill-typescript, skill-llm-apis, skill-rag]
---

## Overview
Cortex-Web is Edward's interactive portfolio. Instead of pages, his experience, education, projects,
skills, publications and interests are neurons in a force-directed graph that drifts and glows.
A neuron's size reflects its importance and how many connections it has. Related neurons are linked
both by hand and automatically, using text embeddings of their content. The site is named after
Edward's earlier Discord assistant, also called Cortex.

## Exploring
- Click any neuron to open its details. On desktop, its pictures float beside the panel as a pile of
  draggable cards you can rearrange; on phones they sit inside the panel.
- Some neurons have their own layouts: photography opens a large centred gallery, NEOS runs a live
  simulator, E.Ngine Games opens its games menu, and the Pokémon neuron poses its cut-outs like a
  team photo, with flyers in the air and the rest on the ground.
- Click a legend colour to glide that type into a line on the left, ordered by date or by size.
- The header has rotating titles, a timeline of Edward's work experience, and a floating deck of all
  his projects ordered by size.

## Talking to Cortex
Visitors can type, or turn on the microphone and talk, and Cortex answers out loud while the most
relevant neuron opens. The neurons speed up while Cortex listens and light up as it thinks and speaks.

- **Retrieval:** the question is embedded and matched against a vector store of Edward's content.
  Neurons named in the question, such as a project's title or an employer, are boosted, so
  made-up names the embedding model has never seen are still found.
- **Answering:** Google's Gemini (Flash-Lite by default, chosen for fast spoken replies) streams the
  answer in Cortex's own personality. Claude can be switched in with one setting.
- **Guardrails:** Cortex only answers questions about Edward and itself, and turns chat off for
  anyone who asks something explicit or inappropriate.
- **Traffic:** each visitor gets one live answer at a time, and when many people ask at once, extra
  questions wait in a short queue instead of failing.

## Accounts
- Visitors get five free questions. Signing in with Google or a one-time email link gives ten a day.
- Emails, names and questions are encrypted at rest, sessions are stored only as hashes, and an
  audit log of sign-ins and questions is kept for 90 days.

## Architecture
![Cortex-Web system design: the browser, the SvelteKit server, SQLite, external services and the content pipeline](/images/cortex-web/architecture.svg)

- **Browser:** the SvelteKit client draws the neuron graph and runs Cortex's voice, the games,
  SpeakEase AI and the NEOS simulator. Game progress is saved locally and synced to the account.
- **Server:** one SvelteKit app on Node serves the pages and the APIs: Cortex's answers (retrieval,
  then a streamed reply), sign-in, game saves and leaderboards, the FishMart market and SpeakEase AI.
  Rate limits, a question queue, encryption and an audit log sit in front of them.
- **Data:** one SQLite database holds accounts, limits, saves (with daily backups), leaderboards and
  the market.
- **Content:** each neuron is a Markdown file. An ingest step embeds them into a vector store (for
  Cortex's search) and finds related neurons (the graph's links), which the server loads at start.

## Tech
SvelteKit and TypeScript, d3-force on HTML canvas, the Web Speech API for voice, transformers.js
embeddings with a JSON vector store, the Gemini API (with a Claude API option), SQLite, Google
OAuth and SMTP email for sign-in, on Node (adapter-node).
