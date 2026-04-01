const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(email, username, code) {
  await resend.emails.send({
    from: "yourapp@yourdomain.com", // or onboarding@resend.dev for testing
    to: email,
    subject: "Verify your email",
    html: `
      <h2>Hey ${username}!</h2>
      <p>Your verification code is:</p>
      <h1 style="letter-spacing: 8px;">${code}</h1>
      <p>This code expires in 10 minutes.</p>
    `,
  });
}

module.exports = { sendVerificationEmail };