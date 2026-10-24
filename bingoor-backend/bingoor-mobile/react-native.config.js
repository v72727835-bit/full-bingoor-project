const android = require('@react-native-community/cli-platform-android');
const communityPlugin = require('@react-native/community-cli-plugin');

module.exports = {
  commands: [communityPlugin.startCommand, communityPlugin.bundleCommand, ...android.commands],
  platforms: {
    android: {
      projectConfig: android.projectConfig,
      dependencyConfig: android.dependencyConfig,
    },
  },
};