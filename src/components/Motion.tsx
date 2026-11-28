import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  variant?: 'up' | 'left' | 'scale'
}

export function Reveal({ children, className = '', delay = 0, variant = 'up' }: RevealProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || !('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const style = { '--reveal-delay': `${delay}ms` } as CSSProperties
  return (
    <div
      ref={elementRef}
      className={`reveal reveal-${variant}${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </div>
  )
}

const particles = [
  { x: 7, y: 17, size: 2, delay: 0 },
  { x: 19, y: 68, size: 3, delay: 1.8 },
  { x: 31, y: 30, size: 2, delay: 3.2 },
  { x: 43, y: 82, size: 2, delay: 2.4 },
  { x: 56, y: 12, size: 3, delay: 4.1 },
  { x: 66, y: 63, size: 2, delay: 1.1 },
  { x: 74, y: 37, size: 2, delay: 3.7 },
  { x: 84, y: 78, size: 3, delay: 2.9 },
  { x: 93, y: 24, size: 2, delay: 0.7 },
  { x: 49, y: 48, size: 2, delay: 5.2 },
]

export function GoldParticles() {
  return (
    <div className="gold-particles" aria-hidden="true">
      {particles.map((particle, index) => (
        <span
          className="gold-particle"
          key={index}
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export function ParallaxLayer({ children, className = '', strength = 7 }: { children?: ReactNode; className?: string; strength?: number }) {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = layerRef.current
    const pointer = window.matchMedia('(pointer: fine)')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!element || !pointer.matches || reduceMotion.matches) return

    let frame = 0
    const move = (event: PointerEvent) => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * strength
        const y = (event.clientY / window.innerHeight - 0.5) * strength
        element.style.setProperty('--parallax-x', `${x}px`)
        element.style.setProperty('--parallax-y', `${y}px`)
        frame = 0
      })
    }

    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      window.removeEventListener('pointermove', move)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [strength])

  return <div ref={layerRef} className={`parallax-layer${className ? ` ${className}` : ''}`}>{children}</div>
}

export function LoadingScreen({ label = 'Preparing your experience' }: { label?: string }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <span className="loading-mark"><span /></span>
      <span>{label}</span>
    </div>
  )
}

export function LoadingSpinner({ label }: { label: string }) {
  return <span className="loading-inline" role="status"><span className="loading-inline-mark" aria-hidden="true" />{label}</span>
}
