import { useLayoutEffect, useRef } from 'react'

type SlidingIndicatorProps = {
  activeKey: string
  className?: string
}

export function SlidingIndicator({ activeKey, className = '' }: SlidingIndicatorProps) {
  const indicatorRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const indicator = indicatorRef.current
    const container = indicator?.parentElement
    if (!indicator || !container) return

    let animationFrame = 0

    const updatePosition = () => {
      animationFrame = 0
      const target = Array.from(container.querySelectorAll<HTMLElement>('[data-motion-key]'))
        .find((item) => item.dataset.motionKey === activeKey)
      if (!target) return

      const containerRect = container.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()

      indicator.style.setProperty('--indicator-x', `${targetRect.left - containerRect.left}px`)
      indicator.style.setProperty('--indicator-y', `${targetRect.top - containerRect.top}px`)
      indicator.style.setProperty('--indicator-width', `${targetRect.width}px`)
      indicator.style.setProperty('--indicator-height', `${targetRect.height}px`)
      indicator.dataset.ready = 'true'
    }

    const scheduleUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updatePosition)
    }

    updatePosition()
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleUpdate)
    resizeObserver?.observe(container)
    container.querySelectorAll<HTMLElement>('[data-motion-key]').forEach((item) => resizeObserver?.observe(item))
    window.addEventListener('resize', scheduleUpdate, { passive: true })

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [activeKey])

  return <span aria-hidden="true" className={`sliding-indicator ${className}`.trim()} ref={indicatorRef} />
}
