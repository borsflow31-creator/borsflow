'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  disabled?: boolean;
}

interface SelectRefinedProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  /** `outlined` is the bordered field, `filled` the tonal field used inside modals. */
  variant?: 'outlined' | 'filled';
  size?: 'sm' | 'md';
  name?: string;
}

interface MenuPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const MENU_MAX_HEIGHT = 256;
const MENU_GAP = 6;
const TYPEAHEAD_RESET_MS = 600;

// useLayoutEffect logs a warning when the component is server-rendered.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function SelectRefined({
  value,
  options,
  onChange,
  label,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  triggerClassName,
  variant = 'outlined',
  size = 'md',
  name,
}: SelectRefinedProps) {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ query: '', at: 0 });

  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const labelId = `${reactId}-label`;

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - MENU_GAP;
    const openUp = spaceBelow < Math.min(MENU_MAX_HEIGHT, 180) && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;

    setPosition({
      left: rect.left,
      width: rect.width,
      top: openUp ? undefined : rect.bottom + MENU_GAP,
      bottom: openUp ? window.innerHeight - rect.top + MENU_GAP : undefined,
      maxHeight: Math.max(Math.min(MENU_MAX_HEIGHT, available), 120),
    });
  }, []);

  // Position before paint so the menu never flashes in the wrong place.
  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onReposition = (event: Event) => {
      if (event.type === 'scroll' && menuRef.current?.contains(event.target as Node)) return;
      updatePosition();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open, updatePosition]);

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    menuRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const firstEnabled = (from: number, step: number) => {
    for (let i = from; i >= 0 && i < options.length; i += step) {
      if (!options[i].disabled) return i;
    }
    return -1;
  };

  const openMenu = (index: number) => {
    if (disabled) return;
    setActiveIndex(index >= 0 && !options[index]?.disabled ? index : firstEnabled(0, 1));
    setOpen(true);
  };

  const closeMenu = (refocus = true) => {
    setOpen(false);
    setActiveIndex(-1);
    if (refocus) triggerRef.current?.focus();
  };

  const commit = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    closeMenu();
  };

  const moveTo = (index: number) => {
    if (index >= 0) setActiveIndex(index);
  };

  const handleTypeahead = (char: string) => {
    const now = Date.now();
    const query =
      now - typeahead.current.at > TYPEAHEAD_RESET_MS ? char : typeahead.current.query + char;
    typeahead.current = { query, at: now };

    const from = open ? activeIndex : selectedIndex;
    const ordered = options.map((opt, i) => ({ opt, i }));
    const rotated = [...ordered.slice(from + 1), ...ordered.slice(0, from + 1)];
    const hit = rotated.find(
      ({ opt }) => !opt.disabled && opt.label.toLowerCase().startsWith(query.toLowerCase())
    );
    if (!hit) return;

    if (open) setActiveIndex(hit.i);
    else onChange(hit.opt.value);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        if (!open) {
          openMenu(
            selectedIndex >= 0
              ? selectedIndex
              : firstEnabled(step > 0 ? 0 : options.length - 1, step)
          );
        } else {
          moveTo(firstEnabled(activeIndex + step, step));
        }
        break;
      }
      case 'Home':
      case 'End': {
        if (!open) return;
        event.preventDefault();
        moveTo(event.key === 'Home' ? firstEnabled(0, 1) : firstEnabled(options.length - 1, -1));
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        if (open) commit(activeIndex);
        else openMenu(selectedIndex);
        break;
      }
      case 'Escape': {
        if (!open) return;
        // Stay inside the dropdown - don't let a surrounding modal close too.
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        break;
      }
      case 'Tab': {
        if (open) closeMenu(false);
        break;
      }
      default: {
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          handleTypeahead(event.key);
        }
      }
    }
  };

  const sizing = size === 'sm' ? 'px-3 py-2 text-sm rounded-lg' : 'px-3 py-2 body-md rounded-lg';

  const chrome =
    variant === 'filled'
      ? 'bg-surface-container-high border border-transparent hover:bg-surface-container-highest focus-visible:ring-secondary/50'
      : 'bg-surface-container border border-outline-variant hover:border-outline focus-visible:ring-primary';

  return (
    <div className={className}>
      {label && (
        <label
          id={labelId}
          onClick={() => triggerRef.current?.focus()}
          className={cn(
            'block',
            size === 'sm'
              ? 'text-sm font-medium text-on-surface mb-1.5'
              : 'body-sm text-on-surface-variant mb-2'
          )}
        >
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={label ? `${labelId} ${reactId}-value` : undefined}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${reactId}-opt-${activeIndex}` : undefined
        }
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu(selectedIndex))}
        onKeyDown={onKeyDown}
        className={cn(
          'w-full flex items-center justify-between gap-2 text-left text-on-surface transition-colors',
          'focus:outline-none focus-visible:ring-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          sizing,
          chrome,
          triggerClassName
        )}
      >
        <span id={`${reactId}-value`} className="flex items-center gap-2 min-w-0">
          {selected?.icon}
          <span className={cn('truncate', !selected && 'text-on-surface-variant')}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <svg
          className={cn(
            'w-4 h-4 shrink-0 text-on-surface-variant transition-transform duration-200',
            open && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {name && <input type="hidden" name={name} value={value} />}

      {mounted &&
        open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={label ? labelId : undefined}
            tabIndex={-1}
            style={{
              position: 'fixed',
              left: position.left,
              top: position.top,
              bottom: position.bottom,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            className={cn(
              'z-[200] overflow-y-auto overscroll-contain p-1',
              'bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl',
              'transition-[opacity,transform] duration-150 ease-out',
              entered ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]',
              position.bottom !== undefined ? 'origin-bottom' : 'origin-top'
            )}
          >
            {options.length === 0 && (
              <div className="px-3 py-2 text-sm text-on-surface-variant">No options</div>
            )}

            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;

              return (
                <div
                  key={option.value}
                  id={`${reactId}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(index)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm select-none transition-colors',
                    option.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'cursor-pointer text-on-surface',
                    isActive && !option.disabled && 'bg-surface-container-high',
                    isSelected && !isActive && 'bg-surface-container'
                  )}
                >
                  {option.icon}
                  <span className="flex-1 min-w-0">
                    <span className={cn('block truncate', isSelected && 'font-medium')}>
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="block truncate text-xs text-on-surface-variant">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {isSelected && (
                    <svg
                      className="w-4 h-4 shrink-0 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
