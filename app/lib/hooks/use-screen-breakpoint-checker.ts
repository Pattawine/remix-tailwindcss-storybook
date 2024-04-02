import { useEffect, useMemo, useState } from 'react'

export type BreakpointValue = 0 | 640 | 768 | 1024 | 1280 | 1536
export type BreakpointName = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type BreakpointChecker = Record<BreakpointName, boolean>

/**
 * Returns a record of breakpoints and whether or not the screen is at least that wide. Or null if
 * the screen width is unknown (e.g. server-side rendering).
 * @example
 * const checker = useScreenWidthChecker()
 * if (checker?.md) {
 *  // render something only on medium screens
 * }
 * @see https://tailwindcss.com/docs/breakpoints
 */
export function useScreenBreakpointChecker() {
  const [breakpoint, setBreakpoint] = useState<BreakpointValue | null>(null)

  useEffect(() => {
    const updateBreakpoints = () => {
      const width = window.innerWidth
      if (width >= 1536) {
        setBreakpoint(1536)
      } else if (width >= 1280) {
        setBreakpoint(1280)
      } else if (width >= 1024) {
        setBreakpoint(1024)
      } else if (width >= 768) {
        setBreakpoint(768)
      } else if (width >= 640) {
        setBreakpoint(640)
      } else {
        setBreakpoint(0)
      }
    }

    updateBreakpoints()
    window.addEventListener('resize', updateBreakpoints)

    return () => window.removeEventListener('resize', updateBreakpoints)
  }, [])

  const checker = useMemo(() => {
    if (breakpoint === null) {
      return null
    }
    return {
      sm: breakpoint >= 640,
      md: breakpoint >= 768,
      lg: breakpoint >= 1024,
      xl: breakpoint >= 1280,
      '2xl': breakpoint >= 1536,
    } as BreakpointChecker
  }, [breakpoint])
  return checker
}
