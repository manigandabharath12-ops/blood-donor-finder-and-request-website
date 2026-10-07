const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const Donor = require("../models/Donor");
const authenticate = require("../middleware/auth");

const router = express.Router();
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;

function validText(value, maxLength = 100) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function parseOptionalDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function sendWelcomeEmail(email, name) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("Welcome email not sent: EMAIL_USER and EMAIL_PASS are not configured.");
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Welcome to Blood Donor Finder",
    text: `Hello ${name},\n\nThank you for registering as a blood donor. Your willingness to help can save a life.\n\nBlood Donor Finder`
  });
  return true;
}

// Register a new donor, storing only a bcrypt hash of their password.
router.post("/register", async (req, res) => {
  try {
    const { name, age, gender, email, phone, password, bloodGroup, city, state } = req.body;
    const numericAge = Number(age);

    if (!validText(name) || !Number.isInteger(numericAge) || numericAge < 18 || numericAge > 65 ||
        !["Male", "Female", "Other"].includes(gender) || typeof email !== "string" ||
        !EMAIL_PATTERN.test(email.trim()) || !PHONE_PATTERN.test(String(phone || "").trim()) ||
        typeof password !== "string" || password.length < 8 || password.length > 128 ||
        !BLOOD_GROUPS.includes(bloodGroup) || !validText(city) ||
        (state !== undefined && state !== "" && !validText(state))) {
      return res.status(400).json({ message: "Please provide valid details. Passwords must be at least 8 characters and phone numbers must contain 10 digits." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (await Donor.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const donor = await Donor.create({
      name: name.trim(),
      age: numericAge,
      gender,
      email: normalizedEmail,
      phone: String(phone).trim(),
      password: hashedPassword,
      bloodGroup,
      city: city.trim(),
      state: typeof state === "string" ? state.trim() : ""
    });
    const token = jwt.sign({ donorId: donor._id.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });

    let emailSent = false;
    try {
      emailSent = await sendWelcomeEmail(donor.email, donor.name);
    } catch (emailError) {
      console.error("Welcome email delivery failed:", emailError.message);
    }

    return res.status(201).json({
      message: emailSent ? "Registration successful. A welcome email has been sent." : "Registration successful. Email delivery is currently unavailable.",
      token,
      donor: { id: donor._id, name: donor.name, email: donor.email }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Some donor details are invalid." });
    }
    console.error("Donor registration failed:", error.message);
    return res.status(500).json({ message: "Could not complete registration. Please try again." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password;
    if (!EMAIL_PATTERN.test(email) || typeof password !== "string" || password.length === 0) {
      return res.status(400).json({ message: "Enter a valid email address and password." });
    }

    const donor = await Donor.findOne({ email }).select("+password");
    if (!donor || !(await bcrypt.compare(password, donor.password))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }

    const token = jwt.sign({ donorId: donor._id.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({ message: "Login successful.", token });
  } catch (error) {
    console.error("Donor login failed:", error.message);
    return res.status(500).json({ message: "Could not log in. Please try again." });
  }
});

router.get("/search", async (req, res) => {
  try {
    const { bloodGroup, city } = req.query;
    if (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({ message: "Choose a valid blood group." });
    }
    if (city && (typeof city !== "string" || city.trim().length > 100)) {
      return res.status(400).json({ message: "Enter a valid city." });
    }

    const eligibleDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const filter = {
      isAvailable: true,
      $or: [{ lastDonationDate: null }, { lastDonationDate: { $lte: eligibleDate } }]
    };
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (city && city.trim()) filter.city = { $regex: `^${city.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };

    const donors = await Donor.find(filter)
      .select("name bloodGroup city state phone isAvailable lastDonationDate createdAt")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ donors });
  } catch (error) {
    console.error("Donor search failed:", error.message);
    return res.status(500).json({ message: "Could not search donors. Please try again." });
  }
});

router.get("/me", authenticate, async (req, res) => {
  try {
    const donor = await Donor.findById(req.donorId).select("-password");
    if (!donor) return res.status(404).json({ message: "Donor profile not found." });
    return res.json({ donor });
  } catch (error) {
    console.error("Loading donor profile failed:", error.message);
    return res.status(500).json({ message: "Could not load your profile." });
  }
});

router.put("/me", authenticate, async (req, res) => {
  try {
    const allowed = ["name", "age", "gender", "phone", "bloodGroup", "city", "state", "lastDonationDate", "isAvailable"];
    const updates = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Provide at least one profile field to update." });
    }
    if (updates.name !== undefined && !validText(updates.name)) return res.status(400).json({ message: "Enter a valid name." });
    if (updates.age !== undefined && (!Number.isInteger(Number(updates.age)) || Number(updates.age) < 18 || Number(updates.age) > 65)) {
      return res.status(400).json({ message: "Age must be between 18 and 65." });
    }
    if (updates.gender !== undefined && !["Male", "Female", "Other"].includes(updates.gender)) return res.status(400).json({ message: "Choose a valid gender." });
    if (updates.phone !== undefined && !PHONE_PATTERN.test(String(updates.phone).trim())) return res.status(400).json({ message: "Phone number must contain 10 digits." });
    if (updates.bloodGroup !== undefined && !BLOOD_GROUPS.includes(updates.bloodGroup)) return res.status(400).json({ message: "Choose a valid blood group." });
    if (updates.city !== undefined && !validText(updates.city)) return res.status(400).json({ message: "Enter a valid city." });
    if (updates.state !== undefined && updates.state !== "" && !validText(updates.state)) return res.status(400).json({ message: "Enter a valid state." });
    if (updates.isAvailable !== undefined && typeof updates.isAvailable !== "boolean") return res.status(400).json({ message: "Availability must be true or false." });

    if (updates.lastDonationDate !== undefined) {
      const date = parseOptionalDate(updates.lastDonationDate);
      if (date === undefined || (date && date > new Date())) return res.status(400).json({ message: "Enter a valid donation date that is not in the future." });
      updates.lastDonationDate = date;
    }
    if (updates.age !== undefined) updates.age = Number(updates.age);
    if (updates.name !== undefined) updates.name = updates.name.trim();
    if (updates.city !== undefined) updates.city = updates.city.trim();
    if (updates.state !== undefined) updates.state = updates.state.trim();
    if (updates.phone !== undefined) updates.phone = String(updates.phone).trim();

    const donor = await Donor.findByIdAndUpdate(req.donorId, updates, { new: true, runValidators: true }).select("-password");
    if (!donor) return res.status(404).json({ message: "Donor profile not found." });
    return res.json({ message: "Profile updated successfully.", donor });
  } catch (error) {
    if (error.name === "ValidationError") return res.status(400).json({ message: "Some profile details are invalid." });
    console.error("Updating donor profile failed:", error.message);
    return res.status(500).json({ message: "Could not update your profile. Please try again." });
  }
});

module.exports = router;
