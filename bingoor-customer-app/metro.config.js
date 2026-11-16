const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * Gradle writes tens of thousands of files under the android build folders and
 * android/.gradle. None of them are JavaScript, but Metro still has to crawl
 * and watch them on start-up - on Windows that alone can push the watcher past
 * its four-minute limit ("Failed to start watch mode"). Keeping them out of the
 * file map makes start-up fast and reliable.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: [
      /[/\\]android[/\\]build[/\\].*/,
      /[/\\]android[/\\]app[/\\]build[/\\].*/,
      /[/\\]android[/\\]\.gradle[/\\].*/,
      /[/\\]android[/\\]\.cxx[/\\].*/,
      /[/\\]android[/\\]app[/\\]\.cxx[/\\].*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
