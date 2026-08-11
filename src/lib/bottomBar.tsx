import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

const BottomBarContext = createContext<{
  content: ReactNode
  setContent: (content: ReactNode) => void
} | undefined>(undefined)

export function BottomBarProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null)
  return (
    <BottomBarContext.Provider value={{ content, setContent }}>
      {children}
    </BottomBarContext.Provider>
  )
}

export function BottomBarSlot() {
  const context = useContext(BottomBarContext)
  if (!context?.content) return null
  return <div className="border-t bg-white">{context.content}</div>
}

export function usePublishBottomBar(content: ReactNode) {
  const context = useContext(BottomBarContext)
  if (!context) {
    throw new Error('usePublishBottomBar must be used within a BottomBarProvider')
  }
  const { setContent } = context
  useEffect(() => {
    setContent(content)
    return () => setContent(null)
  }, [content, setContent])
}
