document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("search-form");
  const results = document.getElementById("donor-results");
  const status = document.getElementById("results-status");

  async function search() {
    const params = new URLSearchParams(new FormData(form));
    status.textContent = "Searching donors…";
    results.innerHTML = "";
    try {
      const response = await BloodApp.api(`/api/donors/search?${params.toString()}`);
      status.textContent = `${response.donors.length} donor${response.donors.length === 1 ? "" : "s"} found`;
      if (!response.donors.length) {
        results.innerHTML = '<div class="empty-state">No donors found. Try a different blood group or city.</div>';
        return;
      }
      results.innerHTML = response.donors.map((donor) => `<article class="donor-card">
        <div class="card-topline"><h2>${BloodApp.escape(donor.name)}</h2><span class="blood-badge">${BloodApp.escape(donor.bloodGroup)}</span></div>
        <div class="card-detail"><p>📍 ${BloodApp.escape(donor.city)}${donor.state ? `, ${BloodApp.escape(donor.state)}` : ""}</p><p>☎ ${BloodApp.escape(donor.phone)}</p></div>
        <a class="button button-primary" href="tel:${encodeURIComponent(donor.phone)}">Call donor</a>
      </article>`).join("");
    } catch (error) {
      status.textContent = error.message;
      results.innerHTML = "";
    }
  }
  form.addEventListener("submit", function (event) { event.preventDefault(); search(); });
  search();
});
