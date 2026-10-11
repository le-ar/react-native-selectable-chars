#import "RNSelectCharsContentView.h"

@implementation RNSelectCharsHighlight
@end

// UITextView owns shaping, selection handles, magnification, RTL and accessibility.
// No code in this library may access UITextView.layoutManager: that switches to TextKit 1.
@interface RNSelectCharsTextView : UITextView
@end

@implementation RNSelectCharsTextView
- (BOOL)canPerformAction:(SEL)action withSender:(id)sender
{
  return NO;
}
@end

@interface RNSelectCharsHintOverlay : UIView
@property (nonatomic, copy) NSArray<NSDictionary *> *badges;
@end

@implementation RNSelectCharsHintOverlay
- (void)drawRect:(CGRect)rect
{
  for (NSDictionary *badge in self.badges) {
    CGRect frame = [badge[@"frame"] CGRectValue];
    UIColor *color = badge[@"color"];
    [color setFill];
    [[UIBezierPath bezierPathWithRoundedRect:frame cornerRadius:4] fill];
    [badge[@"text"] drawInRect:CGRectInset(frame, 4, 1)
               withAttributes:badge[@"attributes"]];
  }
}
@end

@interface RNSelectCharsContentView () <UITextViewDelegate, UIGestureRecognizerDelegate>
@end

@implementation RNSelectCharsContentView {
  RNSelectCharsTextView *_textView;
  NSString *_document;
  RNSelectCharsHintOverlay *_hintOverlay;
  NSArray<RNSelectCharsHighlight *> *_highlights;
  NSArray<RNSelectCharsHighlight *> *_hintsByStart;
  CGFloat _fontSize;
  CGFloat _lineHeight;
  NSString *_fontFamily;
  UIColor *_textColor;
  BOOL _allowFontScaling;
  BOOL _changingSelection;
  BOOL _nativeSelectionActive;
  BOOL _pressActive;
  NSRange _pressOrigin;
  NSRange _pressRange;
  CGPoint _pressViewportPoint;
  UILongPressGestureRecognizer *_longPress;
  NSTimer *_selectionEndTimer;
  NSTimer *_autoScrollTimer;
  BOOL _positionUpdateScheduled;
  NSUInteger _generation;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if ((self = [super initWithFrame:frame])) {
    _fontSize = 16;
    _document = @"";
    _fontFamily = @"";
    _textColor = UIColor.labelColor;
    _allowFontScaling = YES;
    _selectionEnabled = YES;
    _highlights = @[];
    _hintsByStart = @[];
    // A nil text container explicitly creates a TextKit 2 text view on iOS 16+.
    _textView = [[RNSelectCharsTextView alloc] initWithFrame:self.bounds textContainer:nil];
    _textView.delegate = self;
    _textView.editable = NO;
    _textView.selectable = YES;
    _textView.scrollEnabled = YES;
    _textView.backgroundColor = UIColor.clearColor;
    _textView.textContainerInset = UIEdgeInsetsMake(12, 0, 12, 0);
    _textView.textContainer.lineFragmentPadding = 0;
    _textView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
    _textView.keyboardDismissMode = UIScrollViewKeyboardDismissModeNone;
    _textView.dataDetectorTypes = UIDataDetectorTypeNone;
    _textView.alwaysBounceVertical = YES;
    _textView.accessibilityIdentifier = @"RNSelectCharsText";
    [self addSubview:_textView];

    _hintOverlay = [[RNSelectCharsHintOverlay alloc] initWithFrame:self.bounds];
    _hintOverlay.userInteractionEnabled = NO;
    _hintOverlay.isAccessibilityElement = NO;
    _hintOverlay.backgroundColor = UIColor.clearColor;
    _hintOverlay.clipsToBounds = YES;
    [self addSubview:_hintOverlay];

    // Observe alongside UIKit's recognizers. During this gesture our grapheme
    // range wins over UIKit's initial word range; later native handle drags work normally.
    _longPress = [[UILongPressGestureRecognizer alloc] initWithTarget:self action:@selector(longPressed:)];
    _longPress.minimumPressDuration = 0.35;
    _longPress.cancelsTouchesInView = NO;
    _longPress.delegate = self;
    [_textView addGestureRecognizer:_longPress];
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(contentSizeCategoryChanged:)
                                                 name:UIContentSizeCategoryDidChangeNotification
                                               object:nil];
    [self updateFont];
  }
  return self;
}

