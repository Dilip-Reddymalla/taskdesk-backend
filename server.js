require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const connectToDB = require("./src/config/db");
const socketModule = require("./src/socket");

connectToDB();

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
socketModule.init(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
