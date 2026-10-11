#import <Foundation/Foundation.h>
#import "../RNSelectCharsRanges.h"

static void expectRange(NSString *text, NSInteger start, NSInteger end, NSUInteger location, NSUInteger length)
{
  NSRange actual = RNSelectCharsComposedRange(text, start, end);
  NSCAssert(NSEqualRanges(actual, NSMakeRange(location, length)),
            @"%@ [%ld, %ld) was %@, expected %@", text, (long)start, (long)end,
            NSStringFromRange(actual), NSStringFromRange(NSMakeRange(location, length)));
}

// A Foundation-only native regression check; no simulator or React Native required.
int main(void)
{
  @autoreleasepool {
    expectRange(@"", 0, 1, NSNotFound, 0);
    expectRange(@"abc", -1, 1, NSNotFound, 0);
    expectRange(@"abc", 2, 2, NSNotFound, 0);
    expectRange(@"abc", 4, 5, NSNotFound, 0);
    expectRange(@"abc", 2, NSIntegerMax, 2, 1);
    expectRange(@"a b!", 1, 2, 1, 1); // A space is selectable by itself.
    expectRange(@"a b!", 3, 4, 3, 1); // Punctuation is selectable by itself.
    expectRange(@"Ae\u0301B", 2, 3, 1, 2); // Combining accent.
    expectRange(@"A😀B", 2, 3, 1, 2); // Inside a UTF-16 surrogate pair.
    NSString *family = @"👩‍👩‍👧‍👦";
    expectRange(family, 3, 5, 0, family.length); // Entire ZWJ grapheme.
    expectRange(@"🇦🇺", 1, 2, 0, 4); // Regional indicator pair.
    expectRange(@"A\r\nB", 2, 3, 1, 2); // CRLF is one grapheme.
    expectRange(@"مرحبا 世界", 0, 8, 0, 8);
    NSString *paragraphs = @"one\ntwo\nthree";
    expectRange(paragraphs, 1, 12, 1, 11); // Continuous cross-paragraph range.
    NSLog(@"PASS: 14 native UTF-16/grapheme range cases");
  }
  return 0;
}
