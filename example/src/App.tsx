import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import SelectChars, {
  type CustomSelection,
  type SelectCharsRef,
} from 'react-native-select-chars';

const GOLD = '#ffe29a';
const BLUE = '#b9dcff';
const SELECTION_COLORS = [
  { selectionColor: 'rgba(0,122,255,0.22)', selectionHandleColor: '#007AFF' },
  { selectionColor: 'rgba(174,37,202,0.22)', selectionHandleColor: '#AE25CA' },
  { selectionColor: 'rgba(0,146,108,0.22)', selectionHandleColor: '#00926C' },
] as const;

function createBook(): string {
  const paragraph =
    'A native text view lays out this document while React renders the controls and the selection menu. ' +
    'Long press a word, then drag either handle toward the edge of the screen to continue selecting across paragraphs. ' +
    'The whole book is one selection surface, so the range may cross many screens. ' +
    'Unicode samples: cafe\u0301, 👩🏽‍💻, 👨‍👩‍👧‍👦, 日本語, Привет, مرحبا بالعالم, שלום עולם. ';

  return Array.from(
    { length: 2000 },
    (_, index) => `Chapter ${index + 1}\n\n${paragraph}${paragraph}\n\n`,
  ).join('');
}

function Button({
  children,
  onPress,
}: {
  children: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.buttonText}>{children}</Text>
    </Pressable>
  );
}

function Reader() {
  const text = useMemo(createBook, []);
  const reader = useRef<SelectCharsRef>(null);
  const [fontSize, setFontSize] = useState(18);
  const [colorIndex, setColorIndex] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [selections, setSelections] = useState<CustomSelection[]>([]);
  const selectionColors = SELECTION_COLORS[colorIndex];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Selectable Chars 2</Text>
        <Text style={styles.subtitle}>
          {text.length.toLocaleString()} UTF-16 units · {selections.length}{' '}
          saved marks
        </Text>
        <Text style={styles.instructions}>
          Long press, then drag a handle across screens. The selection menu is
          ordinary React Native JSX.
        </Text>
        <View style={styles.controls}>
          <Button onPress={() => setFontSize(value => Math.max(14, value - 2))}>
            A−
          </Button>
          <Button onPress={() => setFontSize(value => Math.min(30, value + 2))}>
            A+
          </Button>
          <Button
            onPress={() =>
              setColorIndex(index => (index + 1) % SELECTION_COLORS.length)
            }
          >
            Toggle color
          </Button>
          <Button onPress={() => reader.current?.scrollToOffset(0)}>Top</Button>
          <Button
            onPress={() => {
              const start = text.indexOf('👩🏽‍💻');
              reader.current?.setSelection(start, start + '👩🏽‍💻'.length - 1);
            }}
          >
            Select emoji
          </Button>
          <Button
            onPress={() => {
              reader.current?.clearSelection();
              setSelections([]);
            }}
          >
            Clear
          </Button>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {selecting ? 'Selection active' : 'Ready to select'} · {fontSize}px
        </Text>
      </View>
      <SelectChars
        ref={reader}
        style={styles.reader}
        text={text}
        fontSize={fontSize}
        selectionColor={selectionColors.selectionColor}
        selectionHandleColor={selectionColors.selectionHandleColor}
        selectEnabled
        selections={selections}
        onStartSelect={() => setSelecting(true)}
        onEndSelect={() => setSelecting(false)}
        renderMenu={({ start, end, text: selectedText, cancelSelect }) => {
          const save = (color: string) => {
            setSelections(previous => [
              ...previous,
              { start, end, color, hint: `Mark ${previous.length + 1}` },
            ]);
            cancelSelect();
          };

          return (
            <View style={styles.menu}>
              <Text style={styles.menuHeading}>
                Mark this passage · {end - start + 1} UTF-16 units
              </Text>
              <Text numberOfLines={2} style={styles.preview}>
                {selectedText.slice(0, 120)}
              </Text>
              <View style={styles.menuActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Save a gold mark"
                  onPress={() => save(GOLD)}
                  style={[styles.markButton, { backgroundColor: GOLD }]}
                >
                  <View style={[styles.swatch, styles.goldSwatch]} />
                  <Text style={styles.markText}>Gold</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Save a blue mark"
                  onPress={() => save(BLUE)}
                  style={[styles.markButton, { backgroundColor: BLUE }]}
                >
                  <View style={[styles.swatch, styles.blueSwatch]} />
                  <Text style={styles.markText}>Blue</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={cancelSelect}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Reader />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  goldSwatch: { backgroundColor: '#b96b00' },
  blueSwatch: { backgroundColor: '#165ea1' },
  screen: { flex: 1, backgroundColor: '#f6f8fc' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 23, fontWeight: '700', color: '#152b48' },
  subtitle: { marginTop: 4, fontSize: 12, color: '#4f627b' },
  instructions: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: '#354b65',
  },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  button: {
    backgroundColor: '#e3eaf5',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  pressed: { opacity: 0.65 },
  buttonText: { color: '#173657', fontWeight: '600', fontSize: 12 },
  status: { color: '#4f627b', fontSize: 11, marginTop: 8 },
  reader: { flex: 1, backgroundColor: '#ffffff' },
  menu: {
    width: 288,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#152b48',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  menuHeading: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  preview: { color: '#cfdaeb', fontSize: 12, lineHeight: 17, marginTop: 6 },
  menuActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  markButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
  },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  markText: { fontSize: 12, color: '#152b48', fontWeight: '700' },
  cancelButton: { paddingVertical: 8, paddingHorizontal: 4 },
  cancelText: { color: '#ffffff', fontSize: 12 },
});
