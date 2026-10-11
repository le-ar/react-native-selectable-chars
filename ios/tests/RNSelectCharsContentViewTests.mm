#import <XCTest/XCTest.h>
#import "../RNSelectCharsContentView.h"

// Unit-test the native gesture state machine without UI automation or input injection.
@interface RNSelectCharsContentView (GestureTests)
- (void)longPressed:(UILongPressGestureRecognizer *)recognizer;
- (void)autoScrollSelection;
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer
    shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other;
@end

@interface RNSelectCharsSyntheticLongPress : UILongPressGestureRecognizer
@property (nonatomic) UIGestureRecognizerState simulatedState;
@property (nonatomic) CGPoint simulatedPoint;
@end

@implementation RNSelectCharsSyntheticLongPress
- (UIGestureRecognizerState)state { return self.simulatedState; }
- (CGPoint)locationInView:(UIView *)view { return self.simulatedPoint; }
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
  UIWindowScene *scene = (UIWindowScene *)UIApplication.sharedApplication.connectedScenes.anyObject;
  self.testWindow = scene ? [[UIWindow alloc] initWithWindowScene:scene] : [UIWindow new];
  self.testWindow.frame = CGRectMake(0, 0, 320, 480);
  self.testWindow.rootViewController = [UIViewController new];
  RNSelectCharsContentView *view = [[RNSelectCharsContentView alloc] initWithFrame:self.testWindow.bounds];
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
  [view invalidate];
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

@end
