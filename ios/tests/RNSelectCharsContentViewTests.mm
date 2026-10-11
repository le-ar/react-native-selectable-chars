#import <XCTest/XCTest.h>
#import <QuartzCore/QuartzCore.h>
#import "../RNSelectCharsContentView.h"

// Unit-test the native gesture state machine without UI automation or input injection.
@interface RNSelectCharsContentView (GestureTests)
- (void)longPressed:(UILongPressGestureRecognizer *)recognizer;
- (void)autoScrollSelection;
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer
    shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other;
- (void)updateFont;
- (BOOL)usesSelectionAppearanceFallback;
@end

@interface RNSelectCharsSelectionFillView : UIView
@property (nonatomic, copy) NSArray<NSValue *> *rectangles;
@property (nonatomic, strong) UIColor *fillColor;
@end
@interface RNSelectCharsSelectionHandleOverlay : UIView
@property (nonatomic, copy) NSArray<NSDictionary *> *handles;
@property (nonatomic, strong) UIColor *handleColor;
@end
API_AVAILABLE(ios(17.0))
@interface RNSelectCharsSelectionHighlightView : UIView <UITextSelectionHighlightView>
@property (nonatomic, strong) UIColor *fillColor;
@property (nonatomic, strong, readonly) UIView<UITextSelectionHighlightView> *renderer;
- (instancetype)initWithRenderer:(UIView<UITextSelectionHighlightView> *)renderer;
- (void)refreshVisibleGeometry;
@end
API_AVAILABLE(ios(17.0))
@interface RNSelectCharsHighlightRendererSpy : UIView <UITextSelectionHighlightView>
@property (nonatomic, strong) NSArray<UITextSelectionRect *> *selectionRects;
@end
@implementation RNSelectCharsHighlightRendererSpy
@end

// Inspecting or copying this array is observable without constructing a book's
// geometry. The adapter must leave interpretation to UIKit's native renderer.
@interface RNSelectCharsOpaqueSelectionArray : NSArray
@property (nonatomic) NSUInteger inspections;
@end
@implementation RNSelectCharsOpaqueSelectionArray
- (NSUInteger)count { self.inspections++; return 30000; }
- (id)objectAtIndex:(NSUInteger)index { self.inspections++; return [UITextSelectionRect new]; }
- (id)copyWithZone:(NSZone *)zone { self.inspections++; return self; }
@end

@interface RNSelectCharsFontTrackingView : RNSelectCharsContentView
@property (nonatomic) NSUInteger fontUpdates;
@end
@implementation RNSelectCharsFontTrackingView
- (void)updateFont { self.fontUpdates++; [super updateFont]; }
@end

// Test-only selection of the iOS 16 branch; no production runtime flag exists.
@interface RNSelectCharsFallbackTestView : RNSelectCharsFontTrackingView
@end
@implementation RNSelectCharsFallbackTestView
- (BOOL)usesSelectionAppearanceFallback { return YES; }
@end

@interface RNSelectCharsSyntheticLongPress : UILongPressGestureRecognizer
@property (nonatomic) UIGestureRecognizerState simulatedState;
@property (nonatomic) CGPoint simulatedPoint;
@end

@implementation RNSelectCharsSyntheticLongPress
- (UIGestureRecognizerState)state { return self.simulatedState; }
- (CGPoint)locationInView:(UIView *)view { return self.simulatedPoint; }
@end

@interface RNSelectCharsSyntheticSelectionRect : UITextSelectionRect
@property (nonatomic) CGRect simulatedRect;
@end
@implementation RNSelectCharsSyntheticSelectionRect
- (CGRect)rect { return self.simulatedRect; }
- (NSWritingDirection)writingDirection { return NSWritingDirectionLeftToRight; }
- (BOOL)containsStart { return YES; }
- (BOOL)containsEnd { return YES; }
- (BOOL)isVertical { return NO; }
@end

@interface RNSelectCharsContentViewTests : XCTestCase
@property (nonatomic, strong) UIWindow *testWindow;
@end

@implementation RNSelectCharsContentViewTests

- (void)tearDown
{
  self.testWindow.hidden = YES;
  self.testWindow.rootViewController = nil;
  self.testWindow = nil;
  [super tearDown];
}

- (RNSelectCharsContentView *)attachedView
{
  return [self attachedViewOfClass:RNSelectCharsContentView.class];
}

