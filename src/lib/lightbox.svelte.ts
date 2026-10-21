// Full-screen image viewer shared by every media tile/carousel.
class Lightbox {
	src = $state<string | null>(null);
	caption = $state<string | undefined>(undefined);

	show(src: string, caption?: string): void {
		this.src = src;
		this.caption = caption;
	}

	close(): void {
		this.src = null;
		this.caption = undefined;
	}
}

export const lightbox = new Lightbox();
