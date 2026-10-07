const express = require("express");
const nodemailer = require("nodemailer");
const BloodRequest = require("../models/BloodRequest");
const Donor = require("../models/Donor");

const router = express.Router();
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const URGENCIES = ["Normal", "Urgent", "Critical"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;

function validText(value, maxLength = 150) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function parseOptionalDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function notifyMatchingDonors(request) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("Donor notifications not sent: EMAIL_USER and EMAIL_PASS are not configured.");
    return 0;
  }

  const eligibleDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const donors = await Donor.find({
    bloodGroup: request.bloodGroup,
    isAvailable: true,
    city: { $regex: `^${request.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    $or: [{ lastDonationDate: null }, { lastDonationDate: { $lte: eligibleDate } }]
  }).select("email name");

  if (donors.length === 0) return 0;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    bcc: donors.map((donor) => donor.email),
    subject: `${request.urgency} blood request: ${request.bloodGroup} needed in ${request.city}`,
    text: `Hello,\n\nA blood request matching your donor profile has been posted.\n\nPatient: ${request.patientName}\nBlood group: ${request.bloodGroup}\nUnits needed: ${request.unitsNeeded}\nHospital: ${request.hospitalName}, ${request.city}\nUrgency: ${request.urgency}\nContact: ${request.contactName} (${request.contactPhone})\n\nPlease contact the requester directly if you can help.`
  });
  return donors.length;
}

async function sendRequestConfirmation(request) {
  if (!request.contactEmail || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) return false;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: request.contactEmail,
    subject: "Your blood request has been posted",
    text: `Hello ${request.contactName},\n\nYour blood request has been posted successfully.\n\nPatient: ${request.patientName}\nBlood group: ${request.bloodGroup}\nUnits needed: ${request.unitsNeeded}\nHospital: ${request.hospitalName}, ${request.city}\nUrgency: ${request.urgency}\nContact: ${request.contactPhone}\n\nMatching available donors in your city may also receive an email notification.\n\nBlood Donor Finder`
  });
  return true;
}

router.post("/", async (req, res) => {
  try {
    const {
      patientName, bloodGroup, unitsNeeded, hospitalName, city, contactName,
      contactPhone, contactEmail, urgency, neededByDate
    } = req.body;

    if (!validText(patientName, 100) || !BLOOD_GROUPS.includes(bloodGroup) ||
        !Number.isInteger(Number(unitsNeeded)) || Number(unitsNeeded) < 1 || Number(unitsNeeded) > 50 ||
        !validText(hospitalName) || !validText(city, 100) || !validText(contactName, 100) ||
        !PHONE_PATTERN.test(String(contactPhone || "").trim()) ||
        (contactEmail !== undefined && contactEmail !== "" &&
          (typeof contactEmail !== "string" || !EMAIL_PATTERN.test(contactEmail.trim()))) ||
        (urgency !== undefined && !URGENCIES.includes(urgency))) {
      return res.status(400).json({ message: "Please provide valid request details. Phone numbers must contain 10 digits." });
    }

    const date = parseOptionalDate(neededByDate);
    if (date === undefined || (date && date < new Date(new Date().setHours(0, 0, 0, 0)))) {
      return res.status(400).json({ message: "Needed-by date must be a valid date today or later." });
    }

    const bloodRequest = await BloodRequest.create({
      patientName: patientName.trim(),
      bloodGroup,
      unitsNeeded: Number(unitsNeeded),
      hospitalName: hospitalName.trim(),
      city: city.trim(),
      contactName: contactName.trim(),
      contactPhone: String(contactPhone).trim(),
      contactEmail: typeof contactEmail === "string" ? contactEmail.trim().toLowerCase() : "",
      urgency: urgency || "Normal",
      neededByDate: date
    });

    let notifiedDonors = 0;
    let confirmationSent = false;
    let confirmationFailed = false;
    try {
      confirmationSent = await sendRequestConfirmation(bloodRequest);
    } catch (emailError) {
      confirmationFailed = true;
      console.error("Request confirmation email delivery failed:", emailError.message);
    }
    try {
      notifiedDonors = await notifyMatchingDonors(bloodRequest);
    } catch (emailError) {
      console.error("Donor notification delivery failed:", emailError.message);
    }

    return res.status(201).json({
      message: [
        confirmationSent ? `Confirmation email sent to ${bloodRequest.contactEmail}.` :
          (confirmationFailed ? "The request was posted, but its confirmation email could not be sent." :
            (bloodRequest.contactEmail ? "The request was posted, but email delivery is not configured." : "")),
        notifiedDonors
          ? `Matching donors in ${bloodRequest.city} have been notified.`
          : "No matching donors were notified at this time."
      ].filter(Boolean).join(" "),
      request: bloodRequest
    });
  } catch (error) {
    if (error.name === "ValidationError") return res.status(400).json({ message: "Some request details are invalid." });
    console.error("Creating blood request failed:", error.message);
    return res.status(500).json({ message: "Could not post your request. Please try again." });
  }
});

router.get("/", async (req, res) => {
  try {
    const { bloodGroup, city, urgency } = req.query;
    if (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup)) return res.status(400).json({ message: "Choose a valid blood group." });
    if (urgency && !URGENCIES.includes(urgency)) return res.status(400).json({ message: "Choose a valid urgency." });
    if (city && (typeof city !== "string" || city.trim().length > 100)) return res.status(400).json({ message: "Enter a valid city." });

    const filter = { status: "Open" };
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (urgency) filter.urgency = urgency;
    if (city && city.trim()) filter.city = { $regex: `^${city.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };

    const requests = await BloodRequest.find(filter).sort({ urgency: -1, createdAt: -1 }).lean();
    const urgencyOrder = { Critical: 0, Urgent: 1, Normal: 2 };
    requests.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || b.createdAt - a.createdAt);
    return res.json({ requests });
  } catch (error) {
    console.error("Loading blood requests failed:", error.message);
    return res.status(500).json({ message: "Could not load blood requests. Please try again." });
  }
});

router.put("/:id/fulfill", async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: "Invalid request ID." });
    const request = await BloodRequest.findByIdAndUpdate(
      req.params.id,
      { status: "Fulfilled" },
      { new: true, runValidators: true }
    );
    if (!request) return res.status(404).json({ message: "Blood request not found." });
    return res.json({ message: "Request marked as fulfilled.", request });
  } catch (error) {
    console.error("Fulfilling blood request failed:", error.message);
    return res.status(500).json({ message: "Could not update the request. Please try again." });
  }
});

module.exports = router;
