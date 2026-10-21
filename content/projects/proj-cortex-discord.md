---
title: "Cortex (Discord Assistant)"
subtitle: "Conversational AI bot for Discord"
summary: "A Discord chatbot powered by OpenAI GPT-3.5 with persistent memory, plus image search, music, weather, news, reminders, polls, a price predictor and a Pokémon card grader."
tags: [llm, openai, discord-bot, chatbot, web-scraping, sentiment-analysis, computer-vision, pokemon]
start: 2023-02
end: 2025-05
weight: 2
icon: /images/cortex-discord/cortex.jpg
images:
  - /images/cortex-discord/image-search-1.png
  - /images/cortex-discord/image-search-2.png
  - /images/cortex-discord/price-predictor.png
  - /images/cortex-discord/card-grader.png
captions:
  /images/cortex-discord/image-search-1.png: "Image search"
  /images/cortex-discord/price-predictor.png: "Price predictor"
  /images/cortex-discord/card-grader.png: "Pokémon card grader"
links:
  - { label: "GitHub", url: "https://github.com/edng5/cortex", kind: github }
related: [int-pokemon, skill-llm-apis, proj-cortex-web]
---

## Overview
Cortex is a conversational AI chatbot designed for Discord that works as a versatile virtual
assistant. It uses the OpenAI GPT-3.5 API to generate intelligent, context-aware replies, with
persistent memory that lets it maintain in-depth conversations over time. It answers general
questions, provides real-time information, and engages users in natural dialogue. Beyond
conversation, it can play music, find songs from lyrics, check the weather, retrieve the latest
news, set reminders, and create polls.

## Image search
Users can request images with a simple message. Cortex uses Puppeteer to scrape Google Images for
the prompt; the query has its stop words removed first for cleaner results, and Cortex returns a
random image from the top 10 results.

## Price predictor
Uses regression analysis and sentiment analysis to forecast prices for both the stock market and
Pokémon cards over the upcoming week. Sentiment comes from news articles scraped with a news API
and from set-release websites for Pokémon cards, combining quantitative and qualitative signals.

## Card grader
Users upload a photo of a Pokémon card; Cortex assesses its condition from centering, edge wear
and surface quality, assigns a grade, then queries the Pokémon TCG API for the card's estimated
market value at that grade, giving casual collectors a quick estimate.
