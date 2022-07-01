import React, { useEffect, useRef, useState } from 'react'
import { Text, useWindowDimensions } from 'react-native'
import { SelectCharsText, SelectCharsTextLine } from './models'
import { SelectCharsController } from './SelectCharsController'

export interface TextMeasureProps {
  text: string | SelectCharsText | SelectCharsText[]
  setLines: (lines: SelectCharsTextLine[]) => void
}

export function TextMeasure(props: TextMeasureProps) {
  if (Array.isArray(props.text)) {
    return <TextMeasureTexts texts={props.text} />
  }

  if (typeof props.text === 'object') {
    return <TextMeasureText text={props.text} />
  }

  return <TextMeasureString text={props.text} setLines={props.setLines} />
}

export function TextMeasureString(
  props: Omit<TextMeasureProps, 'text'> & { text: string }
) {
  const [padding, setPadding] = useState(0)
  const dimensions = useWindowDimensions() // because onTextLayout not firing on change orientation
  const updatedSize = useRef(dimensions.width)

  useEffect(() => {
    if (updatedSize.current !== dimensions.width) {
      setPadding(10)
      updatedSize.current = dimensions.width
    }
  }, [dimensions.width])

  return (
    <Text
      style={{
        opacity: 0,
        color: 'red',
        paddingTop: padding,
        lineHeight: 24,
        fontSize: 14,
      }}
      onTextLayout={(evt) => {
        const lines: SelectCharsTextLine[] = evt.nativeEvent.lines.map(
          (line) => ({
            text: line.text,
            y: line.y,
            ascender: line.ascender,
            height: line.height,
          })
        )
        const l = evt.nativeEvent.lines[0]
        setPadding(0)
        props.setLines(lines)
      }}
    >
      {props.text}
    </Text>
  )
}

export function TextMeasureText(props: { text: SelectCharsText }) {
  return <Text style={props.text.style}>{props.text.text}</Text>
}

export function TextMeasureTexts(props: { texts: SelectCharsText[] }) {
  return (
    <Text>
      {props.texts.map((text) => (
        <TextMeasureText text={text} />
      ))}
    </Text>
  )
}