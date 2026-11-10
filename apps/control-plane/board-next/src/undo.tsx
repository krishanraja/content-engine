// Every press is sent after a five-second Undo (sonner, the toast under 21st.dev's Sonner Toast), so a wrong tap costs nothing.
import { toast } from 'sonner'

export function useUndo() {
  return (label: string, act: () => Promise<void> | void, ms = 5000, onUndo?: () => void) => {
    let undone = false
    const id = toast(label, { duration: ms, action: { label: 'Undo', onClick: () => { undone = true; toast.dismiss(id); onUndo?.(); toast('Undone. Nothing was sent.') } } })
    setTimeout(() => { if (!undone) void act() }, ms)
  }
}
