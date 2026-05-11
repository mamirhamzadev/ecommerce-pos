const nodemailer = require("nodemailer");
const ejs = require("ejs");
const path = require("path");
require("dotenv").config();

async function sendEmail(to, subject, templateName, templateData) {
  try {
    const transporter = nodemailer.createTransport({
      service: process.env.GMAIL_SERVICE,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });
    const template = await ejs.renderFile(
      path.join(__dirname, "templates", templateName + ".ejs"),
      templateData,
    );
    const mailOptions = {
      from: process.env.GMAIL_FROM,
      to: to,
      subject: subject,
      html: template,
    };
    await transporter.sendMail(mailOptions);
    return { success: true, message: "Email sent successfully" };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

module.exports = { sendEmail };
