#import <UIKit/UIKit.h>
#import "RNSelectCharsRanges.h"

NS_ASSUME_NONNULL_BEGIN

@interface RNSelectCharsHighlight : NSObject
@property (nonatomic) NSRange range;
@property (nonatomic, strong) UIColor *color;
@property (nonatomic, copy) NSString *hint;
@end

@interface RNSelectCharsContentView : UIView
@property (nonatomic, readonly) UITextView *textView;
@property (nonatomic, readonly) NSString *document;
@property (nonatomic, copy, nullable) void (^onSelectionChange)(NSRange range, NSString *phase, CGRect anchor);
@property (nonatomic, getter=isSelectionEnabled) BOOL selectionEnabled;

- (void)setDocument:(NSString *)text;
- (void)setFontSize:(CGFloat)fontSize
        lineHeight:(CGFloat)lineHeight
        fontFamily:(NSString *)fontFamily
  allowFontScaling:(BOOL)allowFontScaling
         textColor:(UIColor *)textColor
    selectionColor:(UIColor *)selectionColor;
- (void)setHighlights:(NSArray<RNSelectCharsHighlight *> *)highlights;
- (void)clearSelection;
- (void)setSelectionFrom:(NSInteger)start to:(NSInteger)end;
- (void)scrollToOffset:(NSInteger)offset animated:(BOOL)animated;
- (void)invalidate;
@end

NS_ASSUME_NONNULL_END
