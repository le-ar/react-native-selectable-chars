import React, { useEffect, useState } from 'react'
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import RNSelectCharsModule, { SelectChars } from 'react-native-select-chars'
import { CustomSelection } from '../../src/models'

const text = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla sit amet mi sed magna porta sodales. Nullam venenatis libero eu placerat volutpat. Sed non velit a urna commodo venenatis in ac dui. Fusce est diam, ultricies vitae mauris in, molestie tempus felis. Vivamus pretium laoreet lectus, in elementum nibh tincidunt non. Aenean pellentesque elementum commodo. Lorem ipsum dolor sit amet, consectetur adipiscing elit. In consequat dui at ligula ultricies, vel facilisis elit molestie. Nam dictum feugiat maximus. Aliquam mattis sodales nulla, eget auctor arcu consequat eget.
Cras luctus rhoncus nisl, et vulputate ipsum tempor a. Sed porttitor congue massa, tempor porttitor ipsum laoreet eget. Donec et vehicula ex. Phasellus vehicula nec leo eu sollicitudin. Quisque dignissim placerat nulla congue dapibus. Sed ultricies ipsum ex, nec facilisis felis pharetra id. Praesent malesuada volutpat libero eget facilisis. Ut volutpat mauris nisl, sed maximus enim lobortis vitae. Curabitur vulputate, nunc sed facilisis cursus, odio tellus consectetur massa, ac consequat justo nisi eget sem. Phasellus ultrices elementum enim, in rutrum quam luctus id.
Quisque sodales, ex eget ornare vulputate, tortor odio fermentum dui, a posuere mauris dolor eget orci. Donec vitae sem aliquam lectus maximus bibendum eu sit amet nibh. Integer ultricies sagittis feugiat. Suspendisse odio elit, ultrices id diam nec, ullamcorper convallis metus. Phasellus consectetur congue quam, eget ultricies tellus porttitor vel. Curabitur nisi metus, sodales imperdiet mauris at, aliquam tempor neque. Ut in neque sit amet lorem rhoncus luctus et ac dui. Praesent in libero consequat ipsum hendrerit feugiat. Maecenas tempor, est nec blandit sagittis, nulla nulla tristique turpis, a hendrerit tortor justo quis nulla. Nunc ut purus quis quam gravida faucibus vel eu nunc. Phasellus leo diam, venenatis a sodales sit amet, consectetur vel metus. Ut magna felis, gravida et nunc sit amet, pharetra pharetra ligula. Ut maximus egestas sapien, sed blandit velit venenatis non. Curabitur ut dolor ante. Morbi sed leo lacinia, posuere nulla vel, volutpat felis. Sed vulputate mauris quis augue semper ornare non molestie elit.

Nullam eget quam in nulla lobortis ullamcorper. Sed eu massa non erat dignissim tristique. Quisque vitae cursus mauris, id vehicula elit. Nam eget eros pellentesque, porttitor neque in, tincidunt tortor. In ligula felis, blandit egestas posuere sit amet, vehicula eu lacus. Integer sed laoreet elit, sed laoreet dui. Fusce aliquam ipsum non arcu facilisis commodo. Ut fringilla, ante vitae placerat cursus, arcu dui aliquam leo, nec pellentesque magna ligula a sem. Vivamus sed facilisis nibh, vel fringilla justo. Pellentesque vel sodales arcu. Pellentesque fermentum velit quis purus ultrices dapibus. Cras urna turpis, consequat non diam vitae, pulvinar pretium libero.

Donec faucibus nisl quis hendrerit blandit. Sed nibh ante, faucibus sed facilisis et, pharetra id diam. Donec molestie, nisi quis lacinia maximus, eros dui suscipit ex, id ultrices nulla sapien vitae libero. Nunc pretium aliquam nisl quis rhoncus. Etiam lacus massa, ornare non pharetra venenatis, tristique non urna. Sed lacus risus, volutpat at pretium eget, dapibus quis orci. Mauris egestas elementum lorem euismod molestie. Fusce dictum aliquam orci at rutrum. Duis vitae eros at metus pretium ornare. Integer tellus ex, sollicitudin eget tortor sit amet, dictum finibus purus. Vivamus tincidunt sed turpis ac porta. Donec lacinia rutrum elit, a imperdiet odio.

`

const App = () => {
  const [selecting, setSelecting] = useState(false)

  return (
    <SafeAreaView style={{ backgroundColor: 'white' }}>
      <ScrollView style={{ paddingHorizontal: 16 }} scrollEnabled={!selecting}>
        <Test setSelecting={setSelecting} />
      </ScrollView>
    </SafeAreaView>
  )
}

function Test(props: { setSelecting: (isSelecting: boolean) => void }) {
  const [selections, setSelections] = useState<CustomSelection[]>([
    { start: 10, end: 15, hint: '(1)' },
    { start: 90, end: 92, hint: '(2)' },
    { start: 17, end: 40, hint: '(3)' },
  ])

  return (
    <SelectChars
      onStartSelect={() => {
        props.setSelecting(true)
      }}
      onEndSelect={() => {
        props.setSelecting(false)
      }}
      text={text}
      selections={selections}
      onSelect={(start, end, y, x, cancelSelect) => {
        const sub = text.substring(start, end)

        return (
          <TouchableOpacity
            onPress={() => {
              setSelections((s) => [
                ...s,
                { start, end, hint: `(${s.length + 1})` },
              ])

              cancelSelect()
            }}
          >
            <Text
              style={{
                color: 'black',
                fontWeight: 'bold',
                fontSize: 12,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              Mistake
            </Text>
          </TouchableOpacity>
        )
      }}
    />
  )
}

export default App
