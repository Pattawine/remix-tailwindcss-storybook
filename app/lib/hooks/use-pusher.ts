import { useUser } from '@clerk/remix'
import Pusher from 'pusher-js'
import { useEffect, useState } from 'react'
import { PUSHER_CLUSTER, PUSHER_KEY } from '../core/constants'

/**
 * If the user is logged in, create a Pusher instance and bind it to the event handler.
 * The Pusher instance will be disconnected when the user logs out.
 * @param eventName The name of the event to listen to.
 * @param eventHandler The event handler callback.
 */
export function usePusher(eventName: string, eventHandler: (data: any) => void) {
  const { user } = useUser()
  const [pusher, setPusher] = useState<Pusher | null>(null)

  // create pusher if user is logged in
  useEffect(() => {
    if (!user) {
      return
    }

    // Pusher.logToConsole = true
    const pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
    })
    pusher.signin() // default auth endpoint is /pusher/user-auth
    setPusher(pusher)
    return () => {
      pusher.disconnect() // this causes warning on localhost
      setPusher(null)
    }
  }, [user])

  // bind pusher to event handler
  useEffect(() => {
    if (!pusher) {
      return
    }

    pusher.user.bind(eventName, eventHandler)
    return () => {
      pusher.user.unbind(eventName, eventHandler)
    }
  }, [pusher, eventName, eventHandler])
}
