const dotenv = require("dotenv");


dotenv.config();

if(!process.env.MONGO_URI){
    throw new Error("DB URI is not given in environment");
}
if(!process.env.JWT_SECRET){
    throw new Error("JWT SECRET is not given in environment");
}

const config = {
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
};


module.exports = config; 