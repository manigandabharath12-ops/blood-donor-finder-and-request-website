const mongoose = require("mongoose");
const { BLOOD_GROUPS } = require("./Donor");

const bloodRequestSchema = new mongoose.Schema({
  patientName: { type: String, required: true, trim: true, maxlength: 100 },
  bloodGroup: { type: String, required: true, enum: BLOOD_GROUPS },
  unitsNeeded: { type: Number, required: true, min: 1, max: 50 },
  hospitalName: { type: String, required: true, trim: true, maxlength: 150 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  contactName: { type: String, required: true, trim: true, maxlength: 100 },
  contactPhone: { type: String, required: true, trim: true },
  contactEmail: { type: String, trim: true, lowercase: true, default: "" },
  urgency: { type: String, enum: ["Normal", "Urgent", "Critical"], default: "Normal" },
  neededByDate: { type: Date, default: null },
  status: { type: String, enum: ["Open", "Fulfilled"], default: "Open" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("BloodRequest", bloodRequestSchema);