- (RNSelectCharsContentView *)attachedViewOfClass:(Class)viewClass
{
  UIWindowScene *scene = (UIWindowScene *)UIApplication.sharedApplication.connectedScenes.anyObject;
  self.testWindow = scene ? [[UIWindow alloc] initWithWindowScene:scene] : [UIWindow new];
  self.testWindow.frame = CGRectMake(0, 0, 320, 480);
  self.testWindow.rootViewController = [UIViewController new];
  RNSelectCharsContentView *view = [[viewClass alloc] initWithFrame:self.testWindow.bounds];
  [self.testWindow.rootViewController.view addSubview:view];
  [self.testWindow makeKeyAndVisible];
  return view;
}

- (void)finishLayout:(RNSelectCharsContentView *)view
{
  [view layoutIfNeeded];
  [view.textView layoutIfNeeded];
  XCTestExpectation *layout = [self expectationWithDescription:@"Native viewport layout"];
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.05 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    [layout fulfill];
  });
  [self waitForExpectations:@[layout] timeout:2];
}

- (void)testTextKit2AndContinuousSelection
{
  RNSelectCharsContentView *view = [self attachedView];
  NSMutableString *book = [NSMutableString new];
  for (NSUInteger index = 0; index < 40000; index++) [book appendString:@"Paragraph with 😀 and spaces.\n"];
  [view setDocument:book];
  [self finishLayout:view];
  XCTAssertNotNil(view.textView.textLayoutManager);
  NSTextLayoutManager *layout = view.textView.textLayoutManager;
  NSTextRange *viewport = layout.textViewportLayoutController.viewportRange;
  XCTAssertNotNil(viewport);
  NSInteger visibleLength = [layout.textContentManager offsetFromLocation:viewport.location toLocation:viewport.endLocation];
  XCTAssertGreaterThan(visibleLength, 0);
  XCTAssertLessThan(visibleLength, (NSInteger)book.length / 10);
  [view setSelectionFrom:1 to:book.length - 1];
  [self finishLayout:view];
  XCTAssertEqual(view.textView.selectedRange.location, 1u);
  XCTAssertEqual(NSMaxRange(view.textView.selectedRange), book.length - 1);
  XCTAssertNotNil(view.textView.textLayoutManager);
  if (@available(iOS 17.0, *)) {
    RNSelectCharsSelectionHighlightView *fill = nil;
    for (id<UIInteraction> interaction in view.textView.interactions) {
      if ([interaction isKindOfClass:UITextSelectionDisplayInteraction.class]) {
        fill = (RNSelectCharsSelectionHighlightView *)((UITextSelectionDisplayInteraction *)interaction).highlightView;
      }
    }
    XCTAssertTrue([fill isKindOfClass:RNSelectCharsSelectionHighlightView.class]);
    [self assertFill:fill isBoundedByViewport:view.textView];
    [view scrollToOffset:4000 animated:NO];
    [self finishLayout:view];
    [self assertFill:fill isBoundedByViewport:view.textView];
    view.frame = CGRectMake(0, 0, 480, 320);
    [self finishLayout:view];
    [self assertFill:fill isBoundedByViewport:view.textView];
    XCTAssertEqual(view.textView.selectedRange.location, 1u);
    XCTAssertEqual(NSMaxRange(view.textView.selectedRange), book.length - 1);
  }
  [view invalidate];
}

- (void)assertFill:(RNSelectCharsSelectionHighlightView *)fill isBoundedByViewport:(UITextView *)textView API_AVAILABLE(ios(17.0))
{
  CGRect viewport = [textView convertRect:textView.bounds toView:fill];
  XCTAssertGreaterThan(fill.selectionRects.count, 0u);
  XCTAssertGreaterThan(fill.renderer.selectionRects.count, 0u);
  XCTAssertTrue(CGRectEqualToRect(viewport, fill.renderer.frame));
  XCTAssertTrue(CGRectEqualToRect(viewport, fill.renderer.bounds));
  XCTAssertFalse(fill.clipsToBounds);
  XCTAssertTrue(fill.renderer.clipsToBounds);
  XCTAssertNil(fill.renderer.layer.contents);
}

- (void)testAnchorsAreViewportLocalAndOffscreenSelectionIsHidden
{
  RNSelectCharsContentView *view = [self attachedView];
  NSMutableString *text = [NSMutableString new];
  for (NSUInteger index = 0; index < 1000; index++) [text appendString:@"Paragraph with text.\n"];
  [view setDocument:text];
  [self finishLayout:view];
  __block CGRect anchor = CGRectZero;
  view.onSelectionChange = ^(NSRange range, NSString *phase, CGRect rect) { anchor = rect; };
  [view setSelectionFrom:0 to:5];
  [self finishLayout:view];
  XCTAssertGreaterThan(anchor.size.width, 0);
  XCTAssertGreaterThan(anchor.size.height, 0);
  XCTAssertGreaterThanOrEqual(anchor.origin.x, 0);
  XCTAssertGreaterThanOrEqual(anchor.origin.y, 0);
  XCTAssertLessThanOrEqual(CGRectGetMaxY(anchor), view.bounds.size.height);
  [view scrollToOffset:4000 animated:NO];
  [self finishLayout:view];
  XCTAssertTrue(CGRectIsEmpty(anchor));
  XCTAssertEqual(view.textView.selectedRange.location, 0u);
  [view invalidate];
}

