import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { onCall } from 'firebase-functions/v2/https'
import { createUserService } from './userService.mjs'

initializeApp()
const service = createUserService(getAuth(), getFirestore())
const options = { region: 'europe-west1', maxInstances: 3, memory: '256MiB', timeoutSeconds: 60, invoker: 'public' }
// Public transport is needed for callable Firebase Auth tokens. Every handler
// independently verifies the current server-side authorizedUsers admin entry.
export const listAppUsers = onCall(options, request => service.list(request))
export const manageAppUser = onCall(options, request => service.change(request))
