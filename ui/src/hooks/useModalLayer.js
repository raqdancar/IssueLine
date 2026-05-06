// Provide shared modal behavior for Escape handling and body scroll locking.

import { useEffect } from 'react'

let bodyLockCount = 0
let bodyPreviousOverflow = ''

const escapeHandlerStack = []
let escapeListenerAttached = false

const onGlobalKeyDown = (event) => {
  if (event.key !== 'Escape') return
  const top = escapeHandlerStack[escapeHandlerStack.length - 1]
  if (!top?.onClose) return
  event.preventDefault()
  top.onClose()
}

const attachEscapeListener = () => {
  if (escapeListenerAttached || typeof window === 'undefined') return
  window.addEventListener('keydown', onGlobalKeyDown)
  escapeListenerAttached = true
}

const detachEscapeListener = () => {
  if (!escapeListenerAttached || typeof window === 'undefined') return
  window.removeEventListener('keydown', onGlobalKeyDown)
  escapeListenerAttached = false
}

const acquireBodyScrollLock = () => {
  if (typeof document === 'undefined') return () => {}
  if (bodyLockCount === 0) {
    bodyPreviousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  bodyLockCount += 1

  return () => {
    if (bodyLockCount === 0) return
    bodyLockCount -= 1
    if (bodyLockCount === 0 && typeof document !== 'undefined') {
      document.body.style.overflow = bodyPreviousOverflow
      bodyPreviousOverflow = ''
    }
  }
}

const registerEscapeHandler = (onClose) => {
  const id = Symbol('modal-escape-handler')
  escapeHandlerStack.push({ id, onClose })
  attachEscapeListener()

  return () => {
    const index = escapeHandlerStack.findIndex((entry) => entry.id === id)
    if (index >= 0) {
      escapeHandlerStack.splice(index, 1)
    }
    if (!escapeHandlerStack.length) {
      detachEscapeListener()
    }
  }
}

export const useModalLayer = ({ open, onClose, lockScroll = true, closeOnEscape = true }) => {
  useEffect(() => {
    if (!open || !lockScroll) return undefined
    return acquireBodyScrollLock()
  }, [open, lockScroll])

  useEffect(() => {
    if (!open || !closeOnEscape || typeof onClose !== 'function') return undefined
    return registerEscapeHandler(onClose)
  }, [open, closeOnEscape, onClose])
}
