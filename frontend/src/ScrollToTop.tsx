import { useEffect, useRef, useState } from 'react'

export function ScrollToTop() {
  const [visible, setVisible] = useState(false)
  const visibleRef = useRef(false)
  const animationFrame = useRef(0)

  useEffect(() => {
    const updateVisibility = () => {
      animationFrame.current = 0
      const nextVisible = window.scrollY > Math.max(560, window.innerHeight * .8)
      if (nextVisible !== visibleRef.current) {
        visibleRef.current = nextVisible
        setVisible(nextVisible)
      }
    }

    const onScroll = () => {
      if (!animationFrame.current) animationFrame.current = window.requestAnimationFrame(updateVisibility)
    }

    updateVisibility()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (animationFrame.current) window.cancelAnimationFrame(animationFrame.current)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const scrollToTop = () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return (
    <button
      aria-hidden={!visible}
      aria-label="返回页面顶部"
      className={visible ? 'scroll-to-top is-visible' : 'scroll-to-top'}
      onClick={scrollToTop}
      tabIndex={visible ? 0 : -1}
      type="button"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m6.5 14.5 5.5-5 5.5 5" />
      </svg>
    </button>
  )
}
