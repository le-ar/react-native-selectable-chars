# Native selection example

A React Native 0.85.3 / React 19.2.3 application linked to the local library through the pnpm workspace. Android uses autolinking and Fabric; iOS uses CocoaPods, the React Native dependency provider, and the UIKit scene lifecycle. There is no manual native linking.

The example pins `react-native-safe-area-context` to 5.8.1. Its [native build configuration](https://github.com/AppAndFlow/react-native-safe-area-context/blob/v5.8.1/android/src/main/jni/CMakeLists.txt) applies the React Native compiler options required for compatible Fabric props layouts; 5.5.2 can crash on Android with React Native 0.85. Rebuild the native application after changing this dependency.

The demo generates a book of more than a million UTF-16 units once on mount. Its reader has a finite viewport and owns its scrolling. Long press the text and drag a selection handle toward the top or bottom edge to extend a range across screens. The custom menu is React Native JSX with a passage preview, color swatches, and several actions. Saved marks remain when selection is cleared. The controls change font size, select a complete emoji, return to the top, or clear marks.

## Setup

Requirements: Node 22.11 or newer, pnpm 10, Android SDK 36 and a compatible JDK, or macOS with Xcode and CocoaPods for iOS. The app targets Android API 24+ and iOS 16+.

From the repository root:

```sh
pnpm install
pnpm build
pnpm --dir example typecheck
```

Install the iOS dependencies from `example`:

```sh
bundle install
bundle exec pod install --project-directory=ios
```

Use `ios/example.xcworkspace` after installing pods. If Xcode cannot find Node, set its absolute executable path in `ios/.xcode.env.local`; that machine-specific file is ignored by Git.

## Run

Start Metro from `example`:

```sh
pnpm start
```

In another terminal in `example`:

```sh
pnpm android
# or
pnpm ios
```

## Compile without launching the application

Android, from `example/android`:

```sh
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
```

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`. Building a specific architecture shortens a compile check; omit the architecture argument when all configured ABIs are needed.

iOS, from `example` after installing pods:

```sh
xcodebuild -workspace ios/example.xcworkspace -scheme example \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO build
```

These commands check compilation and native integration. They do not measure scrolling or selection performance.

## Suggested device checks

- Extend a selection through several chapters in both directions and verify edge autoscrolling.
- Save gold and blue marks with the custom JSX menu, continue reading, and confirm their ranges remain correct.
- Select a single character, spaces, line breaks, composed emoji, and mixed right-to-left text.
- Change the font size and device orientation while keeping saved marks.
- Check VoiceOver or TalkBack, then measure release-build startup, scrolling, selection, and memory on a physical device.

These are manual verification scenarios, not claims that the example has passed device testing.
