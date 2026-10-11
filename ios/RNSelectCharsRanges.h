#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

// UTF-16 offsets, with an exclusive end. Invalid or empty ranges return NSNotFound.
FOUNDATION_EXPORT NSRange RNSelectCharsComposedRange(NSString *text, NSInteger start, NSInteger end);

NS_ASSUME_NONNULL_END
