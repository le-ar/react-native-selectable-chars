import React, { useState } from 'react'
import { View } from 'react-native'
import { SelectCharsController } from './SelectCharsController'

export interface ContextMenuProps {
  controller: SelectCharsController
  layoutHeight: number
  layoutWidth: number
}

export function ContextMenu(props: ContextMenuProps) {
  const [width, setWidth] = useState(0)

  const controller = props.controller

  const firstSelected = controller.charsPositions.current.find(
    (char) => char.char.id === controller.selectFromId
  )
  if (props.controller.contextMenu == null || firstSelected == null) {
    return null
  }

  let selectionWidth = 0
  const firstLine = controller.charsPositions.current.filter((char) => {
    if (
      char.line === firstSelected.line &&
      controller.selectFromId <= char.char.id &&
      char.char.id <= controller.selectToId
    ) {
      selectionWidth += char.pos.right - char.pos.left
      return true
    }
    return false
  })

  const left = Math.max(
    0,
    Math.min(
      firstSelected.pos.left + selectionWidth / 2 - width / 2,
      props.layoutWidth - width - 4
    )
  )

  return (
    <View
      style={{
        position: 'absolute',
        bottom: props.layoutHeight - firstSelected.pos.top + 8,
        left: left,
        backgroundColor: 'white',
        paddingVertical: 2,
        paddingHorizontal: 4,
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 8,
        },
        shadowOpacity: 0.44,
        shadowRadius: 10.32,

        elevation: 16,
      }}
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width)
      }}
    >
      {props.controller.contextMenu}
    </View>
  )
}
