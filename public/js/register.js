document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("register-form");
  const message = document.getElementById("form-message");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    message.className = "message";
    if (!form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form).entries());
    if (data.password !== data.confirmPassword) {
      BloodApp.showMessage(message, "Your passwords do not match.", "error");
      return;
    }
    if (!/^\d{10}$/.test(data.phone)) {
      BloodApp.showMessage(message, "Enter a 10-digit phone number.", "error");
      return;
    }
    delete data.confirmPassword;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Creating account…";
    try {
      const result = await BloodApp.api("/api/donors/register", BloodApp.jsonOptions("POST", data));
      localStorage.setItem("bloodDonorToken", result.token);
      sessionStorage.setItem("bloodDonorWelcome", result.message);
      window.location.href = "dashboard.html";
    } catch (error) {
      BloodApp.showMessage(message, error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Create donor account";
    }
  });
});
