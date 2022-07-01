import { StyleSheet } from 'react-native'

export const SelectCharsStyle = StyleSheet.create({
  pressable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    opacity: 0,
  },
})
