const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const { mongoose } = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const salt = bcrypt.genSaltSync(10);
const key = "kdfgwefnjksdjf135832fsd2rryg94g";
const jwt = require("jsonwebtoken");
const corsOptions = JSON.parse(process.env.CORS_OPTIONS);
const cookieParser = require("cookie-parser");
const multer = require("multer");
const uploadMiddleware = multer({ dest: "uploads" });
const fs = require("fs");
const Post = require("./models/Post");

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

const port = process.env.PORT;
const mongoURL = process.env.MONGODB_URL;

mongoose
  .connect(mongoURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log(`Error connecting to MongoDB: ${err}`));

app.post("/addUser", async (req, res) => {
  const { userName, password } = req.body;
  try {
    const userInf = await User.create({
      userName,
      password: bcrypt.hashSync(password, salt),
    });
    res.json({ message: "User was created successfully! ", userInf });
  } catch (error) {
    res.status(400).json({ message: "Failed to create user ", error });
  }
});

app.post("/login", async (req, res) => {
  const { userName, password } = req.body;
  try {
    const userInf = await User.findOne({ userName });
    const isPassOk = bcrypt.compareSync(password, userInf.password);
    if (isPassOk) {
      jwt.sign({ userName, id: userInf._id }, key, {}, (error, token) => {
        if (error) {
          throw error;
        } else {
          res.cookie("token", token).json({
            id: userInf._id,
            userName,
          });
          return;
        }
      });
    } else {
      res.status(401).json("Wrong password");
    }
  } catch (error) {
    res.status(401).json("User not found");
  }
});

app.get("/profile", async (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, key, {}, async (err, info) => {
    try {
      res.json(info);
    } catch (error) {
      console.error(error, err);
    }
  });
});

app.post("/logout", async (req, res) => {
  res.cookie("token", "").json("ok");
});

app.post("/createPost", uploadMiddleware.single("file"), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split(".");
  const ext = parts[parts.length - 1];
  const newPath = path + "." + ext;
  fs.renameSync(path, newPath);
  const { title, summary, content } = req.body;

  const { token } = req.cookies;
  jwt.verify(token, key, {}, async (err, info) => {
    try {
      const post = await Post.create({
        title,
        summary,
        content,
        cover: newPath,
        author: info.id,
      });
      res.json(post);
    } catch (error) {
      console.error(error, err);
    }
  });
});

app.get("/getAllPosts", async (req, res) => {
  const posts = await Post.find()
    .populate("author", ["userName"])
    .sort({ createdAt: -1 })
    .limit(10);
  res.json(posts);
});

app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const post = await Post.findById(id).populate("author", ["userName"]);
    res.json(post);
  } catch (error) {
    return res.status(400).json('Something went wrong', error);
  }
  
  
});

app.put("/updatePost/:id", uploadMiddleware.single("file"), async (req, res) => {
  const {id} = req.params;
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    newPath = path + "." + ext;
    fs.renameSync(path, newPath);
  }
  
  const { token } = req.cookies;
  jwt.verify(token, key, {}, async (err, info) => {
    try {
      const { title, summary, content } = req.body;
      const post = await Post.findById(id)
      const isAuthor = post.author == info.id;
      if (!isAuthor) {
        return res.status(400).json('you are not the author');
      }
      
      await post.updateOne({
        title,
        summary,
        cover: newPath ? newPath : post.cover,
        content,
      });
      res.json(post);
    } catch (error) {
      console.error(error, err);
    }
  });
});

app.listen(port, () => {
  console.log("Server started on port " + port);
});
