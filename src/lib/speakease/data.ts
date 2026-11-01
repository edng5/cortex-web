// SpeakEase AI (web edition): the characters, languages and tips, shared by the page and the server.
// Recreated from the SpeakEase mobile app (github.com/inqubate-blue). Easso is still Easso, with his
// own voice (Gemini text-to-speech). Every other friend and scenario character is now Cortex, the
// site's assistant, speaking with Cortex's voice (the browser's own, as on the rest of the site).

export type Gender = 'female' | 'male';

/** Who a character is drawn as and speaks as. */
export type Persona = 'easso' | 'cortex';

/** A language-practice friend: talks only in their language. */
export interface Friend {
	id: string;
	name: string;
	gender: Gender;
	persona: Persona;
	/** What you speak in this chat (BCP-47, as the app used). */
	locale: string;
	language: string;
	/** The first message in a new chat. */
	greeting: string;
	/** The same, for a signed-in player: `{name}` is their nickname. */
	greetingNamed: string;
}

/** A role-play scenario (played by Cortex) in whichever language you pick. */
export interface Scenario {
	id: string;
	name: string;
	/** Who you're talking to, for the card. */
	role: string;
	group: 'Everyday' | 'Travel';
	icon: string;
}

/** Easso's Gemini voice (male, checked by ear); everyone else is Cortex. */
export const EASSO_VOICE = 'Achird';

/** Languages in alphabetical order, English first (every language list in the app). */
const englishFirst = <T>(list: T[], name: (x: T) => string): T[] =>
	[...list].sort((a, b) => (name(a) === 'English' ? -1 : name(b) === 'English' ? 1 : name(a).localeCompare(name(b))));

const cortex = (id: string, locale: string, language: string, greeting: string, greetingNamed: string): Friend => ({
	id,
	name: 'Cortex',
	gender: 'male',
	persona: 'cortex',
	locale,
	language,
	greeting,
	greetingNamed
});