- (UITextView *)textView { return _textView; }
- (NSString *)document { return _document; }

- (void)dealloc
{
  [_selectionEndTimer invalidate];
  [_autoScrollTimer invalidate];
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  _textView.frame = self.bounds;
  _hintOverlay.frame = self.bounds;
  [self schedulePositionUpdate];
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (self.window == nil) {
    [self clearSelection];
    [self stopTimers];
  } else {
    [self schedulePositionUpdate];
  }
}

- (void)invalidate
{
  [self clearSelection];
  [self stopTimers];
  self.onSelectionChange = nil;
}

- (void)stopTimers
{
  _generation++;
  [_selectionEndTimer invalidate];
  _selectionEndTimer = nil;
  [_autoScrollTimer invalidate];
  _autoScrollTimer = nil;
  _pressActive = NO;
  _textView.panGestureRecognizer.enabled = YES;
  _nativeSelectionActive = NO;
  _positionUpdateScheduled = NO;
}

- (void)setSelectionEnabled:(BOOL)selectionEnabled
{
  if (_selectionEnabled == selectionEnabled) return;
  _selectionEnabled = selectionEnabled;
  if (!selectionEnabled) [self clearSelection];
  _textView.selectable = selectionEnabled;
  _longPress.enabled = selectionEnabled;
}

- (void)setDocument:(NSString *)text
{
  if ([_document isEqualToString:text]) return;
  [self clearSelection];
  [self stopTimers];
  _changingSelection = YES;
  _document = [text copy];
  _textView.text = _document;
  _textView.contentOffset = CGPointZero;
  _changingSelection = NO;
  [self updateFont];
  [self applyHighlightColors];
  [self schedulePositionUpdate];
}

- (void)setFontSize:(CGFloat)fontSize
        lineHeight:(CGFloat)lineHeight
        fontFamily:(NSString *)fontFamily
  allowFontScaling:(BOOL)allowFontScaling
         textColor:(UIColor *)textColor
    selectionColor:(UIColor *)selectionColor
{
  _fontSize = MAX(1, fontSize);
  _lineHeight = MAX(0, lineHeight);
  _fontFamily = [fontFamily copy];
  _allowFontScaling = allowFontScaling;
  _textColor = textColor;
  _textView.tintColor = selectionColor;
  [self updateFont];
}

- (void)contentSizeCategoryChanged:(NSNotification *)notification
{
  if (_allowFontScaling) [self updateFont];
}

- (void)updateFont
{
  UIFont *baseFont = _fontFamily.length ? [UIFont fontWithName:_fontFamily size:_fontSize] : nil;
  baseFont = baseFont ?: [UIFont systemFontOfSize:_fontSize];
  UIFont *font = _allowFontScaling ? [[UIFontMetrics defaultMetrics] scaledFontForFont:baseFont
                                                                  compatibleWithTraitCollection:self.traitCollection] : baseFont;
  NSMutableParagraphStyle *paragraph = [NSMutableParagraphStyle new];
  if (_lineHeight > 0) {
    CGFloat height = MAX(font.lineHeight, _lineHeight * font.pointSize / _fontSize);
    paragraph.minimumLineHeight = height;
    paragraph.maximumLineHeight = height;
  }
  NSRange range = NSMakeRange(0, _textView.textStorage.length);
  _changingSelection = YES;
  [_textView.textStorage beginEditing];
  [_textView.textStorage addAttributes:@{NSFontAttributeName:font,
                                        NSForegroundColorAttributeName:_textColor,
                                        NSParagraphStyleAttributeName:paragraph}
                                range:range];
  [_textView.textStorage endEditing];
  _textView.font = font;
  _changingSelection = NO;
  [self schedulePositionUpdate];
}

