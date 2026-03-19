// content-scripts/tech-stack.js
// Extracted from background.js lines 6215-6237 (tech stack detection)
// Detects frameworks, CMSs, and JS libraries via meta, scripts, and globals

(function() {
  var techs = [];

  var gen = document.querySelector('meta[name="generator"]');
  if (gen) techs.push({ source: 'meta', value: gen.getAttribute('content') || '' });

  var scripts = Array.from(document.querySelectorAll('script[src]')).map(function(s) { return s.src; });
  techs.push({ source: 'scripts', value: scripts });

  var links = Array.from(document.querySelectorAll('link[href]')).map(function(l) { return l.href; });
  techs.push({ source: 'links', value: links });

  // JS globals — quick check for common frameworks
  var globals = [];
  try { if (window.React || document.querySelector('[data-reactroot]')) globals.push('React'); } catch(e) {}
  try { if (window.Vue || document.querySelector('[data-v-]')) globals.push('Vue'); } catch(e) {}
  try { if (window.angular || document.querySelector('[ng-app]')) globals.push('Angular'); } catch(e) {}
  try { if (window.jQuery || (window.$ && window.$.fn && window.$.fn.jquery)) globals.push('jQuery ' + ((window.$ && window.$.fn && window.$.fn.jquery) || '')); } catch(e) {}
  try { if (window.__NEXT_DATA__) globals.push('Next.js'); } catch(e) {}
  try { if (window.__NUXT__) globals.push('Nuxt.js'); } catch(e) {}
  try { if (window.Shopify) globals.push('Shopify'); } catch(e) {}
  try { if (document.querySelector('meta[name="generator"][content*="WordPress"]') || document.querySelector('link[href*="wp-content"]')) globals.push('WordPress'); } catch(e) {}
  try { if (document.querySelector('link[href*="drupal"]')) globals.push('Drupal'); } catch(e) {}
  techs.push({ source: 'globals', value: globals });

  return techs;
})();
