---
title: "Surprise!"
subtitle: "Members only"
summary: "A little something for members: Edward's YouTube playlist."
tags: [surprise, youtube, playlist, video-editing, friends]
weight: 2
# Only logged-in members (emails in MEMBER_EMAILS) can see this node.
membersOnly: true
# Clicking the node opens this playlist in a large player. The URL is kept out of the public
# repo: set SURPRISE_PLAYLIST_URL in .env (or the host's environment variables).
playlist: env:SURPRISE_PLAYLIST_URL
images: []
links:
  - { label: "Watch on YouTube", url: "env:SURPRISE_PLAYLIST_URL", kind: video }
related: [about-edward, int-video-editing]
---

A members-only surprise: Edward's "Chilling w/ Friends" playlist, his videos of hanging out and
gaming with friends.
