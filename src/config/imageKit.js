const ImageKit = require("@imagekit/nodejs");

const imagekit = new ImageKit({ privateKey: process.env.ImageKit_Private_Key });

module.exports = imagekit;