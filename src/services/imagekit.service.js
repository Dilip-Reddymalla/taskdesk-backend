const imagekit =  require("../config/imagekit.js");

const uploadFile = async (file) => {
  const response = await imagekit.files.upload({
    file: file.buffer.toString("base64"),
    fileName: file.originalname,
  });

  return response.url;
};

module.exports = uploadFile;