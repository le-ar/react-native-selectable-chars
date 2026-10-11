# react-native-select-chars 2.0

Native, scrollable text selection for long, ready-made documents on iOS and Android. Select individual characters or extend one range across paragraphs and screens. Render the selection menu with arbitrary React Native components, including previews, buttons, inputs, and your own application controls.

Version 2 replaces the JavaScript character-by-character renderer and geometry cache. iOS uses a read-only `UITextView` with TextKit 2. Android uses recycled `RecyclerView` blocks with bounded `StaticLayout` instances and one document-wide selection controller. Text layout, hit testing, handles, and edge autoscrolling stay native; JavaScript receives offsets and a small menu anchor.

## Requirements and installation

- React Native 0.85+ with Fabric and React 19.2.3+; the example is pinned to React Native 0.85.3.
- iOS 16+, Android API 24+, Android compile SDK 35 or newer for RecyclerView 1.4.
- A native development build. The component is not included in Expo Go.

The package name remains **`react-native-select-chars`**, while the repository is named `react-native-selectable-chars`.

After the 2.0.0 package is published:

```sh
npm install react-native-select-chars@2.0.0
cd ios && pod install
```

Autolinking registers the Fabric component and runs React Native codegen. Rebuild the native application after installation. The repository also contains a pnpm workspace example for testing the source checkout; see [example/README.md](example/README.md).

## Custom React Native menu

```tsx
import * as React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import SelectChars, {type CustomSelection} from 'react-native-select-chars';

export function Reader({book}: {book: string}) {
  const [marks, setMarks] = React.useState<CustomSelection[]>([]);

  return (
    <SelectChars
      style={styles.reader}
      text={book}
      fontSize={18}
      selections={marks}
      renderMenu={({start, end, text, cancelSelect}) => (
        <View style={styles.menu}>
          <Text numberOfLines={3}>{text}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMarks(current => [
                ...current,
                {start, end, color: '#FFE58A', hint: 'Saved'},
              ]);
              cancelSelect();
            }}>
            <Text>Highlight passage</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={cancelSelect}>
            <Text>Close</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  reader: {height: 500},
  menu: {width: 240, padding: 16, gap: 12, backgroundColor: 'white'},
});
```

`renderMenu` returns normal React Native JSX, with access to your state, hooks in child components, and event handlers. There is no list of native action titles. The menu is a sibling overlay inside the reader, measured and positioned near the selected text, then clamped to the viewport. It does not open a native modal. Use a `ScrollView` in your menu when its content can exceed the available space.

The menu hides while a selection handle is moving, the reader is scrolling, or its anchor is outside the viewport. It reappears after scrolling settles when the anchor is visible. With no menu renderer, selection and callbacks still work; the platform edit menu is suppressed. Your application provides Copy or other actions as needed.

## A reader owns its scrolling

Give the component a **finite viewport** using `height`, or `flex: 1` inside a bounded parent while overriding the default height. The default height is 320 logical pixels. It scrolls its text internally; rendering a document as an unbounded auto-height child of another vertical `ScrollView` defeats this architecture and can interfere with gestures.

Long press starts selection at a composed character. Drag either handle toward an edge to extend the same range while the document scrolls. A magnifier follows selection gestures. On Android, a short tap clears an existing selection; starting a new selection requires a long press. Selection is stored as global document offsets and survives Android block recycling. Replacing `text` clears active selection. Saved marks belong to the supplied text; the caller must update them when replacing or editing that text.

The whole source string still occupies memory and crosses into the native text engine when it changes. Very large selected passages also produce a JavaScript substring when committed. This is a finite-document reader with lazy native layout, not a promise of unlimited document size or streaming updates. Keep `text` and `selections` stable between actual changes.

## Offsets and Unicode

All public offsets use **UTF-16 code units**, like JavaScript string indices. `end` is **inclusive**. Retrieve the exact passage with `text.slice(start, end + 1)`; spaces, punctuation, and newlines are part of the range. Native commands and events use exclusive ends internally; the wrapper converts them once.

Native selection boundaries expand to whole composed characters. For example, in `A👩‍💻B`, the emoji occupies the public range `{start: 1, end: 5}`. Repeated words are distinguished by offsets, never by searching their text. Saved ranges must be non-empty integer ranges inside the document; invalid saved marks are ignored. Imperative invalid ranges throw `RangeError`.

## API

The component is available as both the default export and the named `SelectChars` export.

