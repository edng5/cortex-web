---
title: "LeGM-CP"
subtitle: "Fantasy basketball draft assistant · MCP"
summary: "A Model Context Protocol (MCP) server with a Next.js UI that uses Claude to recommend fantasy basketball draft picks from rankings, live stats and punt strategies."
tags: [mcp, llm, claude, nextjs, fantasy-basketball, sports-analytics, prompt-engineering, typescript]
start: 2025-08
end: 2025-09
weight: 2
icon: /images/legm-cp/logo.jpg
images:
  - /images/legm-cp/demo.png
  - /images/legm-cp/architecture.svg
captions:
  /images/legm-cp/demo.png: "LeGM-CP draft UI"
  /images/legm-cp/architecture.svg: "Architecture: Claude + Next.js host, MCP server with tools, resources and prompts"
links:
  - { label: "GitHub", url: "https://github.com/edng5/LeGM-CP", kind: github }
related: [skill-mcp, int-basketball, skill-llm-apis, skill-prompting]
---

## Overview
LeGM-CP is a Model Context Protocol (MCP) project with a dedicated UI for drafting in fantasy
basketball. It started from Edward's own struggles in fantasy leagues: he kept losing and realized
he needed AI-powered help with his drafting strategy. Combining projected player rankings,
real-time player statistics and customized punt strategies, it gives data-driven recommendations
for building a well-balanced team.

## Implementation
LeGM-CP uses a client-server architecture: Next.js powers the frontend and the MCP framework
handles communication, with page routing connecting the two. It combines resources and tools,
including PDFs of last year's and this year's projected player rankings for context and tools
that retrieve live player statistics. A structured prompt template embeds league rules and uses
meta prompting to generate draft strategies, which run through Claude 3.7 Sonnet to synthesize
stats, rankings and strategy into draft picks that fit the user's team.

## Conclusion
With the NBA season not yet started at the time of writing, real-world results were still to come,
but LeGM-CP already builds well-structured teams that follow logical punt strategies, showing how
LLM reasoning combined with structured sports data can make drafting more competitive and fun.
