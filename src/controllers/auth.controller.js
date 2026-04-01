const userModel = require("../models/user.model.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Plan = require("../models/plan.model.js");
const Task = require("../models/task.model.js");
const { OAuth2Client } = require("google-auth-library");
const { axios } = require("axios");

async function registerUser(req, res) {
  try {
    let { username, email, password } = req.body;

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
      role: "user",
    });

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
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
  } catch (error) {
    console.error("[Auth Controller - Register User Error]:", error);
    res.status(500).json({ message: "Server error" });
  }
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
        username: user.username,
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
  } catch (error) {
    console.error("[Auth Controller - Login User Error]:", error);
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
  } catch (error) {
    console.error("[Auth Controller - Delete User Error]:", error);
    res.status(500).json({
      message: "Server error",
    });
  }
}

async function verifyToken(req, res) {
  try {
    const user = await userModel.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({
      valid: true,
      user,
    });
  } catch (error) {
    console.error("[Auth Controller - Verify Token Error]:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function googleLogin(req, res) {
  try {
    const { code } = req.query;
    const googleRes = await OAuth2Client.getToken(code);
    OAuth2Client.setCredentials(googleRes.tokens);

    const userRes = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${googleRes.tokens.access_token}`,
    );
    const { email, name, picture } = userRes.data;
    let user = await userModel.findOne({ email: email });
    if (!user) {
      user = await userModel.create({
        username: name,
        email,
        avatar: picture,
        authSource: "google",
        isEmailVerified: true,
        authProviders: [
          {
            provider: "google",
            providerId: googleId,
            accessToken: googleRes.tokens.access_token,
            refreshToken: googleRes.tokens.refresh_token,
            tokenExpiresAt: new Date(googleRes.tokens.expiry_date),
          },
        ],
      });
    } else {
      // existing user — check if google provider is already linked
      const alreadyLinked = user.authProviders.some(
        (p) => p.provider === "google" && p.providerId === googleId,
      );

      if (!alreadyLinked) {
        // user signed up with local before, now linking google
        user.authProviders.push({
          provider: "google",
          providerId: googleId,
          accessToken: googleRes.tokens.access_token,
          refreshToken: googleRes.tokens.refresh_token,
          tokenExpiresAt: new Date(googleRes.tokens.expiry_date),
        });
        user.isEmailVerified = true;
        await user.save();
      } else {
        // just update the tokens
        const providerIndex = user.authProviders.findIndex(
          (p) => p.provider === "google",
        );
        user.authProviders[providerIndex].accessToken =
          googleRes.tokens.access_token;
        user.authProviders[providerIndex].refreshToken =
          googleRes.tokens.refresh_token;
        user.authProviders[providerIndex].tokenExpiresAt = new Date(
          googleRes.tokens.expiry_date,
        );
        await user.save();
      }
    }
    if (user.status === "banned") {
      return res.status(403).json({ message: "Your account has been banned." });
    }
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        status: user.status,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_TIMEOUT },
    );
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 1 * 12 * 60 * 60 * 1000, // 12hrs
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
  } catch (error) {
    console.error("[Auth Controller - Login User Error]:", error);
    res.status(500).json({
      message: "Server error",
    });
  }
}

module.exports = {
  registerUser,
  loginUser,
  deleteUser,
  verifyToken,
  googleLogin,
};