- (void)setHighlights:(NSArray<RNSelectCharsHighlight *> *)highlights
{
  _highlights = [highlights copy];
  NSPredicate *withHint = [NSPredicate predicateWithBlock:^BOOL(RNSelectCharsHighlight *highlight, NSDictionary *bindings) {
    return highlight.hint.length > 0;
  }];
  _hintsByStart = [[_highlights filteredArrayUsingPredicate:withHint]
      sortedArrayUsingComparator:^NSComparisonResult(RNSelectCharsHighlight *a, RNSelectCharsHighlight *b) {
        if (a.range.location < b.range.location) return NSOrderedAscending;
        if (a.range.location > b.range.location) return NSOrderedDescending;
        return NSOrderedSame;
      }];
  [self applyHighlightColors];
  [self schedulePositionUpdate];
}

- (void)applyHighlightColors
{
  NSTextStorage *storage = _textView.textStorage;
  _changingSelection = YES;
  [storage beginEditing];
  [storage removeAttribute:NSBackgroundColorAttributeName range:NSMakeRange(0, storage.length)];
  for (RNSelectCharsHighlight *highlight in _highlights) {
    if (highlight.range.location < storage.length) {
      NSRange range = NSMakeRange(highlight.range.location,
                                 MIN(highlight.range.length, storage.length - highlight.range.location));
      [storage addAttribute:NSBackgroundColorAttributeName value:highlight.color range:range];
    }
  }
  [storage endEditing];
  _changingSelection = NO;
}

- (NSRange)visibleRange
{
  // This is already laid out by UITextView. Do not ensureLayout for the whole
  // document or query caret geometry for an off-screen selection endpoint.
  NSTextLayoutManager *manager = _textView.textLayoutManager;
  NSTextRange *range = manager.textViewportLayoutController.viewportRange;
  NSTextContentManager *content = manager.textContentManager;
  if (range == nil || content == nil) return NSMakeRange(NSNotFound, 0);
  id<NSTextLocation> origin = content.documentRange.location;
  NSInteger start = [content offsetFromLocation:origin toLocation:range.location];
  NSInteger end = [content offsetFromLocation:origin toLocation:range.endLocation];
  if (start < 0 || end < start || (NSUInteger)start >= _document.length) {
    return NSMakeRange(NSNotFound, 0);
  }
  end = MIN(end, (NSInteger)_document.length);
  return NSMakeRange((NSUInteger)start, (NSUInteger)(end - start));
}

- (UITextRange *)textRange:(NSRange)range
{
  if (range.location == NSNotFound || NSMaxRange(range) > _document.length) return nil;
  UITextPosition *start = [_textView positionFromPosition:_textView.beginningOfDocument offset:range.location];
  UITextPosition *end = [_textView positionFromPosition:start offset:range.length];
  return start && end ? [_textView textRangeFromPosition:start toPosition:end] : nil;
}

- (CGRect)selectionAnchor
{
  if (_textView.dragging || _textView.decelerating || _pressActive) return CGRectZero;
  NSRange selected = _textView.selectedRange;
  NSRange visible = [self visibleRange];
  if (selected.length == 0 || visible.location == NSNotFound) return CGRectZero;
  NSRange intersection = NSIntersectionRange(selected, visible);
  if (intersection.length == 0) return CGRectZero;
  UITextRange *range = [self textRange:intersection];
  CGRect rect = CGRectNull;
  for (UITextSelectionRect *selectionRect in [_textView selectionRectsForRange:range]) {
    CGRect visibleRect = CGRectIntersection(selectionRect.rect, _textView.bounds);
    if (!CGRectIsNull(visibleRect) && visibleRect.size.width > 0 && visibleRect.size.height > 0) {
      rect = CGRectIsNull(rect) ? visibleRect : CGRectUnion(rect, visibleRect);
    }
  }
  if (CGRectIsNull(rect)) {
    rect = CGRectIntersection([_textView caretRectForPosition:range.start], _textView.bounds);
  }
  if (CGRectIsNull(rect) || CGRectIsEmpty(rect)) return CGRectZero;
  return CGRectIntersection([_textView convertRect:rect toView:self], self.bounds);
}

