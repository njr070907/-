import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { AcademicOption } from './sztuAcademicData'

export function ThemedSelect({ label, value, options, placeholder, onChange, required = false, disabled = false }: {
  label: string
  value: string
  options: AcademicOption[]
  placeholder: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [openAbove, setOpenAbove] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const baseId = useId()
  const labelId = `${baseId}-label`
  const listId = `${baseId}-list`
  const selectedIndex = options.findIndex(item => item.displayName === value)

  function showMenu() {
    const bounds = root.current?.getBoundingClientRect()
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    setOpenAbove(Boolean(bounds && viewportHeight - bounds.bottom < 250 && bounds.top > viewportHeight - bounds.bottom))
    setActive(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
  }, [])

  useEffect(() => {
    if (open) document.getElementById(`${listId}-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, listId, open])

  function choose(index: number) {
    if (options[index]) onChange(options[index].displayName)
    setOpen(false)
    root.current?.querySelector<HTMLButtonElement>('.themed-select-trigger')?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') { setOpen(false); return }
    if (event.key === 'Tab') { setOpen(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!options.length) return
      if (!open) {
        showMenu()
      } else {
        setActive(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
      }
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) choose(active)
      else showMenu()
    }
  }

  return <div className={'themed-select-field ' + (openAbove ? 'open-up' : '')} ref={root}>
    <span className="field-label" id={labelId}>{label}</span>
    <button type="button" className={'themed-select-trigger ' + (!value ? 'placeholder' : '')}
      role="combobox" aria-labelledby={labelId} aria-haspopup="listbox" aria-expanded={open}
      aria-controls={listId} aria-activedescendant={open && options[active] ? `${listId}-option-${active}` : undefined}
      aria-required={required} disabled={disabled}
      onClick={() => { if (open) setOpen(false); else showMenu() }}
      onKeyDown={onKeyDown}>
      <span>{value || placeholder}</span><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 7 5 5 5-5" /></svg>
    </button>
    {open && <div className="themed-select-menu" id={listId} role="listbox" aria-labelledby={labelId}>
      {options.map((option, index) => <div key={option.id} id={`${listId}-option-${index}`}
        role="option" aria-selected={option.displayName === value}
        className={'themed-select-option ' + (index === active ? 'active ' : '') + (option.displayName === value ? 'selected' : '')}
        onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
        <span>{option.displayName}{option.kind === 'specialProgram' && <small>特色方向</small>}</span>
        {option.displayName === value && <span aria-hidden="true">✓</span>}
      </div>)}
    </div>}
  </div>
}