- (void)testLongPressStartsWithOneGraphemeAndAutoscrollExtendsRange
{
  RNSelectCharsContentView *view = [self attachedView];
  NSMutableString *text = [NSMutableString new];
  for (NSUInteger index = 0; index < 1000; index++) [text appendString:@"Paragraph with text.\n"];
  [view setDocument:text];
  [self finishLayout:view];
  RNSelectCharsSyntheticLongPress *press = [RNSelectCharsSyntheticLongPress new];
  UIScrollView *outer = [UIScrollView new];
  XCTAssertFalse([view gestureRecognizer:press shouldRecognizeSimultaneouslyWithGestureRecognizer:outer.panGestureRecognizer]);
  press.simulatedPoint = CGPointMake(5, 20);
  press.simulatedState = UIGestureRecognizerStateBegan;
  [view longPressed:press];
  XCTAssertEqual(view.textView.selectedRange.length, 1u);
  NSUInteger start = view.textView.selectedRange.location;
  press.simulatedPoint = CGPointMake(30, 479);
  press.simulatedState = UIGestureRecognizerStateChanged;
  [view longPressed:press];
  NSUInteger firstScreenEnd = NSMaxRange(view.textView.selectedRange);
  for (NSUInteger index = 0; index < 30; index++) [view autoScrollSelection];
  XCTAssertGreaterThan(view.textView.contentOffset.y, 0);
  XCTAssertGreaterThan(NSMaxRange(view.textView.selectedRange), firstScreenEnd);
  press.simulatedState = UIGestureRecognizerStateEnded;
  [view longPressed:press];
  [self finishLayout:view];
  XCTAssertEqual(view.textView.selectedRange.location, start);
  XCTAssertTrue(view.textView.panGestureRecognizer.enabled);
  [view invalidate];
}

- (void)testQueuedLongPressCommitCannotRestoreOldDocumentSelection
{
  RNSelectCharsContentView *view = [self attachedView];
  [view setDocument:@"first document"];
  [self finishLayout:view];
  RNSelectCharsSyntheticLongPress *press = [RNSelectCharsSyntheticLongPress new];
  press.simulatedPoint = CGPointMake(5, 20);
  press.simulatedState = UIGestureRecognizerStateBegan;
  [view longPressed:press];
  press.simulatedState = UIGestureRecognizerStateEnded;
  [view longPressed:press];
  [view setDocument:@"replacement"];
  [self finishLayout:view];
  XCTAssertEqualObjects(view.document, @"replacement");
  XCTAssertEqual(view.textView.selectedRange.length, 0u);
  XCTAssertTrue(view.textView.panGestureRecognizer.enabled);
  [view invalidate];
}

- (void)testHighlightsKeepOffsetsAndSelection
{
  RNSelectCharsContentView *view = [[RNSelectCharsContentView alloc] initWithFrame:CGRectMake(0, 0, 320, 480)];
  [view setDocument:@"first\nsecond😀\nthird"];
  [view setSelectionFrom:1 to:9];
  NSRange selected = view.textView.selectedRange;
  RNSelectCharsHighlight *highlight = [RNSelectCharsHighlight new];
  highlight.range = NSMakeRange(0, 5);
  highlight.hint = @"1";
  highlight.color = UIColor.yellowColor;
  [view setHighlights:@[highlight]];
  XCTAssertEqualObjects(view.textView.text, @"first\nsecond😀\nthird");
  XCTAssertTrue(NSEqualRanges(view.textView.selectedRange, selected));
  XCTAssertEqualObjects([view.textView.textStorage attribute:NSBackgroundColorAttributeName atIndex:0 effectiveRange:nil],
                        UIColor.yellowColor);
  [view setHighlights:@[]];
  XCTAssertNil([view.textView.textStorage attribute:NSBackgroundColorAttributeName atIndex:0 effectiveRange:nil]);
  XCTAssertTrue(NSEqualRanges(view.textView.selectedRange, selected));
  XCTAssertNotNil(view.textView.textLayoutManager);
  [view invalidate];
}

