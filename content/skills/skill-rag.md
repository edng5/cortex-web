---
title: "Retrieval-Augmented Generation (RAG)"
subtitle: "AI / ML"
summary: "Grounding LLM answers in a searchable knowledge base, as in the Cortex assistant on this website."
tags: [skill, rag, llm, embeddings, vector-database, retrieval, genai]
weight: 2
images: []
links: []
related: [proj-cortex-web, skill-llm-apis]
---

Edward builds retrieval-augmented generation (RAG) systems that ground LLM answers in real data
instead of the model's memory. Cortex, the assistant on this website (Cortex-Web), is one example:
his experience, projects and interests are split into chunks, embedded into a vector store, and the
most relevant chunks are retrieved for each question so Claude answers only from his own content.
His LeGM-CP project similarly feeds ranking documents to Claude as context through MCP resources.