export const FRIENDS: Friend[] = englishFirst<Friend>([
	{
		id: '0', name: 'Easso', gender: 'male', persona: 'easso', locale: 'en-US', language: 'English',
		greeting: "Hey there! I'm Easso, a friendly chatbot. Nice to meet you, friend! Talk to me about anything that's on your mind.",
		greetingNamed: "Hey there, {name}! I'm Easso, a friendly chatbot. Nice to meet you! Talk to me about anything that's on your mind."
	},
	cortex('2', 'fr-CA', 'French', "Bonjour, je m'appelle Cortex. Ravi de vous rencontrer!", "Bonjour {name}, je m'appelle Cortex. Ravi de vous rencontrer!"),
	cortex('1', 'zh-CN', 'Mandarin', '嗨，我是Cortex。很高兴见到你！让我们成为最好的朋友吧！', '嗨，{name}！我是Cortex。很高兴见到你！让我们成为最好的朋友吧！'),
	cortex('10', 'zh-HK', 'Cantonese', '你好嗎? 我叫Cortex。 見到你好开心！ 我哋今日應該傾乜嘢？', '{name}，你好嗎? 我叫Cortex。 見到你好开心！ 我哋今日應該傾乜嘢？'),
	cortex('4', 'ko-KR', 'Korean', '안녕하세요, 저는 Cortex입니다. 만나서 반가워요! 함께 한국어로 이야기합시다!', '안녕하세요, {name}님! 저는 Cortex입니다. 만나서 반가워요! 함께 한국어로 이야기합시다!'),
	cortex('5', 'ja-JP', 'Japanese', 'こんにちは友人、はじめまして!Cortexです!何でもおしゃべりできます!', 'こんにちは、{name}さん、はじめまして!Cortexです!何でもおしゃべりできます!'),
	cortex('8', 'fil-PH', 'Tagalog', 'Hoy, ako si Cortex. Masaya akong makilala ka, kaibigan! Kausapin mo ako tungkol sa anumang bagay na nasa isip mo.', 'Hoy {name}, ako si Cortex. Masaya akong makilala ka! Kausapin mo ako tungkol sa anumang bagay na nasa isip mo.'),
	cortex('11', 'vi-VN', 'Vietnamese', 'Xin chào, tôi là Cortex. Rất vui được gặp bạn! Hôm nay bạn muốn nói về điều gì?', 'Xin chào {name}, tôi là Cortex. Rất vui được gặp bạn! Hôm nay bạn muốn nói về điều gì?'),
	cortex('9', 'hi-IN', 'Hindi', 'अरे, मैं Cortex हूँ। आपसे मिलकर अच्छा लगा, दोस्त! मेरे मन में जो कुछ भी है उसके बारे में मुझसे बात करें।', 'अरे {name}, मैं Cortex हूँ। आपसे मिलकर अच्छा लगा! मेरे मन में जो कुछ भी है उसके बारे में मुझसे बात करें।'),
	cortex('6', 'it-IT', 'Italian', 'Ciao, sono Cortex. Piacere di conoscerti, amico. Di cosa vorresti parlare?', 'Ciao {name}, sono Cortex. Piacere di conoscerti! Di cosa vorresti parlare?'),
	cortex('3', 'es-DO', 'Spanish', 'Hola, soy Cortex. ¡Encantado de conocerlo!', 'Hola {name}, soy Cortex. ¡Encantado de conocerte!'),
	cortex('12', 'pt-BR', 'Portuguese', 'Oi, meu nome é Cortex, bom te conhecer! Como posso ajudá-lo?', 'Oi {name}, meu nome é Cortex, bom te conhecer! Como posso ajudar você?'),
	cortex('7', 'de-DE', 'German', 'Hallo, ich bin Cortex. Es ist mir eine Freude, Sie kennenzulernen! Lassen Sie uns Spaß beim Reden haben!', 'Hallo {name}, ich bin Cortex. Es ist mir eine Freude, Sie kennenzulernen! Lassen Sie uns Spaß beim Reden haben!'),
	cortex('13', 'ar-JO', 'Arabic', 'مرحبا، أنا Cortex، تشرفت بلقائك! كيف حالك اليوم؟', 'مرحبا {name}، أنا Cortex، تشرفت بلقائك! كيف حالك اليوم؟'),
	cortex('20', 'he-IL', 'Hebrew', "שלום לך! אני Cortex, צ'אט בוט ידידותי. נעים להכיר אותך! דברו איתי על כל דבר שעולה על דעתכם.", "שלום {name}! אני Cortex, צ'אט בוט ידידותי. נעים להכיר אותך! דברו איתי על כל דבר שעולה על דעתכם."),
	cortex('15', 'ru-RU', 'Russian', 'Здравствуйте! Меня зовут Cortex, приятно познакомиться. О чем бы Вы хотели сегодня поговорить?', 'Здравствуйте, {name}! Меня зовут Cortex, приятно познакомиться. О чем бы Вы хотели сегодня поговорить?')
], (f) => f.language);

export const SCENARIOS: Scenario[] = [
	// From the app
	{ id: '16', name: 'Greeting!', role: 'Meet a stranger', group: 'Everyday', icon: '👋' },
	{ id: '17', name: 'Farewell!', role: 'Say goodbye', group: 'Everyday', icon: '🫶' },
	{ id: '18', name: 'Order!', role: 'At a restaurant', group: 'Everyday', icon: '🍽️' },
	{ id: '19', name: 'Small Talk!', role: 'Elevator chat', group: 'Everyday', icon: '💬' },
	// Everyday life
	{ id: '26', name: 'Café!', role: 'Order a coffee', group: 'Everyday', icon: '☕' },
	{ id: '25', name: 'Pharmacy!', role: 'Get something for a cold', group: 'Everyday', icon: '💊' },
	{ id: '28', name: 'Shopping!', role: 'Buy clothes', group: 'Everyday', icon: '🛍️' },
	// Travel
	{ id: '21', name: 'Airport!', role: 'Check in for a flight', group: 'Travel', icon: '✈️' },
	{ id: '22', name: 'Hotel!', role: 'Check in at the desk', group: 'Travel', icon: '🏨' },
	{ id: '23', name: 'Directions!', role: 'Find your way', group: 'Travel', icon: '🗺️' },
	{ id: '24', name: 'Taxi!', role: 'Take a ride', group: 'Travel', icon: '🚕' },
	{ id: '27', name: 'Train!', role: 'Buy a ticket', group: 'Travel', icon: '🚆' }
];

