#import "RNSelectCharsRanges.h"

NSRange RNSelectCharsComposedRange(NSString *text, NSInteger start, NSInteger end)
{
  if (start < 0 || end <= start || (NSUInteger)start >= text.length) {
    return NSMakeRange(NSNotFound, 0);
  }
  NSUInteger upper = MIN((NSUInteger)end, text.length);
  NSRange first = [text rangeOfComposedCharacterSequenceAtIndex:(NSUInteger)start];
  NSRange last = [text rangeOfComposedCharacterSequenceAtIndex:upper - 1];
  NSUInteger lower = first.location;
  upper = NSMaxRange(last);
  // NSString's composed-sequence API treats CR/LF separately on some OS
  // versions; Unicode grapheme segmentation treats a CRLF pair as one unit.
  if (lower > 0 && [text characterAtIndex:lower] == '\n' && [text characterAtIndex:lower - 1] == '\r') lower--;
  if (upper < text.length && [text characterAtIndex:upper - 1] == '\r' && [text characterAtIndex:upper] == '\n') upper++;
  return NSMakeRange(lower, upper - lower);
}
