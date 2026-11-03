---
title: "SpeakEase AI"
subtitle: "Language-learning app · iOS & Android · now playable on the web"
summary: "A language-learning app where users practise conversation by talking with Easso, an AI companion that gives feedback on pronunciation, sentence structure and grammar in 10+ languages. The mobile apps have reached end of support, and the full app is now playable on this site."
start: 2024-01
end: 2025-01
tags: [mobile-apps, react-native, llm, speech, language-learning, startup, typescript, nodejs]
weight: 3
# A ring makes it stand out on the graph (the app is playable on the site).
ring: true
icon: /images/speakease/icon.png
reels:
  - https://www.youtube.com/shorts/RZvXYffFZUY
  - https://www.youtube.com/shorts/uo1zOJf-fgs
  - https://www.youtube.com/shorts/NmLFOLGg1Cc
carousels:
  screens:
    - /images/speakease/phone-11.png
    - /images/speakease/phone-12.png
    - /images/speakease/phone-13.png
  team:
    - /images/speakease/team/edward.jpg
    - /images/speakease/team/amber.jpg
    - /images/speakease/team/sabrina.jpg
    - /images/speakease/team/samantha.jpg
    - /images/speakease/team/oliver.jpg
captions:
  https://www.youtube.com/shorts/RZvXYffFZUY: "Introducing SpeakEase AI"
  https://www.youtube.com/shorts/uo1zOJf-fgs: "New Friends"
  https://www.youtube.com/shorts/NmLFOLGg1Cc: "Meet Easso!"
  /images/speakease/team/edward.jpg: "Edward — Lead Application Developer"
  /images/speakease/team/amber.jpg: "Amber — Technical Analyst"
  /images/speakease/team/sabrina.jpg: "Sabrina — Business Analyst"
  /images/speakease/team/samantha.jpg: "Samantha — Business Analyst"
  /images/speakease/team/oliver.jpg: "Oliver — Full-stack Developer"
notice: "SpeakEase AI has reached end of support on iOS and Android.\nThank you to everyone who supported the journey!"
links:
  - { label: "App Store", url: "https://apps.apple.com/ca/app/speakease-ai/id6502165362", kind: demo, disabled: true }
  - { label: "Google Play", url: "https://play.google.com/store/apps/details?id=speakease.ai&pli=1", kind: demo }
  - { label: "Discord", url: "https://discord.gg/T3TnWxPCRh", kind: website }
action: { label: "Try SpeakEase AI", url: "/speakeaseai" }
related: [exp-speakease-cofounder, exp-inqubate, skill-react-native]
---

## Meet EASSO
Easso is a friendly virtual companion that lives in your mobile device. Users chat freely with
Easso and practise their conversational skills through speech-to-speech conversations. Easso
learns about the user and remembers them the next time they chat.

## Features
SpeakEase AI gives feedback on pronunciation, sentence structure, and grammar based on the user's
performance while talking to Easso. Different coloured text indicates mispronunciation, and
clicking the checkmark gives an assessment of the sentence. Whenever users are stuck, Easso can
suggest what to say, and audio playback lets them replay messages.

<!-- carousel: screens -->

## Multilingual
SpeakEase AI supports 10+ languages, including English, French, Mandarin, Spanish, and Hindi
(Edward's resume cites pronunciation assessment in 15 languages). Users can talk with all of
Easso's friends to practise another language, and tap any message they don't understand to
translate it into the language of their choice.

## Meet the Team
Built through Queen's inQUbate program by Edward (Lead Application Developer), Amber
(Technical Analyst), Sabrina and Samantha (Business Analysts), and Oliver (Full-stack Developer).

<!-- carousel: team round -->

The team won 1st place at the Camp QMIND pitching competition, showcased at CUCAI, pitched to Ripple
Ventures, and launched on the App Store and Google Play, reaching 500+ users globally.

## Tech
TypeScript, React Native, Expo Go, Node, Express, Azure Speech SDK, Azure Translator, OpenAI.

## Try it on the web: SpeakEase AI is playable on this site
SpeakEase AI has reached end of support on iOS and Android, so Edward rebuilt the whole app as a
working web app on this site: open it with the "Try SpeakEase AI" button on this node, or the
SpeakEase AI button in the site's header (it lives at /speakeaseai). It works on phones and
computers, needs only a microphone, and is free. It's rebuilt in Svelte and runs on Gemini
(replies, speech recognition with pronunciation scores, corrections, translations and the
dictionary) instead of OpenAI and Azure.

Who you talk to: Easso, the original mascot, teaches English and speaks with his own voice
(Gemini text-to-speech). Every other language is taught by Cortex, the site's own AI assistant,
who speaks with Cortex's voice (the browser's built-in voice, as elsewhere on the site). If Easso's
voice runs out of quota, a note pops up and Cortex takes over reading aloud. Signed-in visitors are
greeted by their site nickname ("Hello <nickname>!") and the characters call them by it.

How to use it:
- Chats: pick a language (16: English, French, Mandarin, Cantonese, Korean, Japanese, Tagalog,
  Vietnamese, Hindi, Italian, Spanish, Portuguese, German, Arabic, Hebrew and Russian), hold the
  mic button (or Space) while you talk and let go to send. Each word you said is coloured by how
  well you pronounced it (green, yellow, red); tap a message to translate it; the checkmark checks
  your sentence and shows how to say the words you got wrong (a sound-it-out spelling, IPA and a
  tip, with normal and slow playback); the light bulb suggests what to say next. Chats are saved
  on your device for 30 days.
- Phrase Quest: learn phrases in any of the 16 languages. It starts with easy greetings and gets
  harder as you level up (8 phrases for the first level, 2 more each level after, up to 20). Each phrase shows its meaning, a sound-it-out spelling,
  IPA (and romanization for other scripts) and tips for the tricky sounds; hear it at normal or slow
  speed, then say it. Miss it and you get 2 more tries before it moves on and comes back later; after
  each level-up, earlier phrases come back for review.
- Scenarios: role-play real situations in any language: from the app, Greeting, Farewell, Ordering
  at a restaurant and Small Talk; and new everyday and travel ones: a café, a pharmacy, clothes
  shopping, airport check-in, hotel check-in, asking for directions, a taxi ride and buying a train
  ticket.
- Dictionary: look up a word in your own language and see it in the language you're learning, with
  how to say it, an example sentence and audio. Recent lookups are kept.
- Today's goals: goals for your favourite languages (talk with them, or learn their phrases), or
  15 minutes of practice when you have no favourites, plus a daily streak.
- Game: everything except the plain chats earns XP and player levels (Beginner, Explorer,
  Conversationalist, Polyglot, Legend), with 16 badges, combo bonuses in Phrase Quest, up to three
  stars per scenario and confetti for the big moments. Phrase attempts and scenario lines use energy
  (20, refilling over time; finishing goals and levelling up refill it); chats are free.
- Settings: light, dark or the system's theme, and the language messages are translated into.
