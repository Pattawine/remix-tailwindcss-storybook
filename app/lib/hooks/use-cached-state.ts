import { useEffect, useRef, useState } from 'react'

/**
 * Perform state accumulation and deduplication on an array of items.
 * Optionally, the items can be sorted. This hook is useful for caching data that changes on revalidation.
 * @param items - The items to accumulate and deduplicate.
 * @param keyFn - A function that returns a unique key for each item e.g. the item's ID.
 * @param compareFn - An optional function that compares two items. If provided, the items will be sorted.
 * @example
 * const items = useCachedState(creations, (creation) => creation.id, (a, b) => b.id.localeCompare(a.id))
 * @returns The accumulated and deduplicated items.
 */
export function useCachedState<T>(
  items: T[],
  keyFn: (item: T) => string,
  compareFn?: (a: T, b: T) => number,
) {
  const [cachedItems, setCachedItems] = useState(items)

  const keyFnRef = useRef(keyFn)
  const compareFnRef = useRef(compareFn)

  useEffect(() => {
    keyFnRef.current = keyFn
    compareFnRef.current = compareFn
  }, [keyFn, compareFn])

  useEffect(() => {
    setCachedItems((prevItems) => {
      const newItems = [...prevItems, ...items]

      // deduplicate items
      const newItemsMap = new Map<string, T>()
      for (const item of newItems) {
        newItemsMap.set(keyFnRef.current(item), item)
      }

      const sortedItems = [...newItemsMap.values()]
      if (compareFnRef.current) {
        sortedItems.sort(compareFnRef.current)
      }

      return sortedItems
    })
  }, [items])

  return cachedItems
}
