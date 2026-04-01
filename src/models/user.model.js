const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ["user", "admin", "owner"],
      default: "user",
    },

    status: {
      type: String,
      enum: ["active", "banned"],
      default: "active",
    },
    xp: {
      type: Number,
      default: 0,
    },

    streakCount: {
      type: Number,
      default: 0,
    },

    lastActiveDate: {
      type: Date,
    },

    avatar: {
      type: String,
    },
    // --- OAuth fields ---

    // Tracks which providers the user has linked (google, github, etc.)
    authProviders: [
      {
        provider: {
          type: String, // e.g. "google", "github", "discord"
          required: true,
        },
        providerId: {
          type: String, // the user's ID on that platform
          required: true,
        },
        accessToken: {
          type: String, // store if you need to call provider APIs on behalf of user
        },
        refreshToken: {
          type: String,
        },
        tokenExpiresAt: {
          type: Date,
        },
      },
    ],

    // Tracks how the account was originally created
    authSource: {
      type: String,
      enum: ["local", "google", "github", "discord"],
      default: "local",
    },

    // Email verification — important since OAuth emails are pre-verified
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
    },
    emailVerificationExpires: {
      type: Date,
    },

    // Password reset — only relevant for local auth users
    passwordResetToken: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
    },
    password: {
      type: String,
      // required: true,
      minlength: 6,
      validate: {
        validator: function () {
          // password is required only if signing up with local auth
          if (this.authSource === "local") {
            return !!this.password;
          }
          return true;
        },
        message: "Password is required for local accounts.",
      },
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index(
  { "authProviders.provider": 1, "authProviders.providerId": 1 },
  { unique: true, sparse: true },
);
const userModel = mongoose.model("User", userSchema);

module.exports = userModel;
