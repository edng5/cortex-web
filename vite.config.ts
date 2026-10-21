import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	ssr: {
		// Native ONNX runtime — never bundle it.
		external: ['@huggingface/transformers', 'onnxruntime-node']
	}
});
