const mongoose = require('mongoose');
const config = require('../config/config');

async function connectToDB() {
    try{
        await mongoose.connect(config.MONGO_URI);
        console.log("Connected to DB");
    }catch{
        console.log("Database Connection error");
    }
}

module.exports = connectToDB;