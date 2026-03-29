const userModel = require("../models/user.model.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Plan = require("../models/plan.model.js");
const Task = require("../models/task.model.js");

async function registerUser(req, res) {
  let { username, email, password, role } = req.body;
  if (!role) {
    role = "user";
  }
  const isUserAlreadyExists = await userModel.findOne({
    $or: [{ username }, { email }],
  });

  if (isUserAlreadyExists) {
    return res.status(409).json({ message: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await userModel.create({
    username,
    email,
    password: hashedPassword,
    role: role,
  });

  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
      status: user.status,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    },
  );

  res.status(201).json({
    message: "User Created succesfully",
    user: {
      username: user.username,
      email: user.email,
      role: user.role,
    },
    token,
  });
}
async function loginUser(req, res) {
  try {
    let { username, password, email } = req.body;
    if (!email) {
      email = username;
    }
    const user = await userModel.findOne({
      $or: [{ username }, { email }],
    });
    if (!user) {
      return res.status(401).json({
        message: "No user exists with username",
      });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invaid Credentials",
      });
    }
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        status: user.status,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 1 * 24 * 60 * 60 * 1000, // 1d
    });

    res.status(200).json({
      message: "User logged in Succesfully",
      token: token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch {
    res.status(500).json({
      message: "Server error",
    });
  }
}

async function deleteUser(req, res) {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid password",
      });
    }

    await Plan.deleteMany({ owner: userId });
    await Task.deleteMany({ createdBy: userId });
    await userModel.findByIdAndDelete(userId);

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch {
    res.status(500).json({
      message: "Server error",
    });
  }
}

module.exports = { registerUser, loginUser, deleteUser };
