import React from 'react'
import { View, Text } from 'react-native'
import { Char, CharPos, CustomSelection } from './models'
import { SelectCharsController } from './SelectCharsController'
import { TextViewChar } from './TextViewRow'

export interface SelectCharsPreviewProps {
  selections?: CustomSelection[]
  controller: SelectCharsController
  maxRight: number
}

export function SelectCharsPreview(props: SelectCharsPreviewProps) {
  const controller = props.controller
  const selections = props.selections ?? []
  if (controller.currentChar == null || controller.isSelecting == null) {
    return null
  }

  const chars = controller.charsPositions.current.filter(
    (char) =>
      Math.abs(char.char.id - (controller.currentChar?.char.id ?? -10)) < 3 &&
      char.line === (controller.currentChar?.line ?? -1)
  )

  const width = chars.reduce(
    (sum, char) => char.pos.right - char.pos.left + sum,
    0
  )
  const currCharPos = controller.currentChar.pos
  const center = currCharPos.left + (currCharPos.right - currCharPos.left) / 2
  const height = currCharPos.bottom - currCharPos.top

  const sorted = [...chars].sort(
    (charA, charB) => charA.char.id - charB.char.id
  )

  const left = Math.max(
    0,
    Math.min(center - width / 2 - 4, props.maxRight - width - 16)
  )
  const top = Math.max(controller.currentChar.pos.top - 32 - height, -controller.paddingTop)

  return (
    <View
      style={{
        position: 'absolute',
        top,
        left,
        backgroundColor: 'white',
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        zIndex: 2,
      }}
    >
      <Text>
        {sorted.map((char) => (
          <TextViewChar
            key={char.char.id}
            char={char.char}
            selectFromId={controller.selectFromId}
            selectToId={controller.selectToId}
            selections={selections}
          />
        ))}
      </Text>
    </View>
  )
}
