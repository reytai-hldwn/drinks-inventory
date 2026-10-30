// The chosen site design is warm ivory and champagne gold.
// Explicit demo query links keep the archived proposal gallery usable;
// a previous browser preference never changes the main site's design.
(() => {
  const requested = new URLSearchParams(location.search).get('style');
  const proposalPreview = /(?:^|\/)demo\.html$/.test(location.pathname);
  document.documentElement.dataset.theme = proposalPreview && ['navy', 'sage'].includes(requested) ? requested : 'gold';
})();
