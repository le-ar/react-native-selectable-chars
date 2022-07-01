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

export const ContextMenuStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
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
  },
})

export const SelectCharsHelpersStyle = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    width: 18,
  },
  line: {
    position: 'absolute',
    top: 0,
    left: 8,
    width: 2,
    backgroundColor: '#0074ff',
  },
  oval: {
    position: 'absolute',
    bottom: 0,
    width: 8,
    height: 12,
  },
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

export const SelectCharsPreviewStyle = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: 'white',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 2,
  },
})

export const SelectionsHintsStyle = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  hint: {
    position: 'absolute',
    fontWeight: 'bold',
    fontSize: 10,
  },
})

export const TextMeasureStyle = StyleSheet.create({
  text: {
    opacity: 0,
    color: 'red',
    lineHeight: 24,
    fontSize: 14,
  },
})

export const TextViewStyle = StyleSheet.create({
  row: {
    position: 'absolute',
    overflow: 'hidden',
    left: 0,
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'flex-end',
    zIndex: 1,
  },
})
