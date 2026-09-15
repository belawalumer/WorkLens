export type ToastType = 'success' | 'error' | 'info'

export const TOAST_EVENT = 'worklens:toast'

function emit(message: string, type: ToastType = 'info') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }))
}

export const toast = Object.assign(
  (msg: string) => emit(msg, 'info'),
  {
    success: (msg: string) => emit(msg, 'success'),
    error: (msg: string) => emit(msg, 'error'),
  }
)

export function queueToast(message: string, type: ToastType = 'info') {
  if (typeof window !== 'undefined')
    sessionStorage.setItem('__wl_toast', JSON.stringify({ message, type }))
}
