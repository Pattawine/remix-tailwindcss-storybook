import { useFetcher } from '@remix-run/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CreationJson } from '~/lib/model/creation.server'
import type { ApiCreations_Loader } from '~/routes/api.creations'

/**
 * Tracks the scroll position of the root element. If the user scrolls to near the bottom of the
 * page, we'll fetch more creations.
 * @param userId the user id to fetch creations for. If not provided, we'll fetch creations for
 *  the current user. Note that non-admin users can only fetch creations for themselves.
 * @param initNextCursor the next cursor to use when fetching creations for the first time
 * @param pageSize the number of creations to fetch each time
 * @param pixelsUntilBottom the number of pixels until the bottom of the page to trigger fetching
 * @returns [creations, rootRef] where
 * - creations: array of creations fetched so far
 * - rootRef: a ref to the root element that the user scrolls on. If not provided or provided but
 *   the root element doesn't have a scrollbar, we'll fallback to use window.
 *   We'll revert back to use root element if it has a scrollbar again.
 * @example
 * const [extraCreations, rootRef] = useInfiniteScrolling(null, nextCursor, 30, 3000)
 * const creations = [...data.creations, ...extraCreations]
 * return (
 *  <div ref={rootRef}>
 *   {creations.map((creation) => (
 *    <CreationImage key={creation.id} creation={creation} index={0} />
 *  ))}
 * </div>
 * )
 *
 */
export function useInfiniteScrolling(
  userId: string | '*' | null,
  initNextCursor: string | null,
  pageSize: number,
  pixelsUntilBottom: number,
) {
  // infinite scroll states
  const rootRef = useRef<HTMLDivElement | null>(null)
  const nextCursorRef = useRef(initNextCursor)
  const isFetchingRef = useRef(false)
  const [creations, setCreations] = useState([] as CreationJson[])
  const fetcher = useFetcher<ApiCreations_Loader>()

  // fetch more creations when the user scrolls to near the bottom of the page
  const handleScroll = useCallback(
    (e: Event) => {
      let scrollTop, scrollHeight, clientHeight
      const target = e.target

      // work for both window scrolling and div scrolling
      if (target === document || target === document.documentElement || target === document.body) {
        scrollTop = document.documentElement.scrollTop || document.body.scrollTop
        scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight
        clientHeight = document.documentElement.clientHeight
      } else {
        const target = e.target as HTMLDivElement
        scrollTop = target.scrollTop
        scrollHeight = target.scrollHeight
        clientHeight = target.clientHeight
      }

      const nearBottom = scrollTop + clientHeight >= scrollHeight - pixelsUntilBottom

      if (nearBottom && nextCursorRef.current && !isFetchingRef.current) {
        isFetchingRef.current = true
        fetcher.submit(
          { cursor: nextCursorRef.current, pageSize, userId },
          { method: 'GET', action: '/api/creations' },
        )
      }
    },
    [fetcher, pageSize, pixelsUntilBottom, userId],
  )

  // if root is provided, we'll constantly monitor whether it has a scrollbar. if it does, we'll
  // listen to its scroll event. if it doesn't, we'll listen to window's scroll event.
  // if root is not provided, we'll always listen to window's scroll event.
  useEffect(() => {
    const hasScrollbar = (target: HTMLElement) => {
      const overflowY = window.getComputedStyle(target).overflowY
      const isOverflowing =
        overflowY !== 'visible' &&
        overflowY !== 'hidden' &&
        target.scrollHeight > target.clientHeight
      return isOverflowing
    }

    const root = rootRef.current
    if (root) {
      let prevRoot: HTMLDivElement | Window | null = null
      const resizeObserver = new ResizeObserver(() => {
        const curRoot = hasScrollbar(root) ? root : window
        if (prevRoot !== curRoot) {
          prevRoot?.removeEventListener('scroll', handleScroll)
          curRoot.addEventListener('scroll', handleScroll)
          prevRoot = curRoot
        }
      })
      resizeObserver.observe(root)
      return () => {
        resizeObserver.unobserve(root)
        prevRoot?.removeEventListener('scroll', handleScroll)
      }
    } else {
      window.addEventListener('scroll', handleScroll)
      return () => {
        window.removeEventListener('scroll', handleScroll)
      }
    }
  }, [handleScroll])

  // append data to creations when the fetcher is done
  useEffect(() => {
    if (fetcher.data) {
      setCreations((prev) => [...prev, ...(fetcher.data?.creations ?? [])])
      nextCursorRef.current = fetcher.data.nextCursor
      isFetchingRef.current = false
    }
  }, [fetcher.data])

  return [creations, rootRef] as const
}
