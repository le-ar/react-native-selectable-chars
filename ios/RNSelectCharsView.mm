#import "RNSelectCharsView.h"
#import "RNSelectCharsContentView.h"

#import <React/RCTConversions.h>
#import <react/renderer/components/RNSelectCharsSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNSelectCharsSpec/EventEmitters.h>
#import <react/renderer/components/RNSelectCharsSpec/Props.h>
#import <react/renderer/components/RNSelectCharsSpec/RCTComponentViewHelpers.h>

#include <algorithm>
#include <cstdint>

using namespace facebook::react;

@interface RNSelectCharsView () <RCTRNSelectCharsViewViewProtocol>
@end

@implementation RNSelectCharsView {
  RNSelectCharsContentView *_textContent;
  NSInteger _documentVersion;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<RNSelectCharsViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if ((self = [super initWithFrame:frame])) {
    _props = std::make_shared<const RNSelectCharsViewProps>();
    [self createContent];
  }
  return self;
}

- (void)createContent
{
  _textContent = [[RNSelectCharsContentView alloc] initWithFrame:self.bounds];
  __weak RNSelectCharsView *weakSelf = self;
  _textContent.onSelectionChange = ^(NSRange range, NSString *phase, CGRect anchor) {
    RNSelectCharsView *strongSelf = weakSelf;
    if (!strongSelf || !strongSelf->_eventEmitter) return;
    auto emitter = std::static_pointer_cast<const RNSelectCharsViewEventEmitter>(strongSelf->_eventEmitter);
    RNSelectCharsViewEventEmitter::OnNativeSelectionChange event = {};
    event.documentVersion = (int)strongSelf->_documentVersion;
    event.start = range.location == NSNotFound ? -1 : (int)range.location;
    event.end = range.location == NSNotFound ? -1 : (int)NSMaxRange(range);
    event.phase = std::string(phase.UTF8String);
    event.anchorX = anchor.origin.x;
    event.anchorY = anchor.origin.y;
    event.anchorWidth = anchor.size.width;
    event.anchorHeight = anchor.size.height;
    emitter->onNativeSelectionChange(event);
  };
  self.contentView = _textContent;
}

- (NSObject *)accessibilityElement { return _textContent.textView; }

- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &previous = *std::static_pointer_cast<const RNSelectCharsViewProps>(_props);
  const auto &next = *std::static_pointer_cast<const RNSelectCharsViewProps>(props);
  _documentVersion = next.documentVersion;
  // The JS adapter increments this revision whenever it replaces the text.
  // Comparing the full string here would make a color toggle scan the book.
  BOOL textChanged = previous.documentVersion != next.documentVersion ||
      (previous.text.empty() && !next.text.empty());
  if (textChanged) {
    [_textContent setDocument:[[NSString alloc] initWithBytes:next.text.data()
                                                    length:next.text.size()
                                                  encoding:NSUTF8StringEncoding] ?: @""];
  }
  if (previous.fontSize != next.fontSize || previous.lineHeight != next.lineHeight ||
      previous.fontFamily != next.fontFamily || previous.allowFontScaling != next.allowFontScaling ||
      previous.textColor != next.textColor) {
    [_textContent setFontSize:next.fontSize
                  lineHeight:next.lineHeight
                  fontFamily:[NSString stringWithUTF8String:next.fontFamily.c_str()] ?: @""
            allowFontScaling:next.allowFontScaling
                   textColor:RCTUIColorFromSharedColor(next.textColor) ?: UIColor.labelColor];
  }
  if (previous.selectionColor != next.selectionColor || previous.selectionHandleColor != next.selectionHandleColor) {
    [_textContent setSelectionColor:RCTUIColorFromSharedColor(next.selectionColor) ?: [UIColor colorWithRed:0 green:122.0 / 255.0 blue:1 alpha:0.22]
                       handleColor:RCTUIColorFromSharedColor(next.selectionHandleColor) ?: [UIColor colorWithRed:0 green:122.0 / 255.0 blue:1 alpha:1]];
  }
  BOOL highlightsChanged = previous.highlights.size() != next.highlights.size() ||
      !std::equal(previous.highlights.begin(), previous.highlights.end(), next.highlights.begin(),
                  [](const auto &a, const auto &b) {
                    return a.start == b.start && a.end == b.end && a.color == b.color && a.hint == b.hint;
                  });
  if (highlightsChanged || textChanged) {
    NSMutableArray<RNSelectCharsHighlight *> *highlights = [NSMutableArray new];
    for (const auto &item : next.highlights) {
      NSRange range = RNSelectCharsComposedRange(_textContent.document, item.start, item.end);
      if (range.location == NSNotFound) continue;
      uint32_t color = (uint32_t)item.color;
      RNSelectCharsHighlight *highlight = [RNSelectCharsHighlight new];
      highlight.range = range;
      highlight.color = [UIColor colorWithRed:((color >> 16) & 0xff) / 255.0
                                       green:((color >> 8) & 0xff) / 255.0
                                        blue:(color & 0xff) / 255.0
                                       alpha:((color >> 24) & 0xff) / 255.0];
      highlight.hint = [NSString stringWithUTF8String:item.hint.c_str()] ?: @"";
      [highlights addObject:highlight];
    }
    [_textContent setHighlights:highlights];
  }
  _textContent.selectionEnabled = next.selectEnabled;
  [super updateProps:props oldProps:oldProps];
}

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
  RCTRNSelectCharsViewHandleCommand(self, commandName, args);
}

- (void)clearSelection { [_textContent clearSelection]; }
- (void)setSelection:(NSInteger)start end:(NSInteger)end { [_textContent setSelectionFrom:start to:end]; }
- (void)scrollToOffset:(NSInteger)offset animated:(BOOL)animated { [_textContent scrollToOffset:offset animated:animated]; }

- (void)prepareForRecycle
{
  [_textContent invalidate];
  [super prepareForRecycle];
  _props = std::make_shared<const RNSelectCharsViewProps>();
  _documentVersion = 0;
  [self createContent];
}

@end