- (void)emit:(NSString *)phase
{
  if (!self.onSelectionChange) return;
  NSRange range = _textView.selectedRange;
  if (range.length == 0 || range.location == NSNotFound) {
    if ([phase isEqualToString:@"clear"]) self.onSelectionChange(NSMakeRange(NSNotFound, 0), @"clear", CGRectZero);
    return;
  }
  self.onSelectionChange(range, phase, [self selectionAnchor]);
}

- (void)clearSelection
{
  BOOL hadSelection = _textView.selectedRange.length > 0 || _nativeSelectionActive || _pressActive;
  [self stopTimers];
  _changingSelection = YES;
  _textView.selectedRange = NSMakeRange(0, 0);
  [_textView resignFirstResponder];
  _changingSelection = NO;
  if (hadSelection) [self emit:@"clear"];
}

- (void)setSelectionFrom:(NSInteger)start to:(NSInteger)end
{
  if (!self.selectionEnabled) return;
  NSRange range = RNSelectCharsComposedRange(_document, start, end);
  if (range.location == NSNotFound) {
    [self clearSelection];
    return;
  }
  [self stopTimers];
  _changingSelection = YES;
  [_textView becomeFirstResponder];
  _textView.selectedRange = range;
  _changingSelection = NO;
  [_textView layoutIfNeeded];
  [self emit:@"end"];
  [self schedulePositionUpdate];
}

- (void)scrollToOffset:(NSInteger)offset animated:(BOOL)animated
{
  CGFloat maximum = MAX(0, _textView.contentSize.height - _textView.bounds.size.height);
  [_textView setContentOffset:CGPointMake(0, MIN(MAX(0, offset), maximum)) animated:animated];
  [self schedulePositionUpdate];
}

- (void)textViewDidChangeSelection:(UITextView *)textView
{
  if (_changingSelection) return;
  if (_pressActive) {
    _changingSelection = YES;
    textView.selectedRange = _pressRange;
    _changingSelection = NO;
    return;
  }
  [_selectionEndTimer invalidate];
  _selectionEndTimer = nil;
  if (!self.selectionEnabled || textView.selectedRange.length == 0) {
    BOOL active = _nativeSelectionActive;
    _nativeSelectionActive = NO;
    if (active || self.selectionEnabled) [self emit:@"clear"];
    return;
  }
  [self emit:_nativeSelectionActive ? @"change" : @"start"];
  _nativeSelectionActive = YES;
  __weak RNSelectCharsContentView *weakSelf = self;
  _selectionEndTimer = [NSTimer timerWithTimeInterval:0.15 repeats:NO block:^(NSTimer *timer) {
    RNSelectCharsContentView *strongSelf = weakSelf;
    if (!strongSelf) return;
    strongSelf->_selectionEndTimer = nil;
    strongSelf->_nativeSelectionActive = NO;
    [strongSelf emit:@"end"];
  }];
  [[NSRunLoop mainRunLoop] addTimer:_selectionEndTimer forMode:NSRunLoopCommonModes];
}

- (UIMenu *)textView:(UITextView *)textView editMenuForTextInRange:(NSRange)range
   suggestedActions:(NSArray<UIMenuElement *> *)suggestedActions
{
  return [UIMenu menuWithChildren:@[]];
}

- (UIMenu *)textView:(UITextView *)textView editMenuForTextInRanges:(NSArray<NSValue *> *)ranges
   suggestedActions:(NSArray<UIMenuElement *> *)suggestedActions
{
  return [UIMenu menuWithChildren:@[]];
}

- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer
    shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other
{
  // Once the long press owns a drag, an enclosing scroll view must not move the
  // whole React Native page under the selection. UIKit's text gestures coexist.
  if ([other.view isKindOfClass:UIScrollView.class] && other.view != _textView &&
      other == ((UIScrollView *)other.view).panGestureRecognizer) return NO;
  return YES;
}

- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)gestureRecognizer
{
  // Existing handles belong to UIKit; a new long press starts from a single
  // grapheme only when no selection is active.
  return self.selectionEnabled && _document.length > 0 && _textView.selectedRange.length == 0;
}

- (NSRange)graphemeAtViewportPoint:(CGPoint)point
{
  CGPoint location = [self convertPoint:point toView:_textView];
  // Hit the glyph, rather than the nearest caret (which could select its next
  // neighbor when pressing the trailing half of a glyph). Both APIs are local.
  UITextRange *character = [_textView characterRangeAtPoint:location];
  UITextPosition *position = character.start ?: [_textView closestPositionToPoint:location];
  if (position == nil || _document.length == 0) return NSMakeRange(NSNotFound, 0);
  NSInteger offset = [_textView offsetFromPosition:_textView.beginningOfDocument toPosition:position];
  offset = MIN(MAX(0, offset), (NSInteger)_document.length - 1);
  return RNSelectCharsComposedRange(_document, offset, offset + 1);
}

- (void)longPressed:(UILongPressGestureRecognizer *)recognizer
{
  _pressViewportPoint = [recognizer locationInView:self];
  if (recognizer.state == UIGestureRecognizerStateBegan) {
    [self stopTimers];
    _pressOrigin = [self graphemeAtViewportPoint:_pressViewportPoint];
    if (_pressOrigin.location == NSNotFound) return;
    _pressActive = YES;
    _textView.panGestureRecognizer.enabled = NO;
    _pressRange = _pressOrigin;
    _changingSelection = YES;
    [_textView becomeFirstResponder];
    _textView.selectedRange = _pressRange;
    _changingSelection = NO;
    [self emit:@"start"];
    __weak RNSelectCharsContentView *weakSelf = self;
    _autoScrollTimer = [NSTimer timerWithTimeInterval:1.0 / 60.0 repeats:YES block:^(NSTimer *timer) {
      [weakSelf autoScrollSelection];
    }];
    [[NSRunLoop mainRunLoop] addTimer:_autoScrollTimer forMode:NSRunLoopCommonModes];
  } else if (recognizer.state == UIGestureRecognizerStateChanged && _pressActive) {
    [self extendPressSelection];
  } else if (_pressActive && (recognizer.state == UIGestureRecognizerStateEnded ||
                             recognizer.state == UIGestureRecognizerStateCancelled ||
                             recognizer.state == UIGestureRecognizerStateFailed)) {
    [self extendPressSelection];
    NSRange finalRange = _pressRange;
    [self stopTimers];
    // UIKit's own recognizer may finish in this same event. Commit afterwards,
    // unless the document/lifecycle has changed in the meantime.
    NSUInteger generation = _generation;
    __weak RNSelectCharsContentView *weakSelf = self;
    dispatch_async(dispatch_get_main_queue(), ^{
      RNSelectCharsContentView *strongSelf = weakSelf;
      if (!strongSelf || strongSelf->_generation != generation) return;
      strongSelf->_changingSelection = YES;
      strongSelf->_textView.selectedRange = finalRange;
      strongSelf->_changingSelection = NO;
      [strongSelf emit:@"end"];
      [strongSelf schedulePositionUpdate];
    });
  }
}

- (void)extendPressSelection
{
  NSRange end = [self graphemeAtViewportPoint:_pressViewportPoint];
  if (end.location == NSNotFound) return;
  NSRange next = NSUnionRange(_pressOrigin, end);
  if (NSEqualRanges(next, _pressRange)) return;
  _pressRange = next;
  _changingSelection = YES;
  _textView.selectedRange = next;
  _changingSelection = NO;
  [self emit:@"change"];
}

