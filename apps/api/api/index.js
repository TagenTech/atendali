module.exports = async (req, res) => (await require('../dist/serverless').getHandler())(req, res);
