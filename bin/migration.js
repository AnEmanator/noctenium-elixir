// Runs on every boot, before config load. This is where one-off cleanup goes when we
// change the file layout or drop something. Empty for now - this repo starts fresh so
// there are no old installs to migrate from yet.
function ToolboxMigration() {}

module.exports = { ToolboxMigration };
