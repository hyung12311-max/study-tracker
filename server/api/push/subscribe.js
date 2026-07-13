// Backward-compatible route. All family push registrations now use the same
// authenticated, active-member validation and family_push_subscriptions table.
module.exports = require("../notifications/subscribe");
