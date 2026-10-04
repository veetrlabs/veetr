const { withEntitlementsPlist } = require('expo/config-plugins');

// Anchor alarms are scheduled locally; APNs registration is not used.
module.exports = function withLocalNotifications(config) {
  return withEntitlementsPlist(config, config => {
    delete config.modResults['aps-environment'];
    return config;
  });
};
