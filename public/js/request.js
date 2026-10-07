document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("request-form");
  const message = document.getElementById("form-message");
  const dateInput = form.elements.neededByDate;
  dateInput.min = new Date().toISOString().slice(0, 10);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    message.className = "message";
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.neededByDate) delete data.neededByDate;
    if (!data.contactEmail) delete data.contactEmail;
    if (!/^\d{10}$/.test(data.contactPhone)) {
      BloodApp.showMessage(message, "Enter a 10-digit contact phone number.", "error");
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Posting request…";
    try {
      const result = await BloodApp.api("/api/requests", BloodApp.jsonOptions("POST", data));
      BloodApp.showMessage(message, result.message, "success");
      form.reset();
      dateInput.min = new Date().toISOString().slice(0, 10);
    } catch (error) {
      BloodApp.showMessage(message, error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Post blood request";
    }
  });
});
