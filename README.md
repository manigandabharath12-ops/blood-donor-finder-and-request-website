# Blood Donor Finder and Request

A responsive blood donor directory and request board built with plain HTML, CSS, and browser JavaScript, backed by Express and MongoDB.

## Requirements

- Node.js 18 or newer and npm
- MongoDB running locally, or a MongoDB connection URI
- Optional: a Gmail account with a Google App Password for email notifications

## Run locally

1. In this project folder, install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env`. On PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Edit `.env`. Set `JWT_SECRET` to a long, random secret. For Gmail notifications, set `EMAIL_USER` to the sending Gmail address and `EMAIL_PASS` to its Google App Password. Leave both email values empty to disable email delivery.

   ```dotenv
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/bloodDonorDB
   JWT_SECRET=use-a-long-random-secret-here
   EMAIL_USER=your-sending-address@gmail.com
   EMAIL_PASS=your-google-app-password
   ```

   Keep `.env` private; do not commit real credentials.

4. Start MongoDB and confirm it is listening at the URI in `.env`.
5. Start the website and API:

   ```powershell
   npm start
   ```

   The server logs `Connected to Database` and `Server running on http://localhost:5000` after it connects.

6. Open [http://localhost:5000](http://localhost:5000).

## Main pages

- `index.html` — introduction and blood group compatibility
- `register.html`, `login.html`, `dashboard.html` — donor account management
- `find-donor.html` — filter available donors by blood group and city
- `request.html`, `requests.html` — post and browse open requests

## API

All request and response bodies use JSON. Donor registration and requests validate their fields on the server. Donor search returns phone numbers but never email addresses or passwords. Search excludes donors whose recorded last donation was within the past 90 days.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/donors/register` | Register donor and return a login JWT |
| `POST` | `/api/donors/login` | Sign in and return a JWT |
| `GET` | `/api/donors/search?bloodGroup=O%2B&city=Pune` | Find available donors |
| `GET` | `/api/donors/me` | Get signed-in donor profile; requires bearer token |
| `PUT` | `/api/donors/me` | Update donor profile; requires bearer token |
| `POST` | `/api/requests` | Create a blood request and notify matching donors |
| `GET` | `/api/requests?city=Pune&urgency=Critical` | List open requests |
| `PUT` | `/api/requests/:id/fulfill` | Mark a request fulfilled |

Use `Authorization: Bearer <token>` for the two `/api/donors/me` endpoints. Open requests are sorted Critical first, then Urgent, then Normal; newest requests come first within each urgency.

## Sample test data

Register each of the following donor objects separately using `POST /api/donors/register`. Use a different unique email address if you have already registered one. The password shown is for local testing only.

```json
{
  "name": "Aarav Mehta",
  "age": 29,
  "gender": "Male",
  "email": "aarav@example.com",
  "phone": "9876543210",
  "password": "DonorPass123",
  "bloodGroup": "O+",
  "city": "Pune",
  "state": "Maharashtra"
}
```

```json
{
  "name": "Mira Shah",
  "age": 34,
  "gender": "Female",
  "email": "mira@example.com",
  "phone": "9876543211",
  "password": "DonorPass123",
  "bloodGroup": "A-",
  "city": "Pune",
  "state": "Maharashtra"
}
```

```json
{
  "name": "Dev Patel",
  "age": 25,
  "gender": "Other",
  "email": "dev@example.com",
  "phone": "9876543212",
  "password": "DonorPass123",
  "bloodGroup": "O+",
  "city": "Mumbai",
  "state": "Maharashtra"
}
```

Create each of these sample requests separately using `POST /api/requests`:

```json
{
  "patientName": "Riya Kulkarni",
  "bloodGroup": "O+",
  "unitsNeeded": 2,
  "hospitalName": "City Care Hospital",
  "city": "Pune",
  "contactName": "Nikhil Kulkarni",
  "contactPhone": "9876501234",
  "contactEmail": "nikhil@example.com",
  "urgency": "Critical",
  "neededByDate": "2027-01-15"
}
```

```json
{
  "patientName": "Kabir Joshi",
  "bloodGroup": "A-",
  "unitsNeeded": 1,
  "hospitalName": "Green Valley Medical Centre",
  "city": "Pune",
  "contactName": "Anaya Joshi",
  "contactPhone": "9876501235",
  "contactEmail": "anaya@example.com",
  "urgency": "Urgent",
  "neededByDate": "2027-01-20"
}
```

## Example API calls

PowerShell examples (replace the base URL if the server uses another port):

```powershell
$base = "http://localhost:5000"

# Search donors
Invoke-RestMethod "$base/api/donors/search?bloodGroup=O%2B&city=Pune"

# Login and retain the JWT
$login = Invoke-RestMethod "$base/api/donors/login" -Method Post -ContentType "application/json" -Body '{"email":"aarav@example.com","password":"DonorPass123"}'
$headers = @{ Authorization = "Bearer $($login.token)" }

# Read the signed-in donor profile
Invoke-RestMethod "$base/api/donors/me" -Headers $headers

# Create an open blood request
$requestBody = @{
  patientName = "Sample Patient"
  bloodGroup = "O+"
  unitsNeeded = 1
  hospitalName = "Central Hospital"
  city = "Pune"
  contactName = "Sample Contact"
  contactPhone = "9876501236"
  urgency = "Urgent"
} | ConvertTo-Json
Invoke-RestMethod "$base/api/requests" -Method Post -ContentType "application/json" -Body $requestBody

# List open requests in Pune
Invoke-RestMethod "$base/api/requests?city=Pune"
```

Email notifications use Gmail SMTP only when both `EMAIL_USER` and `EMAIL_PASS` are configured. If email delivery fails, the saved registration or request remains successful and the response message indicates the notification outcome.

After donor registration, the frontend stores the returned JWT and opens the donor dashboard automatically. When a blood request includes `contactEmail`, the requester receives a confirmation email; matching available donors in the same city and blood group are also notified when email is configured.
