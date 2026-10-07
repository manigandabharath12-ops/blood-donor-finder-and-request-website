// Shared navigation and small helpers used by each page script.
(function () {
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  const links = [
    ["Home", "index.html"],
    ["Find Donor", "find-donor.html"],
    ["Request Blood", "request.html"],
    ["Requests", "requests.html"],
    ["Register", "register.html"],
    ["Login", "login.html"]
  ];

  if (header) {
    const current = window.location.pathname.split("/").pop() || "index.html";
    header.innerHTML = `<div class="nav-wrap"><nav class="site-nav container" aria-label="Main navigation">
      <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true"><span>♥</span></span><span>Blood Donor Finder</span></a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-label="Toggle navigation">☰</button>
      <div class="nav-links">${links.map(([label, href]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ""}${href === "register.html" ? ' class="nav-cta"' : ""}>${label}</a>`).join("")}</div>
    </nav></div>`;
    const toggle = header.querySelector(".nav-toggle");
    const navLinks = header.querySelector(".nav-links");
    toggle.addEventListener("click", function () {
      const open = navLinks.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }
  if (footer) footer.innerHTML = '<div class="container">Blood Donor Finder · Every drop counts. <span>In an emergency, contact local medical services.</span></div>';

  window.BloodApp = {
    async api(url, options) {
      const response = await fetch(url, options || {});
      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        throw new Error("The server returned an unexpected response.");
      }
      if (!response.ok) throw new Error(payload.message || "The request could not be completed.");
      return payload;
    },
    escape(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
      });
    },
    showMessage(element, message, type) {
      element.textContent = message;
      element.className = `message visible ${type}`;
    },
    jsonOptions(method, body, token) {
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      return { method: method || "POST", headers, body: JSON.stringify(body) };
    }
  };
})();
