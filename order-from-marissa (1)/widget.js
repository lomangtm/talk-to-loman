(function() {
  var container = document.getElementById('loman-marissa-widget');
  if (!container) {
    console.warn('Loman: No element with id="loman-marissa-widget" found.');
    return;
  }
  var config = {
    apiBase: container.dataset.api || '',
    width: container.dataset.width || '100%',
    height: container.dataset.height || '600px',
  };
  if (!config.apiBase) {
    console.warn('Loman: data-api attribute is required (e.g. data-api="https://your-server.com")');
    return;
  }
  var iframe = document.createElement('iframe');
  iframe.src = config.apiBase;
  iframe.style.cssText = 'width:' + config.width + ';height:' + config.height + ';border:none;border-radius:12px;';
  iframe.allow = 'microphone; camera; autoplay';
  iframe.setAttribute('allowfullscreen', '');
  iframe.title = 'Talk to Marissa - Loman AI';
  container.appendChild(iframe);
})();
