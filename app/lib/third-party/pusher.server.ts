import Pusher from 'pusher'
import { PUSHER_CLUSTER, PUSHER_KEY } from '../core/constants'

export type CreationProgress = {
  message: string
  type: 'init' | 'info' | 'success' | 'error'
}

export const pusher = new Pusher({
  appId: '1706692',
  key: PUSHER_KEY,
  secret: process.env.PUSHER_SECRET || '',
  cluster: PUSHER_CLUSTER,
  useTLS: true,
})

/**
 * Send a message to the user that the creation was started. This function will not throw an error.
 */
export async function sendCreationInitToUser(userId: string, message: string) {
  try {
    const data: CreationProgress = { message, type: 'init' }
    return await pusher.sendToUser(userId, 'creation.progress', data)
  } catch (e) {
    console.error('Error sending creation progress to user', e)
  }
}

/**
 * Send a message to the user that the creation is in progress. This function will not throw an error.
 */
export async function sendCreationInfoToUser(userId: string, message: string) {
  try {
    const data: CreationProgress = { message, type: 'info' }
    return await pusher.sendToUser(userId, 'creation.progress', data)
  } catch (e) {
    console.error('Error sending creation progress to user', e)
  }
}

/**
 * Send a message to the user that the creation was successful. This function will not throw an error.
 */
export async function sendCreationSuccessToUser(userId: string, message: string) {
  try {
    const data: CreationProgress = { message, type: 'success' }
    return await pusher.sendToUser(userId, 'creation.progress', data)
  } catch (e) {
    console.error('Error sending creation progress to user', e)
  }
}

/**
 * Send a message to the user that the creation failed. This function will not throw an error.
 */
export async function sendCreationErrorToUser(userId: string, message: string) {
  try {
    const data: CreationProgress = { message, type: 'error' }
    return await pusher.sendToUser(userId, 'creation.progress', data)
  } catch (e) {
    console.error('Error sending creation progress to user', e)
  }
}
