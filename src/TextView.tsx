import React from 'react'
import { CharPos, CustomSelection, SelectCharsLine } from './models'
import { SelectCharsController } from './SelectCharsController'
import { TextViewRowMemo } from './TextViewRow'

export const TextViewMemo = React.memo(TextView)

export interface TextViewProps {
  fontSize?: number
  lines: SelectCharsLine[]

  selectFromId: number
  selectToId: number
  selections?: CustomSelection[]

  controller: SelectCharsController
}

export function TextView(props: TextViewProps) {
  const lines = props.lines

  let prevAscender = -1
  let sumAscender = 0
  const calcSumAscender = (ascender: number) => {
    sumAscender +=
      prevAscender > 0 && prevAscender !== ascender
        ? prevAscender - ascender
        : 0
    prevAscender = ascender
  }

  return (
    <React.Fragment>
      {lines.map((line, i) => {
        calcSumAscender(line.ascender)
        const top = line.y - sumAscender

        const charsCount = line.text.length
        const minId = charsCount > 0 ? line.text[0].id : -1
        const maxId = charsCount > 0 ? line.text[charsCount - 1].id : -1

        const selections = (props.selections ?? []).filter(
          (selection) =>
            (minId <= selection.start && selection.start <= maxId) ||
            (minId <= selection.end && selection.end <= maxId) ||
            (selection.start <= minId && maxId <= selection.end)
        )

        return (
          <TextViewRowMemo
            lineId={i}
            key={top}
            line={line}
            top={top}
            selectFromId={props.controller.selectFromId}
            selectToId={props.controller.selectToId}
            selections={selections}
            controller={props.controller}
            fontSize={props.fontSize}
          />
        )
      })}
    </React.Fragment>
  )
}
