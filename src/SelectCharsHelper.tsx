import React, { useRef } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { CharPos } from './models'
import { SelectCharsController } from './SelectCharsController'

export interface SelectCharsHelpersProps {
  controller: SelectCharsController
}

export function SelectCharsHelpers(props: SelectCharsHelpersProps) {
  if (
    (props.controller.isSelecting != null &&
      props.controller.isSelecting !== 'helper') ||
    props.controller.selectFromId == null ||
    props.controller.selectToId == null
  ) {
    return null
  }


  const firstSelected = props.controller.charsPositions.current.find(
    (char) => char?.char?.id === props.controller.selectFromId
  )
  const lastSelected = props.controller.charsPositions.current.find(
    (char) => char?.char?.id === props.controller.selectToId
  )

  const startSelectedChar =
    props.controller.selectFromId > -1
      ? firstSelected
      : void 0
  const endSelectedChar =
    props.controller.selectToId > -1
      ? lastSelected
      : void 0

  if (startSelectedChar == null) {
    return null
  }

  return (
    // <View
    //   style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    // >
    <React.Fragment>
      <SelectCharsHelper
        selectedChar={startSelectedChar}
        isStart
        controller={props.controller}
      />
      <SelectCharsHelper
        selectedChar={endSelectedChar}
        isStart={false}
        controller={props.controller}
      />
    </React.Fragment>
    // </View>
  )
}

export interface SelectCharsHelperProps {
  selectedChar?: CharPos
  isStart: boolean
  controller: SelectCharsController
}

export function SelectCharsHelper(props: SelectCharsHelperProps) {
  if (props.selectedChar == null) {
    return null
  }

  const controller = props.controller
  const locationPosStart = useRef<{ x: number; y: number }>()
  const pagePosStart = useRef<{ x: number; y: number }>()

  const top = props.selectedChar.pos.top + controller.paddingTop
  const height = props.selectedChar.pos.bottom - props.selectedChar.pos.top
  const left = props.isStart
    ? props.selectedChar.pos.left + controller.paddingLeft
    : props.selectedChar.pos.right + controller.paddingLeft

  const verticalCenter =
    props.selectedChar.pos.top +
    props.selectedChar.pos.bottom -
    props.selectedChar.pos.top
  const horizontalCenter =
    props.selectedChar.pos.left +
    props.selectedChar.pos.right -
    props.selectedChar.pos.left

  const locationPosFromPage = (
    x: number,
    y: number
  ): { x: number; y: number } => {
    if (locationPosStart.current == null || pagePosStart.current == null) {
      return { x: 0, y: 0 }
    }
    const deltaX = x - pagePosStart.current.x
    const deltaY = y - pagePosStart.current.y

    return {
      x: locationPosStart.current.x + deltaX,
      y: locationPosStart.current.y + deltaY,
    }
  }

  return (
    <Pressable
      hitSlop={8}
      onPressIn={(e) => {
        locationPosStart.current = { x: horizontalCenter, y: verticalCenter }
        pagePosStart.current = {
          x: e.nativeEvent.pageX,
          y: e.nativeEvent.pageY,
        }
        controller.setIsSelecting('helper')

        if (props.isStart) {
          controller.setStartSelectedId(controller.selectToId)
        } else {
          controller.setStartSelectedId(controller.selectFromId)
        }
        controller.setEndSelectedId(props.selectedChar!.char.id)
      }}
      onTouchMove={(e) => {
        const pos = locationPosFromPage(
          e.nativeEvent.pageX,
          e.nativeEvent.pageY
        )
        controller.continueSelect(pos.x, pos.y)
      }}
      onTouchEnd={(e) => {
        controller.setIsSelecting()
      }}
      style={{
        position: 'absolute',
        top,
        left: left - 8,
        width: 18,
        height: height + 16,
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 8,
          width: 2,
          height,
          backgroundColor: '#0074ff',
        }}
      />
      <CenterHelper isLeft={!props.isStart} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  ovalRight: {
    position: 'absolute',
    left: -2,
    bottom: 0,
    width: 16,
    height: 16,
    backgroundColor: '#0074ff',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  ovalLeft: {
    position: 'absolute',
    left: -2,
    bottom: 0,
    width: 16,
    height: 16,
    backgroundColor: '#0074ff',
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
})

const CenterHelper = (props: { isLeft: boolean }) => (
  <View
    style={{
      position: 'absolute',
      bottom: 0,
      left: props.isLeft ? void 0 : -5,
      right: props.isLeft ? -1 : void 0,
      width: 8,
      height: 12,
    }}
  >
    <View style={props.isLeft ? styles.ovalLeft : styles.ovalRight} />
  </View>
)