- (void)testDocumentReplacementAndDisableClearSelection
{
  RNSelectCharsContentView *view = [RNSelectCharsContentView new];
  NSMutableArray<NSString *> *phases = [NSMutableArray new];
  view.onSelectionChange = ^(NSRange range, NSString *phase, CGRect anchor) { [phases addObject:phase]; };
  [view setDocument:@"first"];
  [view setSelectionFrom:1 to:3];
  [view setDocument:@"second"];
  XCTAssertEqual(view.textView.selectedRange.length, 0u);
  XCTAssertEqualObjects(phases.lastObject, @"clear");
  [view setSelectionFrom:0 to:2];
  view.selectionEnabled = NO;
  XCTAssertEqual(view.textView.selectedRange.length, 0u);
  [view setSelectionFrom:1 to:3];
  XCTAssertEqual(view.textView.selectedRange.length, 0u);
  [view invalidate];
}

- (void)testNativeEditActionsAreSuppressed
{
  RNSelectCharsContentView *view = [RNSelectCharsContentView new];
  [view setDocument:@"text"];
  [view setSelectionFrom:0 to:2];
  XCTAssertFalse([view.textView canPerformAction:@selector(copy:) withSender:nil]);
  XCTAssertFalse([view.textView canPerformAction:@selector(selectAll:) withSender:nil]);
  [view invalidate];
}

- (NSData *)pixelAtPoint:(CGPoint)point inView:(UIView *)view
{
  NSMutableData *pixel = [NSMutableData dataWithLength:4];
  CGColorSpaceRef colors = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(pixel.mutableBytes, 1, 1, 8, 4, colors,
      (CGBitmapInfo)kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big);
  CGContextTranslateCTM(context, -point.x, -point.y);
  [view.layer renderInContext:context];
  CGContextRelease(context);
  CGColorSpaceRelease(colors);
  return pixel;
}

- (void)testLiveHighlightGeometryPrecedesCommittedRangeAndFrame
{
  if (@available(iOS 17.0, *)) {
    RNSelectCharsContentView *view = [self attachedView];
    [view setDocument:@"committed selection"];
    [view setSelectionColor:[UIColor colorWithRed:0.25 green:0.5 blue:0.75 alpha:0.4]
               handleColor:UIColor.greenColor];
    [view setSelectionFrom:0 to:3];
    [self finishLayout:view];
    NSRange committed = view.textView.selectedRange;
    UIView<UITextSelectionHighlightView> *highlight = nil;
    for (id<UIInteraction> interaction in view.textView.interactions) {
      if ([interaction isKindOfClass:UITextSelectionDisplayInteraction.class]) {
        highlight = ((UITextSelectionDisplayInteraction *)interaction).highlightView;
      }
    }
    XCTAssertNotNil(highlight);
    // UIKit can deliver provisional geometry before it changes either the
    // committed selection or the managed highlight's old frame.
    highlight.frame = CGRectMake(0, 0, 80, 40);
    RNSelectCharsSyntheticSelectionRect *initial = [RNSelectCharsSyntheticSelectionRect new];
    initial.simulatedRect = CGRectMake(10, 12, 50, 19);
    highlight.selectionRects = @[initial];
    NSData *beforePixel = [self pixelAtPoint:CGPointMake(150, 20) inView:highlight];
    const unsigned char *before = (const unsigned char *)beforePixel.bytes;
    XCTAssertEqual(before[3], 0);
    RNSelectCharsSyntheticSelectionRect *expanded = [RNSelectCharsSyntheticSelectionRect new];
    expanded.simulatedRect = CGRectMake(10, 12, 180, 19);
    highlight.selectionRects = @[expanded];
    NSData *livePixel = [self pixelAtPoint:CGPointMake(150, 20) inView:highlight];
    const unsigned char *live = (const unsigned char *)livePixel.bytes;
    XCTAssertEqualWithAccuracy(live[0], 26, 1);
    XCTAssertEqualWithAccuracy(live[1], 51, 1);
    XCTAssertEqualWithAccuracy(live[2], 77, 1);
    XCTAssertEqualWithAccuracy(live[3], 102, 1);
    XCTAssertTrue(NSEqualRanges(view.textView.selectedRange, committed));
    highlight.frame = CGRectMake(0, 0, 320, 480);
    [highlight layoutIfNeeded];
    [view setSelectionColor:[UIColor colorWithRed:0.25 green:0.5 blue:0.75 alpha:0.4]
               handleColor:UIColor.greenColor];
    XCTAssertEqualObjects([self pixelAtPoint:CGPointMake(150, 20) inView:highlight], livePixel);
    XCTAssertTrue(NSEqualRanges(view.textView.selectedRange, committed));
    [view invalidate];
  }
}

