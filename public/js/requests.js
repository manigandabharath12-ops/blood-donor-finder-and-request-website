document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("request-filter");
  const results = document.getElementById("request-results");
  const status = document.getElementById("requests-status");

  async function loadRequests() {
    const params = new URLSearchParams(new FormData(form));
    status.textContent = "Loading open requests…";
    results.innerHTML = "";
    try {
      const response = await BloodApp.api(`/api/requests?${params.toString()}`);
      status.textContent = `${response.requests.length} open request${response.requests.length === 1 ? "" : "s"}`;
      if (!response.requests.length) {
        results.innerHTML = '<div class="empty-state">No open requests match those filters.</div>';
        return;
      }
      results.innerHTML = response.requests.map((request) => {
        const urgencyClass = `urgency-${request.urgency.toLowerCase()}`;
        const neededBy = request.neededByDate ? new Date(request.neededByDate).toLocaleDateString() : "As soon as possible";
        return `<article class="request-card">
          <div class="card-topline"><h2>${BloodApp.escape(request.patientName)}</h2><span class="blood-badge">${BloodApp.escape(request.bloodGroup)}</span></div>
          <div class="card-detail">
            <p><span class="urgency-badge ${urgencyClass}">${BloodApp.escape(request.urgency)}</span></p>
            <p>${BloodApp.escape(request.unitsNeeded)} unit(s) · ${BloodApp.escape(request.hospitalName)}</p>
            <p>📍 ${BloodApp.escape(request.city)} · Needed by ${BloodApp.escape(neededBy)}</p>
            <p>Contact: ${BloodApp.escape(request.contactName)} · ${BloodApp.escape(request.contactPhone)}</p>
          </div>
          <a class="button button-primary" href="tel:${encodeURIComponent(request.contactPhone)}">Call contact</a>
        </article>`;
      }).join("");
    } catch (error) {
      status.textContent = error.message;
      results.innerHTML = "";
    }
  }
  form.addEventListener("submit", function (event) { event.preventDefault(); loadRequests(); });
  loadRequests();
});
