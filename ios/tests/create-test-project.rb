require 'fileutils'
require 'xcodeproj'

output = File.expand_path(ARGV.fetch(0))
repository = File.expand_path('../..', __dir__)
FileUtils.mkdir_p(output)
File.write(File.join(output, 'main.m'), <<~OBJC)
  #import <UIKit/UIKit.h>
  @interface EngineSceneDelegate : UIResponder <UIWindowSceneDelegate>
  @property(nonatomic, strong) UIWindow *window;
  @end
  @implementation EngineSceneDelegate
  - (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session options:(UISceneConnectionOptions *)options {
    self.window = [[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];
    self.window.rootViewController = [UIViewController new];
    [self.window makeKeyAndVisible];
  }
  @end
  @interface EngineAppDelegate : UIResponder <UIApplicationDelegate>
  @end
  @implementation EngineAppDelegate
  - (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)options {
    return YES;
  }
  @end
  int main(int argc, char *argv[]) {
    @autoreleasepool { return UIApplicationMain(argc, argv, nil, NSStringFromClass(EngineAppDelegate.class)); }
  }
OBJC
Xcodeproj::Plist.write_to_path({
  'CFBundleExecutable' => '$(EXECUTABLE_NAME)',
  'CFBundleIdentifier' => '$(PRODUCT_BUNDLE_IDENTIFIER)',
  'CFBundleInfoDictionaryVersion' => '6.0',
  'CFBundleName' => '$(PRODUCT_NAME)',
  'CFBundlePackageType' => 'APPL',
  'CFBundleShortVersionString' => '1.0',
  'CFBundleVersion' => '1',
  'LSRequiresIPhoneOS' => true,
  'UILaunchScreen' => {},
  'UIApplicationSceneManifest' => {
    'UIApplicationSupportsMultipleScenes' => false,
    'UISceneConfigurations' => {
      'UIWindowSceneSessionRoleApplication' => [{
        'UISceneConfigurationName' => 'Default Configuration',
        'UISceneDelegateClassName' => 'EngineSceneDelegate'
      }]
    }
  }
}, File.join(output, 'Info.plist'))

project = Xcodeproj::Project.new(File.join(output, 'Engine.xcodeproj'))
app = project.new_target(:application, 'EngineHost', :ios, '16.0')
tests = project.new_target(:unit_test_bundle, 'EngineTests', :ios, '16.0')
app.add_file_references([project.new_file(File.join(output, 'main.m'))])
sources = %w[ios/RNSelectCharsContentView.mm ios/RNSelectCharsRanges.m ios/tests/RNSelectCharsContentViewTests.mm]
tests.add_file_references(sources.map { |path| project.new_file(File.join(repository, path)) })
[app, tests].each do |target|
  target.build_configurations.each do |config|
    config.build_settings.merge!(
      'PRODUCT_BUNDLE_IDENTIFIER' => "test.selectchars.#{target.name}",
      'GENERATE_INFOPLIST_FILE' => 'YES',
      'CODE_SIGNING_ALLOWED' => 'NO',
      'CLANG_ENABLE_OBJC_ARC' => 'YES',
      'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
      'TARGETED_DEVICE_FAMILY' => '1,2',
      'IPHONEOS_DEPLOYMENT_TARGET' => '16.0',
      'FRAMEWORK_SEARCH_PATHS' => ['$(inherited)', '$(PLATFORM_DIR)/Developer/Library/Frameworks'],
      'LD_RUNPATH_SEARCH_PATHS' => ['$(inherited)', '@executable_path/Frameworks', '@loader_path/Frameworks']
    )
  end
  %w[UIKit CoreGraphics QuartzCore].each do |name|
    target.frameworks_build_phase.add_file_reference(
      project.frameworks_group.new_file("System/Library/Frameworks/#{name}.framework", :sdk_root)
    )
  end
end
app.build_configurations.each do |config|
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  config.build_settings['INFOPLIST_FILE'] = File.join(output, 'Info.plist')
end
tests.build_configurations.each do |config|
  config.build_settings['TEST_HOST'] = '$(BUILT_PRODUCTS_DIR)/EngineHost.app/EngineHost'
  config.build_settings['BUNDLE_LOADER'] = '$(TEST_HOST)'
end
tests.add_dependency(app)
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_build_target(tests)
scheme.add_test_target(tests)
scheme.set_launch_target(app)
scheme.save_as(project.path, 'EngineTests', true)
