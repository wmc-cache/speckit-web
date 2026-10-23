import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/index.ts';
import { navigate, useRoute } from '../router.ts';

/** Top-bar search: debounced navigation to #/search?q=…, `/` focuses it. */
export function SearchBox() {
  const t = useT();
  const route = useRoute();
  const onSearchPage = route.segments[0] === 'search';
  const [value, setValue] = useState(onSearchPage ? (route.query.get('q') ?? '') : '');
  const inputRef = useRef<HTMLInputElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => {
      if (value.trim()) navigate('/search', { q: value }, onSearchPage);
    }, 150);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="search-box" role="search">
      <input
        ref={inputRef}
        type="search"
        value={value}
        placeholder={t('search.placeholder')}
        aria-label={t('search.title')}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) navigate('/search', { q: value });
          if (e.key === 'Escape') inputRef.current?.blur();
        }}
        data-testid="search-input"
      />
      <kbd aria-hidden>/</kbd>
    </div>
  );
}
