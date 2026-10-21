// Brand icon for a link, picked from its URL (used by the footer and info-panel links).
export interface Brand {
	icon: string;
	name: string;
}

const BRANDS: [RegExp, Brand][] = [
	[/^mailto:/i, { icon: '/images/icons/gmail.svg', name: 'Gmail' }],
	[/(^|\/\/|\.)github\.com/i, { icon: '/images/icons/github.svg', name: 'GitHub' }],
	[/(^|\/\/|\.)linkedin\.com/i, { icon: '/images/icons/linkedin.svg', name: 'LinkedIn' }],
	[/(^|\/\/|\.)(youtube\.com|youtu\.be)/i, { icon: '/images/icons/youtube.svg', name: 'YouTube' }],
	[/(^|\/\/)apps\.apple\.com/i, { icon: '/images/icons/appstore.svg', name: 'App Store' }],
	[/(^|\/\/)play\.google\.com/i, { icon: '/images/icons/googleplay.svg', name: 'Google Play' }],
	[/(^|\/\/|\.)instagram\.com/i, { icon: '/images/icons/instagram.svg', name: 'Instagram' }],
	[/(^|\/\/|\.)(discord\.gg|discord\.com)/i, { icon: '/images/icons/discord.svg', name: 'Discord' }],
	[/(^|\/\/|\.)(linktr\.ee|linktree\.com)/i, { icon: '/images/icons/linktree.svg', name: 'Linktree' }]
];

export function brandFor(url: string): Brand | null {
	for (const [re, brand] of BRANDS) if (re.test(url)) return brand;
	return null;
}