- (void)testHighlightAdapterForwardsLiveArrayWithoutInspectingIt
{
  if (@available(iOS 17.0, *)) {
    RNSelectCharsHighlightRendererSpy *renderer = [[RNSelectCharsHighlightRendererSpy alloc] initWithFrame:CGRectMake(0, 0, 320, 480)];
    RNSelectCharsSelectionHighlightView *highlight = [[RNSelectCharsSelectionHighlightView alloc] initWithRenderer:renderer];
    RNSelectCharsOpaqueSelectionArray *geometry = [RNSelectCharsOpaqueSelectionArray new];
    highlight.fillColor = UIColor.redColor;
    highlight.selectionRects = geometry;
    highlight.tintColor = UIColor.greenColor;
    [highlight layoutIfNeeded];
    [highlight refreshVisibleGeometry];
    XCTAssertEqual(highlight.selectionRects, geometry);
    XCTAssertEqual(renderer.selectionRects, geometry);
    XCTAssertEqual(geometry.inspections, 0u);
    XCTAssertEqualObjects(renderer.tintColor, UIColor.redColor);
  }
}

- (void)testNativeHighlightKeepsLongParagraphRendererInViewport
{
  if (@available(iOS 17.0, *)) {
    RNSelectCharsContentView *view = [self attachedView];
    NSMutableString *paragraph = [NSMutableString new];
    for (NSUInteger index = 0; index < 40000; index++) [paragraph appendString:@"Very long wrapped paragraph. "];
    [view setDocument:paragraph];
    [view setSelectionColor:UIColor.redColor handleColor:UIColor.greenColor];
    [view setSelectionFrom:1 to:paragraph.length - 1];
    [self finishLayout:view];
    RNSelectCharsSelectionHighlightView *highlight = nil;
    for (id<UIInteraction> interaction in view.textView.interactions) {
      if ([interaction isKindOfClass:UITextSelectionDisplayInteraction.class]) {
        highlight = (RNSelectCharsSelectionHighlightView *)((UITextSelectionDisplayInteraction *)interaction).highlightView;
      }
    }
    [self assertFill:highlight isBoundedByViewport:view.textView];
    CGRect viewport = [view.textView convertRect:view.textView.bounds toView:highlight];
    NSData *pixel = [self pixelAtPoint:CGPointMake(CGRectGetMidX(viewport), CGRectGetMidY(viewport)) inView:highlight];
    XCTAssertEqual(((const unsigned char *)pixel.bytes)[0], 255);
    [view scrollToOffset:4000 animated:NO];
    [self finishLayout:view];
    [self assertFill:highlight isBoundedByViewport:view.textView];
    view.frame = CGRectMake(0, 0, 480, 320);
    [self finishLayout:view];
    [self assertFill:highlight isBoundedByViewport:view.textView];
    [view invalidate];
  }
}

- (void)checkColorChangesPreserveDocument:(RNSelectCharsFontTrackingView *)view
{
  NSMutableString *text = [NSMutableString new];
  for (NSUInteger index = 0; index < 1000; index++) [text appendString:@"Paragraph with colored text.\n"];
  [view setDocument:text];
  [self finishLayout:view];
  [view setSelectionFrom:1 to:12];
  [self finishLayout:view];
  [view scrollToOffset:100 animated:NO];
  NSRange selection = view.textView.selectedRange;
  CGPoint offset = view.textView.contentOffset;
  NSTextStorage *storage = view.textView.textStorage;
  NSAttributedString *original = [[NSAttributedString alloc] initWithAttributedString:storage];
  NSTextLayoutManager *layout = view.textView.textLayoutManager;
  NSUInteger fontUpdates = view.fontUpdates;
  __block NSUInteger edits = 0;
  id observer = [[NSNotificationCenter defaultCenter] addObserverForName:NSTextStorageDidProcessEditingNotification
      object:storage queue:nil usingBlock:^(NSNotification *note) { edits++; }];
  UIColor *fill = [UIColor colorWithRed:0.25 green:0.5 blue:0.75 alpha:0.4];
  [view setSelectionColor:fill handleColor:UIColor.magentaColor];
  [view setSelectionColor:fill handleColor:UIColor.greenColor];
  XCTAssertEqual(view.fontUpdates, fontUpdates);
  XCTAssertEqual(edits, 0u);
  XCTAssertTrue(NSEqualRanges(selection, view.textView.selectedRange));
  XCTAssertTrue(CGPointEqualToPoint(offset, view.textView.contentOffset));
  XCTAssertEqual(view.textView.textStorage, storage);
  XCTAssertEqual(view.textView.textLayoutManager, layout);
  XCTAssertEqualObjects(storage, original);
  [[NSNotificationCenter defaultCenter] removeObserver:observer];
}

