"use strict";

(function bootstrapDashboard() {
  const params = new URLSearchParams(window.location.search);
  const requestedCustomer = (params.get('customer') || 'skroja').trim();
  const customerId = /^[a-zA-Z0-9_-]+$/.test(requestedCustomer)
    ? requestedCustomer
    : 'skroja';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Kunde inte ladda ${src}`));
      document.head.appendChild(script);
    });
  }

  async function start() {
    try {
      await loadScript(`customers/${encodeURIComponent(customerId)}/config.js`);
      if (!window.APP_CONFIG) {
        throw new Error(`Kundkonfiguration saknas för '${customerId}'.`);
      }
      await loadScript('core/app.js');
    } catch (error) {
      console.error(error);
      document.body.innerHTML = `
        <div style="font-family:Arial,sans-serif;padding:32px;color:#222;background:#fff;min-height:100vh">
          <h1>Dashboard kunde inte starta</h1>
          <p>${String(error.message || error)}</p>
          <p>Kontrollera kund-id och att config.js finns i rätt kundmapp.</p>
        </div>`;
    }
  }

  start();
})();
