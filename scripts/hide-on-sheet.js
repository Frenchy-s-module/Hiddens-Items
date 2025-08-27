// Patch universel pour filtrer les objets cachés sur toutes les fiches d'acteur standard
// Fonction utilitaire pour sécuriser la localisation même si la langue n'est pas encore chargée
function safeLocalize(key) {
  try {
    if (!game.i18n.translations || !game.i18n.translations[game.i18n.lang]) return key;
    return game.i18n.localize(key);
  } catch (e) {
    return key;
  }
}

Hooks.once('init', () => {
  if (!window.libWrapper) {
    ui.notifications?.error(safeLocalize("A-OMEGA.HiddenItems.Notifications.LibWrapperRequired"));
    return;
  }

  // Pour tous les types de fiches héritant de ActorSheet
  for (const sheetClass of Object.values(CONFIG.Actor.sheetClasses)) {
    for (const entry of Object.values(sheetClass)) {
      const cls = entry.cls;
      if (!cls?.prototype?.getData) continue;
      // Patch le getData de chaque fiche d'acteur
      try {
        libWrapper.register(
          'Hidden-Items',
          `${cls.name}.prototype.getData`,
          async function (wrapped, ...args) {
            const data = await wrapped.apply(this, args);
            if (!game.user.isGM && this.actor) {
              const hiddenData = HiddenItemsStorage.getHiddenItems(this.actor.id) || {};
              // Filtrage standard : actor.items (Foundry v10+)
              if (Array.isArray(data.items)) {
                data.items = data.items.filter(item => !hiddenData[item.id]);
              }
              // Filtrage pour certains systèmes qui stockent dans data.system.items
              if (Array.isArray(data.system?.items)) {
                data.system.items = data.system.items.filter(item => !hiddenData[item.id]);
              }
            }
            return data;
          },
          'WRAPPER'
        );
      } catch (e) {
        if (CONFIG.debug?.hiddenItems) {
          console.debug(`[Hidden-Items] Impossible de patcher ${cls.name}:`, e);
        }
      }
    }
  }
});
