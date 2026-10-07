document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("login-form");
  const message = document.getElementById("form-message");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    message.className = "message";
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Logging in…";
    try {
      const result = await BloodApp.api("/api/donors/login", BloodApp.jsonOptions("POST", Object.fromEntries(new FormData(form).entries())));
      localStorage.setItem("bloodDonorToken", result.token);
      window.location.href = "dashboard.html";
    } catch (error) {
      BloodApp.showMessage(message, error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Log in";
    }
  });
});