/** The languages a scenario can be played in (the app's "Select a language" list). */
export const SCENARIO_LANGUAGES: { label: string; locale: string }[] = englishFirst([
	{ label: 'English', locale: 'en-US' },
	{ label: 'French', locale: 'fr-CA' },
	{ label: 'Mandarin', locale: 'zh-CN' },
	{ label: 'Korean', locale: 'ko-KR' },
	{ label: 'Japanese', locale: 'ja-JP' },
	{ label: 'Filipino', locale: 'fil-PH' },
	{ label: 'Vietnamese', locale: 'vi-VN' },
	{ label: 'Hindi', locale: 'hi-IN' },
	{ label: 'Spanish', locale: 'es-DO' },
	{ label: 'Portuguese', locale: 'pt-BR' },
	{ label: 'Italian', locale: 'it-IT' },
	{ label: 'German', locale: 'de-DE' },
	{ label: 'Arabic', locale: 'ar-JO' },
	{ label: 'Russian', locale: 'ru-RU' }
], (l) => l.label);

/** What a tapped message is translated into (Settings → "Translate to"). */
export const TRANSLATE_OPTIONS: { lang: string; label: string }[] = englishFirst([
	{ lang: 'en', label: 'English' },
	{ lang: 'fr', label: 'French' },
	{ lang: 'zh', label: 'Mandarin' },
	{ lang: 'yue', label: 'Cantonese' },
	{ lang: 'ko', label: 'Korean' },
	{ lang: 'ja', label: 'Japanese' },
	{ lang: 'fil', label: 'Filipino' },
	{ lang: 'vi', label: 'Vietnamese' },
	{ lang: 'hi', label: 'Hindi' },
	{ lang: 'es', label: 'Spanish' },
	{ lang: 'pt', label: 'Portuguese' },
	{ lang: 'it', label: 'Italian' },
	{ lang: 'de', label: 'German' },
	{ lang: 'ar', label: 'Arabic' },
	{ lang: 'he', label: 'Hebrew' },
	{ lang: 'ru', label: 'Russian' }
], (o) => o.label);

/** What the app does and how to use it: beside the phone on a computer, the "?" pop-up on a phone. */
export const HOW_TO: { name: string; text: string }[] = [
	{ name: 'Chat', text: ' with friends in 16 languages. Hold the mic and talk.' },
	{ name: 'Phrase Quest', text: ': hear a phrase, say it, get scored word by word.' },
	{ name: 'Scenarios', text: ': role-play ordering food, checking in, and more.' },
	{ name: 'Dictionary', text: ": look up a word and hear how it's said." },
	{ name: 'Tap a message', text: ' to translate it, or /ə/ to see how to pronounce it.' }
];
export const HOW_TO_NOTE = 'Chats are free. Sign in to play the games and keep your progress on every device.';

export const TIPS = [
	'Hold the mic button while speaking and release when you are done talking.',
	'Words highlighted in yellow and red mean incorrect pronunciation.',
	'Click the checkmark to get the proper sentence structure of your speech.',
	'Click on a chat bubble to get the translation in the selected language.',
	'Click the speaker button to get an audio playback of the sentence.',
	'Not sure what to say? Click light bulb to generate a reply for that situation.',
	'Click /ə/ under a message to see how to pronounce each word, and tap a word to hear it slowly.'
];

/** Language names by locale (for the model and the speech recogniser). */
export const LANGUAGE_NAMES: Record<string, string> = {
	'en-US': 'English',
	'fr-CA': 'French (Canadian)',
	'zh-CN': 'Mandarin Chinese (Simplified)',
	'zh-HK': 'Cantonese (Hong Kong, written Cantonese)',
	'ko-KR': 'Korean',
	'ja-JP': 'Japanese',
	'fil-PH': 'Filipino (Tagalog)',
	'vi-VN': 'Vietnamese',
	'hi-IN': 'Hindi',
	'it-IT': 'Italian',
	'es-DO': 'Spanish',
	'pt-BR': 'Portuguese (Brazilian)',
	'de-DE': 'German',
	'ar-JO': 'Arabic',
	'he-IL': 'Hebrew',
	'ru-RU': 'Russian'
};

/** A friend's first message, using the player's nickname when they're signed in. */
export const greetingFor = (f: Friend, nickname: string | null) => (nickname ? f.greetingNamed.replace('{name}', nickname) : f.greeting);

export const friendById = (id: string) => FRIENDS.find((f) => f.id === id) ?? null;
export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id) ?? null;

/** Languages written without spaces between words (so per-word colouring joins them up). */
export const noSpaces = (locale: string) => /^(zh|ja)/.test(locale);