- (void)testIndependentSystemSelectionColorsPreserveRangeScrollAndStorage
{
  if (@available(iOS 17.0, *)) {
    RNSelectCharsFontTrackingView *view = (RNSelectCharsFontTrackingView *)[self attachedViewOfClass:RNSelectCharsFontTrackingView.class];
    [self checkColorChangesPreserveDocument:view];
    UITextSelectionDisplayInteraction *display = nil;
    for (id<UIInteraction> interaction in view.textView.interactions) {
      if ([interaction isKindOfClass:UITextSelectionDisplayInteraction.class]) display = (UITextSelectionDisplayInteraction *)interaction;
    }
    XCTAssertNotNil(display);
    RNSelectCharsSelectionHighlightView *highlight = (RNSelectCharsSelectionHighlightView *)display.highlightView;
    XCTAssertTrue([highlight isKindOfClass:RNSelectCharsSelectionHighlightView.class]);
    XCTAssertEqualObjects(highlight.fillColor, [UIColor colorWithRed:0.25 green:0.5 blue:0.75 alpha:0.4]);
    XCTAssertEqualObjects(view.textView.tintColor, UIColor.greenColor);
    for (UIView *handle in display.handleViews) XCTAssertEqualObjects(handle.tintColor, UIColor.greenColor);
    NSArray *handles = [display.handleViews copy];
    [view setSelectionColor:UIColor.redColor handleColor:UIColor.greenColor];
    XCTAssertEqualObjects(highlight.fillColor, UIColor.redColor);
    XCTAssertEqualObjects(display.handleViews, handles);
    for (UIView *handle in display.handleViews) XCTAssertEqualObjects(handle.tintColor, UIColor.greenColor);
    [view scrollToOffset:0 animated:NO];
    [self finishLayout:view];
    XCTAssertNotNil(highlight.superview);
    XCTAssertGreaterThan(highlight.renderer.selectionRects.count, 0u);
    NSMutableArray *frames = [NSMutableArray new];
    NSMutableArray *hits = [NSMutableArray new];
    NSArray<UIGestureRecognizer *> *gestures = [view.textView.gestureRecognizers copy];
    NSMutableArray *enabled = [NSMutableArray new];
    for (UIGestureRecognizer *gesture in gestures) [enabled addObject:@(gesture.enabled)];
    for (UIView *handle in display.handleViews) {
      [frames addObject:[NSValue valueWithCGRect:handle.frame]];
      CGPoint point = [handle convertPoint:CGPointMake(CGRectGetMidX(handle.bounds), CGRectGetMidY(handle.bounds)) toView:view.textView];
      [hits addObject:[view.textView hitTest:point withEvent:nil] ?: NSNull.null];
    }
    [view setSelectionColor:UIColor.redColor handleColor:UIColor.clearColor];
    [self finishLayout:view];
    XCTAssertEqualObjects(view.textView.gestureRecognizers, gestures);
    for (NSUInteger index = 0; index < gestures.count; index++) {
      XCTAssertEqual(gestures[index].enabled, [enabled[index] boolValue]);
    }
    NSUInteger index = 0;
    for (UIView *handle in display.handleViews) {
      XCTAssertTrue(CGRectEqualToRect(handle.frame, [frames[index] CGRectValue]));
      CGPoint point = [handle convertPoint:CGPointMake(CGRectGetMidX(handle.bounds), CGRectGetMidY(handle.bounds)) toView:view.textView];
      XCTAssertEqual([view.textView hitTest:point withEvent:nil] ?: NSNull.null, hits[index]);
      index++;
    }
    [view invalidate];
  }
}

