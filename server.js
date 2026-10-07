// Start the API and serve the plain HTML frontend from the public directory.
require("dotenv").config();

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

const donorRoutes = require("./routes/donorRoutes");
const requestRoutes = require("./routes/requestRoutes");

const app = express();
const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/bloodDonorDB";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in the environment.");
}

app.use(cors());
app.use(bodyParser.json({ limit: "20kb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/donors", donorRoutes);
app.use("/api/requests", requestRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ message: "API endpoint not found." });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error("Request failed:", err.message);
  res.status(err.status || 500).json({ message: err.status ? err.message : "An unexpected server error occurred." });
});

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("Connected to Database");
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error.message);
    process.exitCode = 1;
  });
