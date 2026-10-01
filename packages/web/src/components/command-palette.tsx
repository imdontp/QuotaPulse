import { useEffect, useRef, useState } from 'react';
import { Command, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';

export interface CommandItem {
  id: string;
  label: string;
  group?: string;
}

/** Small keyboard-first navigator for the existing pages; it never executes shell commands. */
export function CommandPalette({ items, onSelect }: { items: CommandItem[]; onSelect: (id: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const visible = items.filter((item) => item.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  const choose = (id: string) => {
    setOpen(false);
    onSelect(id);
    trigger.current?.focus();
  };
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const trapFocus = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const controls = dialog.current?.querySelectorAll<HTMLElement>('input, button:not([disabled]), [tabindex="0"]');
    if (!controls?.length) return;
    const first = controls[0]!;
    const last = controls[controls.length - 1]!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <>
      <Button ref={trigger} size="sm" onClick={() => setOpen(true)} aria-label={t('palette.open')} title={t('palette.shortcut')} className="text-muted-foreground gap-1.5">
        <Command className="size-[14px]" /><span className="hidden lg:inline">{t('palette.open')}</span><kbd className="border-border/70 hidden rounded border px-1 text-[10px] lg:inline">⌘K</kbd>
      </Button>
      {open && <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/35 px-4 pt-[12vh]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div ref={dialog} onKeyDown={trapFocus} role="dialog" aria-modal="true" aria-label={t('palette.title')} className="bg-popover text-popover-foreground w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl">
          <div className="flex items-center gap-2 border-b px-3 py-2.5"><Search className="text-muted-foreground size-4" /><input ref={input} value={query} onChange={(event) => { setQuery(event.target.value); setIndex(0); }} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setIndex((value) => Math.min(value + 1, Math.max(0, visible.length - 1))); } if (event.key === 'ArrowUp') { event.preventDefault(); setIndex((value) => Math.max(value - 1, 0)); } if (event.key === 'Enter' && visible[index]) { event.preventDefault(); choose(visible[index]!.id); } }} placeholder={t('palette.placeholder')} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /><Button size="icon" aria-label={t('palette.close')} onClick={() => { setOpen(false); trigger.current?.focus(); }}><X className="size-4" /></Button></div>
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {visible.length === 0 ? <p className="text-muted-foreground px-3 py-8 text-center text-sm">{t('palette.none')}</p> : visible.map((item, itemIndex) => <button key={item.id} onMouseEnter={() => setIndex(itemIndex)} onClick={() => choose(item.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${itemIndex === index ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-accent/60'}`}><span className="size-1.5 rounded-full bg-brand" /><span className="flex-1">{item.label}</span><span className="text-muted-foreground/60 text-[11px]">{item.group}</span></button>)}
          </div>
          <div className="text-muted-foreground border-t px-3 py-2 text-[11px]">{t('palette.help')}</div>
        </div>
      </div>}
    </>
  );
}