- (void)testFallbackSelectionColorsAndViewportGeometry
{
  RNSelectCharsFallbackTestView *view = (RNSelectCharsFallbackTestView *)[self attachedViewOfClass:RNSelectCharsFallbackTestView.class];
  [self checkColorChangesPreserveDocument:view];
  [view scrollToOffset:0 animated:NO];
  [self finishLayout:view];
  RNSelectCharsSelectionFillView *fill = nil;
  for (UIView *child in view.textView.subviews) {
    if ([child isKindOfClass:RNSelectCharsSelectionFillView.class]) fill = (RNSelectCharsSelectionFillView *)child;
  }
  RNSelectCharsSelectionHandleOverlay *handles = nil;
  for (UIView *child in view.subviews) {
    if ([child isKindOfClass:RNSelectCharsSelectionHandleOverlay.class]) handles = (RNSelectCharsSelectionHandleOverlay *)child;
  }
  XCTAssertEqualObjects(view.textView.tintColor, UIColor.clearColor);
  XCTAssertEqualObjects(fill.fillColor, [UIColor colorWithRed:0.25 green:0.5 blue:0.75 alpha:0.4]);
  XCTAssertEqualObjects(handles.handleColor, UIColor.greenColor);
  XCTAssertFalse(fill.userInteractionEnabled);
  XCTAssertFalse(handles.userInteractionEnabled);
  XCTAssertGreaterThan(fill.rectangles.count, 0u);
  XCTAssertEqual(handles.handles.count, 2u);
  for (NSValue *rect in fill.rectangles) XCTAssertTrue(CGRectContainsRect(fill.bounds, rect.CGRectValue));
  for (NSDictionary *handle in handles.handles) {
    BOOL start = [handle[@"start"] boolValue];
    NSUInteger offset = start ? view.textView.selectedRange.location : NSMaxRange(view.textView.selectedRange);
    UITextPosition *position = [view.textView positionFromPosition:view.textView.beginningOfDocument offset:offset];
    CGRect expected = [view.textView convertRect:[view.textView caretRectForPosition:position] toView:handles];
    XCTAssertTrue(CGRectEqualToRect(expected, [handle[@"caret"] CGRectValue]));
  }
  [view scrollToOffset:3000 animated:NO];
  [self finishLayout:view];
  XCTAssertEqual(fill.rectangles.count, 0u);
  XCTAssertEqual(handles.handles.count, 0u);
  [view invalidate];
}

- (void)testFillViewRendersExactRGBA
{
  RNSelectCharsSelectionFillView *fill = [[RNSelectCharsSelectionFillView alloc] initWithFrame:CGRectMake(0, 0, 20, 20)];
  fill.rectangles = @[[NSValue valueWithCGRect:fill.bounds], [NSValue valueWithCGRect:fill.bounds]];
  fill.fillColor = [UIColor colorWithRed:0.25 green:0.5 blue:0.75 alpha:0.4];
  UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
  format.opaque = NO;
  format.scale = 1;
  format.preferredRange = UIGraphicsImageRendererFormatRangeStandard;
  UIImage *image = [[[UIGraphicsImageRenderer alloc] initWithSize:fill.bounds.size format:format]
      imageWithActions:^(UIGraphicsImageRendererContext *context) { [fill.layer renderInContext:context.CGContext]; }];
  unsigned char pixel[4] = {};
  CGColorSpaceRef colors = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(pixel, 1, 1, 8, 4, colors,
      (CGBitmapInfo)kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big);
  CGContextDrawImage(context, CGRectMake(0, 0, 1, 1), image.CGImage);
  XCTAssertEqualWithAccuracy(pixel[0], 26, 1);
  XCTAssertEqualWithAccuracy(pixel[1], 51, 1);
  XCTAssertEqualWithAccuracy(pixel[2], 77, 1);
  XCTAssertEqualWithAccuracy(pixel[3], 102, 1); // 0.4 alpha, even where rectangles overlap.
  CGContextRelease(context);
  CGColorSpaceRelease(colors);
}

