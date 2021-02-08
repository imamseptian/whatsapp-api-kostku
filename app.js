const { Client, MessageMedia } = require("whatsapp-web.js");
const express = require("express");
const { body, validationResult } = require("express-validator");
const qrcode = require("qrcode");
const socketIO = require("socket.io");
const http = require("http");
const fs = require("fs");
const { phoneNumberFormatter } = require("./helpers/formatter");
const fileUpload = require("express-fileupload");
const axios = require("axios");
const port = process.env.PORT || 8000;

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  fileUpload({
    debug: true,
  })
);

const SESSION_FILE_PATH = "./whatsapp-session.json";
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
  // sessionCfg = require(SESSION_FILE_PATH);
  // console.log("KONTOL", fileku);
  let fd = fs.openSync(SESSION_FILE_PATH, "r+");
  let size = fs.statSync(SESSION_FILE_PATH).size;
  let buffer = Buffer.alloc(size);
  let res = fs.readSync(fd, buffer, 0, size, 0);
  // console.log(buffer.toString());
  // console.log(res);
  if (res > 0) {
    sessionCfg = require(SESSION_FILE_PATH);
  }
}

app.get("/", (req, res) => {
  //   res.status(200).json({
  //     status: true,
  //     message: "Hello World ayaya",
  //   });
  console.log("MASUK INDEX HTML");
  res.sendFile("index.html", {
    root: __dirname,
  });
});

const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process", // <- this one doesn't works in Windows
      "--disable-gpu",
    ],
  }, //jika false maka scan di browser
  session: sessionCfg,
});

// client.on("qr", (qr) => {
//   // Generate and scan this code with your phone
//   console.log("QR RECEIVED", qr);
//   qrcode.generate(qr);
// });

// client.on("authenticated", (session) => {
//   console.log("AUTHENTICATED", session);
//   sessionCfg = session;
//   fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
//     if (err) {
//       console.error(err);
//     }
//   });
// });

// client.on("ready", () => {
//   console.log("Client is ready!");
// });

client.on("message", (msg) => {
  if (msg.body == "!ping") {
    msg.reply("pong");
  }
});

client.initialize();

// SOCKET IO
io.on("connection", function (socket) {
  socket.emit("message", "connecting");
  console.log("CONECTING SOCKET IO ");
  client.on("qr", (qr) => {
    console.log("QR RECEIVED", qr);
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit("qr", url);
      socket.emit("message", "QR Code received scan please.");
    });
  });

  client.on("ready", () => {
    socket.emit("ready", "Whatsapp is ready");
    socket.emit("message", "Whatsapp is ready");
  });

  client.on("authenticated", (session) => {
    socket.emit("authenticated", "Whatsapp is authenticated");
    socket.emit("message", "Whatsapp is authenticated");
    console.log("AUTHENTICATED", session);
    sessionCfg = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
      if (err) {
        console.error(err);
      }
    });
    // fs.writeFile("./cobacoba.json", JSON.stringify(session), function (err) {
    //   if (err) {
    //     console.error(err);
    //   }
    // });
    // const SESSION_FILE_PATH = "./whatsapp-session.json";
  });

  client.on("auth_failure", function (session) {
    socket.emit("message", "Auth failure, restarting...");
  });

  client.on("disconnected", (reason) => {
    socket.emit("message", "Whatsapp is disconnected!");
    fs.truncate(SESSION_FILE_PATH, 0, function () {
      // if (err) return console.log(err);
      console.log("Session file cleaned!");
    });
    // fs.unlinkSync(SESSION_FILE_PATH, function (err) {
    //   if (err) return console.log(err);
    //   console.log("Session file deleted!");
    // });
    client.destroy();
    client.initialize();
  });
});

// SEND MESSAGE
// format nomor hp menggunakan awalan 62

const checkRegisteredNumber = async (number) => {
  const isRegistered = client.isRegisteredUser(number);
  return isRegistered;
};

// SEND NORMAL MESSAGE
app.post(
  "/send-message",
  [body("number").notEmpty(), body("message").notEmpty()],
  async (req, res) => {
    const errors = validationResult(req).formatWith(({ msg }) => {
      return msg;
    });

    if (!errors.isEmpty()) {
      return res.status(422).json({
        status: false,
        message: errors.mapped(),
      });
    }
    // const number = req.body.number;
    const number = phoneNumberFormatter(req.body.number);
    const message = req.body.message;

    const isRegisterUser = await checkRegisteredNumber(number);
    if (!isRegisterUser) {
      return res.status(422).json({
        status: false,
        message: "Number is not registered",
      });
    }

    client
      .sendMessage(number, message)
      .then((response) => {
        res.status(200).json({
          status: true,
          response: response,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          response: err,
          aya: number,
        });
      });
  }
);

// SEND MEDIA
app.post(
  "/send-media",

  async (req, res) => {
    // const number = req.body.number;
    const number = phoneNumberFormatter(req.body.number);
    const caption = req.body.caption;

    // FILE STATIS
    // const media = MessageMedia.fromFilePath("./TestImage.png");

    // FILE UPLOAD
    // const file = req.files.file;
    // const media = new MessageMedia(
    //   file.mimetype,
    //   file.data.toString("base64"),
    //   file.name
    // );

    // FILE URL
    const fileUrl = req.body.file;
    let mimetype;
    const attachment = await axios
      .get(fileUrl, { responseType: "arraybuffer" })
      .then((response) => {
        mimetype = response.headers["content-type"];
        return response.data.toString("base64");
      });

    const media = new MessageMedia(mimetype, attachment, "Media");

    // console.log(file);
    // return;

    const isRegisterUser = await checkRegisteredNumber(number);
    if (!isRegisterUser) {
      return res.status(422).json({
        status: false,
        message: "Number is not registered",
      });
    }

    client
      .sendMessage(number, media, { caption: caption })
      .then((response) => {
        res.status(200).json({
          status: true,
          response: response,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          response: err,
          aya: number,
        });
      });
  }
);

server.listen(port, function () {
  console.log("App Running on : *", port);
});
