import { useState, useCallback, useMemo } from 'react'
import { LayoutChangeEvent } from 'react-native'

export function useCardTextSize() {
  const [cardHeight, setCardHeight] = useState(0)
  const [cardWidth, setCardWidth] = useState(0)

  const onCardLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setCardWidth(width)
    setCardHeight(height)
  }, [])

  const sizes = useMemo(() => {
    const w = Math.max(cardWidth - 8, 1)
    const h = Math.max(cardHeight - 8, 1)

    const maxFontByWidth = w / 3.5
    const maxFontByHeight = h * 0.85

    const fontSize = Math.max(16, Math.min(maxFontByWidth, maxFontByHeight))
    const unitFontSize = Math.max(12, fontSize * 0.42)
    const titleFontSize = Math.max(10, fontSize * 0.33)

    return { fontSize, unitFontSize, titleFontSize }
  }, [cardWidth, cardHeight])

  return { ...sizes, onCardLayout }
}