- (void)testDynamicSelectionFillUpdatesWithoutTextMutation
{
  for (Class viewClass in @[RNSelectCharsFontTrackingView.class, RNSelectCharsFallbackTestView.class]) {
    RNSelectCharsFontTrackingView *view = (RNSelectCharsFontTrackingView *)[self attachedViewOfClass:viewClass];
    [view setDocument:@"dynamic fill"];
    [view setSelectionFrom:0 to:7];
    UIColor *dynamic = [UIColor colorWithDynamicProvider:^UIColor *(UITraitCollection *traits) {
      return traits.userInterfaceStyle == UIUserInterfaceStyleDark ? UIColor.redColor : UIColor.blueColor;
    }];
    [view setSelectionColor:dynamic handleColor:UIColor.greenColor];
    UIView *fill = nil;
    if (viewClass == RNSelectCharsFallbackTestView.class) {
      for (UIView *child in view.textView.subviews) {
        if ([child isKindOfClass:RNSelectCharsSelectionFillView.class]) fill = (RNSelectCharsSelectionFillView *)child;
      }
    } else if (@available(iOS 17.0, *)) {
      for (id<UIInteraction> interaction in view.textView.interactions) {
        if ([interaction isKindOfClass:UITextSelectionDisplayInteraction.class]) {
          fill = ((UITextSelectionDisplayInteraction *)interaction).highlightView;
        }
      }
    } else {
      [view invalidate];
      continue;
    }
    XCTAssertNotNil(fill);
    NSUInteger fontUpdates = view.fontUpdates;
    NSAttributedString *storage = [[NSAttributedString alloc] initWithAttributedString:view.textView.textStorage];
    NSRange selected = view.textView.selectedRange;
    view.overrideUserInterfaceStyle = UIUserInterfaceStyleLight;
    [self finishLayout:view];
    if (viewClass == RNSelectCharsFallbackTestView.class) {
      CAShapeLayer *shape = (CAShapeLayer *)fill.layer.sublayers.firstObject;
      XCTAssertTrue(CGColorEqualToColor(shape.fillColor, UIColor.blueColor.CGColor));
    } else if (@available(iOS 17.0, *)) {
      UIView *renderer = ((RNSelectCharsSelectionHighlightView *)fill).renderer;
      XCTAssertEqualObjects([renderer.tintColor resolvedColorWithTraitCollection:renderer.traitCollection], UIColor.blueColor);
    }
    view.overrideUserInterfaceStyle = UIUserInterfaceStyleDark;
    [self finishLayout:view];
    if (viewClass == RNSelectCharsFallbackTestView.class) {
      CAShapeLayer *shape = (CAShapeLayer *)fill.layer.sublayers.firstObject;
      XCTAssertTrue(CGColorEqualToColor(shape.fillColor, UIColor.redColor.CGColor));
    } else if (@available(iOS 17.0, *)) {
      UIView *renderer = ((RNSelectCharsSelectionHighlightView *)fill).renderer;
      XCTAssertEqualObjects([renderer.tintColor resolvedColorWithTraitCollection:renderer.traitCollection], UIColor.redColor);
    }
    XCTAssertEqual(view.fontUpdates, fontUpdates);
    XCTAssertEqualObjects(view.textView.textStorage, storage);
    XCTAssertTrue(NSEqualRanges(view.textView.selectedRange, selected));
    [view invalidate];
  }
}

- (NSData *)pixelsOfView:(UIView *)view
{
  UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
  format.scale = 1;
  format.opaque = YES;
  format.preferredRange = UIGraphicsImageRendererFormatRangeStandard;
  UIImage *image = [[[UIGraphicsImageRenderer alloc] initWithSize:view.bounds.size format:format]
      imageWithActions:^(UIGraphicsImageRendererContext *context) { [view.layer renderInContext:context.CGContext]; }];
  NSUInteger width = (NSUInteger)view.bounds.size.width, height = (NSUInteger)view.bounds.size.height;
  NSMutableData *pixels = [NSMutableData dataWithLength:width * height * 4];
  CGColorSpaceRef colors = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(pixels.mutableBytes, width, height, 8, width * 4, colors,
                                              (CGBitmapInfo)kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big);
  CGContextDrawImage(context, CGRectMake(0, 0, width, height), image.CGImage);
  CGContextRelease(context);
  CGColorSpaceRelease(colors);
  return pixels;
}

- (void)testFallbackFillIsBehindNativeGlyphs
{
  RNSelectCharsContentView *view = [self attachedViewOfClass:RNSelectCharsFallbackTestView.class];
  view.backgroundColor = UIColor.whiteColor;
  [view setDocument:@"MMMMMMMMMMMMMMMM"];
  [view setFontSize:16 lineHeight:0 fontFamily:@"" allowFontScaling:NO textColor:UIColor.blackColor];
  [self finishLayout:view];
  NSData *before = [self pixelsOfView:view];
  [view setSelectionColor:UIColor.redColor handleColor:UIColor.blueColor];
  [view setSelectionFrom:0 to:16];
  [self finishLayout:view];
  NSData *after = [self pixelsOfView:view];
  const unsigned char *base = (const unsigned char *)before.bytes;
  const unsigned char *selected = (const unsigned char *)after.bytes;
  NSUInteger blackPixels = 0;
  NSUInteger width = (NSUInteger)view.bounds.size.width;
  for (NSUInteger y = 0; y < (NSUInteger)view.bounds.size.height; y++) {
    for (NSUInteger x = 5; x < 100; x++) {
      NSUInteger index = (y * width + x) * 4;
      if (base[index] < 3 && base[index + 1] < 3 && base[index + 2] < 3) {
        blackPixels++;
        XCTAssertLessThan(selected[index], 5);
        XCTAssertLessThan(selected[index + 1], 5);
        XCTAssertLessThan(selected[index + 2], 5);
      }
    }
  }
  XCTAssertGreaterThan(blackPixels, 10u);
  [view invalidate];
}

@end
