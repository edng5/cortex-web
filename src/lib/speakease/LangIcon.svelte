<!-- A language's own badge: a letter from its script (or a telltale accent) on its own colours. -->
<script lang="ts">
	let { locale, size = 44, label = '' }: { locale: string; size?: number; label?: string } = $props();

	/** Glyph and two colours for each language. */
	const LOOK: Record<string, [string, string, string]> = {
		'en-US': ['Aa', '#2563eb', '#60a5fa'],
		'ar-JO': ['ع', '#047857', '#34d399'],
		'zh-HK': ['粵', '#b91c1c', '#fb7185'],
		'fr-CA': ['É', '#1d4ed8', '#f43f5e'],
		'de-DE': ['ß', '#374151', '#f59e0b'],
		'he-IL': ['א', '#1e40af', '#93c5fd'],
		'hi-IN': ['अ', '#ea580c', '#16a34a'],
		'it-IT': ['È', '#15803d', '#ef4444'],
		'ja-JP': ['あ', '#be123c', '#fda4af'],
		'ko-KR': ['한', '#4338ca', '#f472b6'],
		'zh-CN': ['中', '#dc2626', '#f59e0b'],
		'pt-BR': ['Ã', '#15803d', '#facc15'],
		'ru-RU': ['Я', '#1e3a8a', '#ef4444'],
		'es-DO': ['Ñ', '#c2410c', '#facc15'],
		'fil-PH': ['Po', '#1d4ed8', '#fbbf24'],
		'vi-VN': ['Đ', '#b91c1c', '#facc15']
	};
	const look = $derived(LOOK[locale] ?? ['?', '#475569', '#94a3b8']);
	const small = $derived([...look[0]].length > 1);
</script>

<span
	class="lang-icon"
	role="img"
	aria-label={label}
	style="width:{size}px;height:{size}px;--a:{look[1]};--b:{look[2]};font-size:{size * (small ? 0.4 : 0.52)}px"
>
	<span lang={locale}>{look[0]}</span>
</span>

<style>
	.lang-icon {
		position: relative;
		flex: none;
		display: grid;
		place-items: center;
		overflow: hidden;
		border-radius: 30%;
		background: linear-gradient(140deg, var(--a), var(--b));
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.35),
			0 6px 14px -8px var(--a);
		color: #fff;
		font-weight: 800;
		line-height: 1;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
		user-select: none;
	}
	/* A soft shine across the top. */
	.lang-icon::before {
		content: '';
		position: absolute;
		inset: 0 0 55% 0;
		background: linear-gradient(rgba(255, 255, 255, 0.22), transparent);
	}
	.lang-icon span {
		position: relative;
	}
</style>
