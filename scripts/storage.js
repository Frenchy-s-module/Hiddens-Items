// === Système de stockage global pour Hidden-Items (comme TeamBox) ===
// Tous les objets cachés sont stockés dans les settings du module, indexés par actorId

class HiddenItemsStorage {
  static MODULE_ID = "Hidden-Items";
  static STORAGE_KEY = "hiddenItemsData";

  /**
   * Récupère les objets cachés pour un acteur donné
   * @param {string} actorId
   * @returns {Object}
   */
  static getHiddenItems(actorId) {
    const allData = game.settings.get(this.MODULE_ID, this.STORAGE_KEY) || {};
    return allData[actorId] || {};
  }

  /**
   * Met à jour la liste des objets cachés pour un acteur
   * @param {string} actorId
   * @param {Object} hiddenItemsData
   */
  static async setHiddenItems(actorId, hiddenItemsData) {
    const allData = game.settings.get(this.MODULE_ID, this.STORAGE_KEY) || {};
    allData[actorId] = hiddenItemsData;
    await game.settings.set(this.MODULE_ID, this.STORAGE_KEY, allData);
  }

  /**
   * Supprime tous les objets cachés d'un acteur
   * @param {string} actorId
   */
  static async clearHiddenItems(actorId) {
    const allData = game.settings.get(this.MODULE_ID, this.STORAGE_KEY) || {};
    delete allData[actorId];
    await game.settings.set(this.MODULE_ID, this.STORAGE_KEY, allData);
  }
}