| Prop | Behavior |
| --- | --- |
| `text: string` | Required source document. |
| `style`, other `ViewProps` | Reader viewport styling, layout callback, accessibility/test attributes. Text is styled through the props below. Use an outer wrapper for additional padding. |
| `fontSize` | Default 16; positive logical size, respecting font scaling by default. |
| `fontFamily` | Native family name; unavailable families fall back to the system font. |
| `lineHeight` | Positive logical line height; omitted or zero uses native font metrics. |
| `textColor` | React Native color; default `#222222`. |
| `selectionColor` | Active selection background, including alpha; default `rgba(0,122,255,0.22)`. |
| `selectionHandleColor` | Independent color of active selection handles and boundary stems; default `#007AFF`. |
| `allowFontScaling` | Default `true`. |
| `selectEnabled` | Default `true`; disabling clears active selection. Reading and saved highlights remain available. |
| `selections` | Readonly array of `{start, end, color?, hint?}`. Ends are inclusive; default mark color is `#FFE58A`. |
| `renderMenu(context)` | Returns arbitrary React content. Context is `{start, end, text, anchor, cancelSelect}`. |
| `menuStyle` | Additional style on the measured menu container. |
| `onSelectionChange(selection)` | Called when a range is committed or an existing selection is cleared (`null`). Selection is `{start, end, text}`. Scrolling only updates the anchor. |
| `onStartSelect`, `onEndSelect` | Balanced drag lifecycle callbacks; gestures stay native. |
| `onSelect(start, end, topY, centerX, cancelSelect)` | Compatibility callback. Return JSX to supply the menu when `renderMenu` is absent; return `false` to clear selection. Coordinates are relative to the reader. |

`anchor` is `{x, y, width, height}` in viewport-local logical pixels. It describes the visible selection endpoint, not a per-character geometry array. Hints are small native overlay badges; they do not insert characters into the document or change offsets. Overlapping marks render in the order supplied. Provide accessible labels for your custom menu controls.

Selection colors accept React Native colors. Use a translucent `selectionColor` with opaque handles to keep the boundaries easy to see. Updating either color changes the active selection in place without clearing its range or moving the document. Saved marks use their own `selections[].color` values. The example's **Toggle color** button cycles three pairs on the current selection.

The typed ref exposes:

```tsx
import {useRef} from 'react';
import SelectChars, {type SelectCharsRef} from 'react-native-select-chars';

const reader = useRef<SelectCharsRef>(null);

// <SelectChars ref={reader} text={book} style={{height: 500}} />
reader.current?.setSelection(10, 29); // inclusive, snaps to whole graphemes
reader.current?.clearSelection();
reader.current?.scrollToOffset(10000, true); // UTF-16 position, optional animation
```

## Migration from 1.x

This is a breaking release requiring the modern React Native architecture and OS versions listed above.

1. Replace auto-height embedding with a bounded reader viewport. Remove the outer vertical scroll container around the document.
2. Move text appearance from the container style into `fontSize`, `fontFamily`, `lineHeight`, and `textColor`.
3. Use `renderMenu` for custom UI and `onSelectionChange` for committed ranges. The legacy `onSelect` callback remains available, including JSX return values and cancellation.
4. Keep inclusive UTF-16 ranges for `selections`; migrate any code that assumed Unicode code-point indices or global screen coordinates.
5. Rebuild both native applications. The old JavaScript controller, measurement helpers, and placeholder native module are removed; importing internal files is unsupported.

Android caps each layout block at 8,192 UTF-16 units and prefers paragraph/word boundaries. An unusually long paragraph can restart soft wrapping at a block boundary; it never inserts a newline into the source or changes offsets. A pathological single grapheme longer than that cap may span layout blocks, while selection still snaps to a whole grapheme. iOS delegates layout to TextKit 2. Platform line breaking and handle appearance can differ.

Android uses the platform magnifier on API 28+ and a bounded native overlay of the visible text on API 24–27. iOS 17+ customizes the public selection display interaction while retaining system handles. iOS 16 uses native selection overlays for independent colors and retains the `UITextView` selection gestures and loupe.

## Development and validation

```sh
pnpm install
pnpm typecheck
pnpm --dir example typecheck
pnpm lint
pnpm test
pnpm build
pnpm codegen
```

JavaScript tests cover a million-unit document using one native surface, UTF-16 conversion, repeated passages, custom menu actions, cancellation, drag lifecycle, stale events after text replacement, saved marks, imperative commands, and color changes that preserve the active range. Android JVM tests cover bounded chunking, large paragraphs, Unicode boundaries, interval queries, global range math, pointer ownership, and bounded loupe geometry. iOS tests exercise Foundation range helpers and the actual UIKit/TextKit 2 engine with a million-unit document, anchors, and synthetic gesture/autoscroll states; see [ios/tests/README.md](ios/tests/README.md).

From `example/android`, run `./gradlew :app:assembleDebug :react-native-select-chars:testDebugUnitTest`. See the example README for the iOS compile command and manual device scenarios. Compile checks and unit tests do not replace physical-device validation of gesture arbitration, VoiceOver/TalkBack, or release-build scrolling and memory behavior. No cross-device performance benchmark is claimed.

## License

MIT.