- (void)autoScrollSelection
{
  if (!_pressActive || self.window == nil) return;
  CGFloat edge = MIN(56, self.bounds.size.height / 4);
  if (edge <= 0) return;
  CGFloat y = _pressViewportPoint.y;
  CGFloat velocity = y < edge ? -MIN(1, (edge - y) / edge) :
      y > self.bounds.size.height - edge ? MIN(1, (y - self.bounds.size.height + edge) / edge) : 0;
  if (velocity == 0) return;
  CGFloat maximum = MAX(0, _textView.contentSize.height - _textView.bounds.size.height);
  CGFloat nextY = MIN(MAX(0, _textView.contentOffset.y + velocity * 10), maximum);
  if (nextY == _textView.contentOffset.y) return;
  [_textView setContentOffset:CGPointMake(0, nextY) animated:NO];
  [_textView layoutIfNeeded];
  [self extendPressSelection];
}

- (void)scrollViewDidScroll:(UIScrollView *)scrollView { [self schedulePositionUpdate]; }
- (void)scrollViewWillBeginDragging:(UIScrollView *)scrollView { [self emit:@"position"]; }
- (void)scrollViewDidEndDecelerating:(UIScrollView *)scrollView { [self schedulePositionUpdate]; }
- (void)scrollViewDidEndScrollingAnimation:(UIScrollView *)scrollView { [self schedulePositionUpdate]; }
- (void)scrollViewDidEndDragging:(UIScrollView *)scrollView willDecelerate:(BOOL)decelerate
{
  if (!decelerate) [self schedulePositionUpdate];
}

- (void)schedulePositionUpdate
{
  if (_positionUpdateScheduled) return;
  _positionUpdateScheduled = YES;
  NSUInteger generation = _generation;
  __weak RNSelectCharsContentView *weakSelf = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    RNSelectCharsContentView *strongSelf = weakSelf;
    if (!strongSelf || strongSelf->_generation != generation) return;
    strongSelf->_positionUpdateScheduled = NO;
    [strongSelf updateVisibleHints];
    [strongSelf emit:@"position"];
  });
}

- (void)updateVisibleHints
{
  NSRange visible = [self visibleRange];
  NSMutableArray *badges = [NSMutableArray new];
  if (visible.location != NSNotFound) {
    // Binary search rather than scan every saved range on each scroll frame.
    NSUInteger low = 0, high = _hintsByStart.count;
    while (low < high) {
      NSUInteger middle = low + (high - low) / 2;
      if (_hintsByStart[middle].range.location < visible.location) low = middle + 1;
      else high = middle;
    }
    UIFont *font = [UIFont boldSystemFontOfSize:10];
    NSDictionary *attributes = @{NSFontAttributeName:font, NSForegroundColorAttributeName:UIColor.labelColor};
    for (NSUInteger index = low; index < _hintsByStart.count; index++) {
      RNSelectCharsHighlight *highlight = _hintsByStart[index];
      if (highlight.range.location >= NSMaxRange(visible)) break;
      UITextPosition *position = [_textView positionFromPosition:_textView.beginningOfDocument
                                                        offset:highlight.range.location];
      if (position == nil) continue;
      CGRect caret = [_textView convertRect:[_textView caretRectForPosition:position] toView:self];
      if (!CGRectIntersectsRect(caret, self.bounds)) continue;
      CGSize size = [highlight.hint sizeWithAttributes:attributes];
      CGFloat width = MIN(self.bounds.size.width, ceil(size.width) + 8);
      CGRect frame = CGRectMake(MIN(MAX(0, CGRectGetMinX(caret)), MAX(0, self.bounds.size.width - width)),
                                MAX(0, CGRectGetMinY(caret) - ceil(size.height) - 2), width, ceil(size.height) + 2);
      [badges addObject:@{@"frame":[NSValue valueWithCGRect:frame], @"text":highlight.hint,
                         @"color":highlight.color, @"attributes":attributes}];
    }
  }
  _hintOverlay.badges = badges;
  [_hintOverlay setNeedsDisplay];
}

@end
