let loader: Promise<typeof import('mermaid').default> | null = null;
let counter = 0;

/** Renders every `<pre class="mermaid">` inside `root` (mermaid is loaded only when needed). */
export async function renderMermaid(root: HTMLElement, theme: 'light' | 'dark'): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>('pre.mermaid')];
  if (!blocks.length) return;
  loader ??= import('mermaid').then((m) => m.default);
  const mermaid = await loader;
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'default',
    securityLevel: 'strict',
  });
  for (const el of blocks) {
    const source = el.dataset.source ?? el.textContent ?? '';
    el.dataset.source = source;
    try {
      const { svg } = await mermaid.render(`mermaid-${++counter}`, source);
      el.innerHTML = svg;
    } catch {
      el.textContent = source;
    }
  }
}
