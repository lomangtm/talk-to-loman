(function() {
  var container = document.getElementById('loman-order-demo');
  if (!container) return;
  var config = {
    restaurantName: container.dataset.restaurant || 'Demo Restaurant',
    theme: container.dataset.theme || 'dark',
    apiBase: container.dataset.api || window.location.origin,
  };
  var iframe = document.createElement('iframe');
  iframe.src = config.apiBase;
  iframe.style.cssText = 'width:100%;height:700px;border:none;border-radius:12px;';
  iframe.allow = 'camera;microphone';
  container.appendChild(iframe);
})();
