document.addEventListener("DOMContentLoaded", async function () {
  const token = localStorage.getItem("bloodDonorToken");
  const message = document.getElementById("dashboard-message");
  const form = document.getElementById("profile-form");
  const toggle = document.getElementById("availability-toggle");
  let donor;
  const welcomeMessage = sessionStorage.getItem("bloodDonorWelcome");
  if (welcomeMessage) {
    sessionStorage.removeItem("bloodDonorWelcome");
    BloodApp.showMessage(message, welcomeMessage, "success");
  }

  if (!token) {
    window.location.replace("login.html");
    return;
  }

  function renderProfile(profile) {
    donor = profile;
    document.getElementById("donor-name").textContent = profile.name;
    document.getElementById("donor-summary").textContent = `${profile.bloodGroup} · ${profile.city}${profile.state ? `, ${profile.state}` : ""}`;
    toggle.checked = profile.isAvailable;
    document.getElementById("availability-text").textContent = profile.isAvailable ? "Available to donate" : "Not currently available";
    for (const key of ["name", "age", "gender", "phone", "bloodGroup", "city", "state"]) {
      form.elements[key].value = profile[key] == null ? "" : profile[key];
    }
    form.elements.lastDonationDate.value = profile.lastDonationDate ? new Date(profile.lastDonationDate).toISOString().slice(0, 10) : "";
  }

  async function updateProfile(updates, successMessage) {
    try {
      const result = await BloodApp.api("/api/donors/me", BloodApp.jsonOptions("PUT", updates, token));
      renderProfile(result.donor);
      BloodApp.showMessage(message, successMessage || result.message, "success");
      return true;
    } catch (error) {
      BloodApp.showMessage(message, error.message, "error");
      return false;
    }
  }

  try {
    const result = await BloodApp.api("/api/donors/me", { headers: { Authorization: `Bearer ${token}` } });
    renderProfile(result.donor);
  } catch (error) {
    localStorage.removeItem("bloodDonorToken");
    window.location.replace("login.html");
    return;
  }

  toggle.addEventListener("change", async function () {
    toggle.disabled = true;
    await updateProfile({ isAvailable: toggle.checked }, "Availability updated.");
    toggle.disabled = false;
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    message.className = "message";
    if (!form.reportValidity()) return;
    const updates = Object.fromEntries(new FormData(form).entries());
    updates.age = Number(updates.age);
    updates.lastDonationDate = updates.lastDonationDate || null;
    if (!/^\d{10}$/.test(updates.phone)) {
      BloodApp.showMessage(message, "Enter a 10-digit phone number.", "error");
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Saving…";
    await updateProfile(updates);
    button.disabled = false;
    button.textContent = "Save profile";
  });

  document.getElementById("logout-button").addEventListener("click", function () {
    localStorage.removeItem("bloodDonorToken");
    window.location.href = "login.html";
  });
});
