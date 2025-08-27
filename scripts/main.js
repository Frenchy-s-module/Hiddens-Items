window.HiddenItemsManager = class HiddenItemsManager {
    static ID = 'Hidden-Items';
    
    // Plus de FLAGS pour le stockage, tout passe par HiddenItemsStorage
// Correction : toutes les références à des flags d'acteur sont supprimées, seul HiddenItemsStorage est utilisé pour la gestion des objets cachés.

    static initialize() {
        Hooks.once('ready', () => {
            game.modules.get(this.ID).api = {
                hideItem: this.hideItem.bind(this),
                showItem: this.showItem.bind(this),
                toggleItemVisibility: this.toggleItemVisibility.bind(this),
                isItemHidden: this.isItemHidden.bind(this),
                clearHiddenItems: this.clearHiddenItems.bind(this),
                getHiddenItemsData: this.getHiddenItemsData.bind(this)
            };
        });

        // Ajout du menu contextuel pour cacher/afficher les objets
        Hooks.on('getActorSheetItemContextOptions', (sheet, options) => {
            // Cacher l'objet (le déplacer dans le flag)
            options.push({
                name: game.i18n.localize("A-OMEGA.HiddenItems.ContextMenu.HideItem"),
                icon: '<i class="fas fa-eye-slash"></i>',
                condition: li => {
                    const actor = sheet.actor;
                    const itemId = li.data("item-id");
                    if (!game.user.isGM) return false;
                    // Ne pas afficher si déjà caché (stockage global)
                    const hiddenData = HiddenItemsStorage.getHiddenItems(actor.id) || {};
                    return !hiddenData[itemId];
                },
                callback: async li => {
                    const actor = sheet.actor;
                    const itemId = li.data("item-id");
                    await HiddenItemsManager.hideItem(actor, itemId);
                }
            });
            // === HOOKS DE DEBUG POUR TRAQUER LES MODIFICATIONS DU FLAG HIDDEN_ITEMS_DATA ===
// (Supprimé : on n'utilise plus de flag, mais le storage global)
            if (CONFIG.debug?.hiddenItems) {
              Hooks.on("preUpdateActor", (actor, update, options, userId) => {
                if (update.flags && update.flags["Hidden-Items"] && update.flags["Hidden-Items"].hiddenItemsData) {
                  console.warn("[Hidden-Items][HOOK][preUpdateActor] flags.hiddenItemsData va être modifié :", update.flags["Hidden-Items"].hiddenItemsData, "par userId:", userId, "options:", options);
                  console.trace("[Hidden-Items][HOOK][preUpdateActor] Stack trace");
                }
              });
              Hooks.on("updateActor", (actor, update, options, userId) => {
                if (actor.getFlag && actor.getFlag("Hidden-Items", "hiddenItemsData")) {
                  console.warn("[Hidden-Items][HOOK][updateActor] flags.hiddenItemsData après update :", actor.getFlag("Hidden-Items", "hiddenItemsData"), "par userId:", userId, "options:", options);
                  console.trace("[Hidden-Items][HOOK][updateActor] Stack trace");
                }
              });
            }
            // === FIN HOOKS DEBUG ===
            // Afficher l'objet (le restaurer dans la fiche)
            options.push({
                name: game.i18n.localize("A-OMEGA.HiddenItems.ContextMenu.ShowItem"),
                icon: '<i class="fas fa-eye"></i>',
                condition: li => {
                    const actor = sheet.actor;
                    const itemId = li.data("item-id");
                    if (!game.user.isGM) return false;
                    const hiddenData = HiddenItemsStorage.getHiddenItems(actor.id) || {};
                    return !!hiddenData[itemId];
                },
                callback: async li => {
                    const actor = sheet.actor;
                    const itemId = li.data("item-id");
                    await HiddenItemsManager.showItem(actor, itemId);
                }
            });
        });

        // Masquer les objets cachés côté joueur (hors MJ)
        Hooks.on('renderActorSheet', (app, html, data) => {
            if (game.user.isGM) return;
            const hiddenData = HiddenItemsStorage.getHiddenItems(app.actor.id) || {};
            html.find('[data-item-id]').each((i, el) => {
                const itemId = $(el).data('item-id');
                if (hiddenData[itemId]) $(el).hide();
            });
        });

        // Adapter le calcul du poids total pour ignorer les objets cachés
        Hooks.on('renderActorSheet', (app, html, data) => {
            const actor = app.actor;
            const hiddenData = HiddenItemsStorage.getHiddenItems(actor.id) || {};
            // Exemple de recalcul pour DnD5e, à adapter selon le système
            if (actor.system && actor.system.attributes && actor.system.attributes.encumbrance) {
                let totalWeight = 0;
                for (const item of actor.items) {
                    if (!hiddenData[item.id] && item.system && item.system.weight) {
                        totalWeight += (item.system.quantity || 1) * (item.system.weight || 0);
                    }
                }
                if (html.find('.encumbrance .encumbrance-value').length) {
                    html.find('.encumbrance .encumbrance-value').text(totalWeight.toFixed(2));
                }
            }
        });

        Hooks.on('renderModuleManagement', (app, html, data) => {
            // Trouver la section de notre module
            // (Supprimé : moduleId non utilisé, tout passe par HiddenItemsStorage.MODULE_ID)
            const moduleSection = html.find(`div[data-module-id="${HiddenItemsStorage.MODULE_ID}"]`);
            
            if (moduleSection.length) {
                // Créer le bouton GitHub
                const githubButton = $(`
                    <button type="button" class="github-button">
                        <i class="fab fa-github"></i> GitHub
                    </button>
                `);
                
                // Ajouter le style au bouton
                githubButton.css({
                    'margin-left': '10px',
                    'background': '#24292e',
                    'color': 'white',
                    'border': 'none',
                    'padding': '5px 10px',
                    'border-radius': '3px',
                    'cursor': 'pointer'
                });
                
                // Ajouter l'événement de clic
                githubButton.on('click', () => {
                    window.open('https://github.com/Frenchy-s-module/Hiddens-Items', '_blank');
                });
                
                // Ajouter le bouton à côté du titre du module
                moduleSection.find('h3').append(githubButton);
            }
        });
    }

    /**
     * Cache un objet : le retire de la fiche et le stocke dans le storage global (HiddenItemsStorage)
     */
    static async hideItem(actor, itemId) {
        if (!game.user.isGM) return;
        const item = actor.items.get(itemId);
        if (!item) {
            ui.notifications.error(game.i18n.localize("A-OMEGA.HiddenItems.Notifications.ItemNotFound"));
            return;
        }
        // Récupérer les objets cachés actuels
        let hiddenData = HiddenItemsStorage.getHiddenItems(actor.id);
        if (!hiddenData) hiddenData = {};
        if (hiddenData[itemId]) {
            ui.notifications.warn(game.i18n.localize("A-OMEGA.HiddenItems.Notifications.AlreadyHidden"));
            return;
        }
        // Stocker l'objet complet
        hiddenData[itemId] = item.toObject();
        await HiddenItemsStorage.setHiddenItems(actor.id, hiddenData);
        // --- HOOK PERSONNALISÉ ---
        Hooks.callAll('hiddenItemsUpdated', actor.id, foundry.utils.duplicate(hiddenData));
        if (CONFIG.debug?.hiddenItems) {
            console.log(`[Hidden-Items][hideItem] Storage mis à jour et hook 'hiddenItemsUpdated' appelé pour ${actor.name}`);
        }
        // --- FIN HOOK PERSONNALISÉ ---
        // Supprimer l'objet de la fiche
        await actor.deleteEmbeddedDocuments("Item", [itemId]);
        ui.notifications.info(game.i18n.format("A-OMEGA.HiddenItems.Notifications.ItemHidden", { itemName: item.name }));
        // --- RÉTABLIR LE RENDU DE LA FICHE ---
        for (const app of Object.values(actor.apps)) {
    if (app.rendered) app.render(true);
}
        // --- FIN RÉTABLISSEMENT ---
    }

    /**
     * Restaure un objet caché dans la fiche
     */
    static async showItem(actor, itemId) {
        if (!game.user.isGM) return;

        if (CONFIG.debug?.hiddenItems) {
            console.log(`[Hidden-Items][showItem] --- DÉBUT ---`);
            console.log(`[Hidden-Items][showItem] Actor:`, actor);
            console.log(`[Hidden-Items][showItem] ItemId demandé:`, itemId);
        }

        // On récupère à nouveau les données pour s'assurer d'avoir la version la plus récente
        let hiddenData = foundry.utils.duplicate(HiddenItemsStorage.getHiddenItems(actor.id));
        if (!hiddenData) hiddenData = {};
        if (CONFIG.debug?.hiddenItems) {
            const flagBefore = foundry.utils.duplicate(hiddenData);
            console.log(`[Hidden-Items][showItem] Données récupérées AVANT toute action:`, flagBefore);
        }

        // Vérifier que l'objet est bien caché
        if (!hiddenData[itemId]) {
            ui.notifications.warn(game.i18n.localize("A-OMEGA.HiddenItems.Notifications.NotHidden"));
            return;
        }
        // Restaurer l'objet dans la fiche
        // IMPORTANT : il faut supprimer la propriété _id pour éviter toute duplication ou collision lors de la création
        let itemData = foundry.utils.duplicate(hiddenData[itemId]);
        delete itemData._id;
        await actor.createEmbeddedDocuments("Item", [itemData]);
        // Supprimer l'objet du stockage
        delete hiddenData[itemId];
        await HiddenItemsStorage.setHiddenItems(actor.id, hiddenData);
        // --- HOOK PERSONNALISÉ ---
        Hooks.callAll('hiddenItemsUpdated', actor.id, foundry.utils.duplicate(hiddenData));
        if (CONFIG.debug?.hiddenItems) {
            console.log(`[Hidden-Items][showItem] Storage mis à jour et hook 'hiddenItemsUpdated' appelé pour ${actor.name}`);
        }
        // --- FIN HOOK PERSONNALISÉ ---
        if (CONFIG.debug?.hiddenItems) {
            const dataAfter = HiddenItemsStorage.getHiddenItems(actor.id);
            console.log(`[Hidden-Items][showItem] Données après setHiddenItems :`, dataAfter);
            console.log(`[Hidden-Items][showItem] --- FIN ---`);
        }
        ui.notifications.info(game.i18n.format("A-OMEGA.HiddenItems.Notifications.ItemShown", { itemName: itemData.name }));
        // --- RÉTABLIR LE RENDU DE LA FICHE ---
        for (const app of Object.values(actor.apps)) {
    if (app.rendered) app.render(true);
}
        // --- FIN RÉTABLISSEMENT ---
    }

    /**
     * Bascule la visibilité d'un objet d'acteur
     */
    static async toggleItemVisibility(actor, itemId) {
        const isHidden = this.isItemHidden(actor, itemId);
        if (isHidden) {
            return await this.showItem(actor, itemId);
        } else {
            return await this.hideItem(actor, itemId);
        }
    }

    /**
     * Retourne true si l'objet est caché (présent dans le flag)
     */
    static isItemHidden(actor, itemId) {
        let hiddenData = HiddenItemsStorage.getHiddenItems(actor.id);
        if (!hiddenData) hiddenData = {};
        return !!hiddenData[itemId];
    }

    /**
     * Récupère tous les objets cachés (flag)
     */
    static getHiddenItemsData(actor) {
        let hiddenData = HiddenItemsStorage.getHiddenItems(actor.id);
        if (!hiddenData) hiddenData = {};
        return hiddenData;
    }

    /**
     * Vide la liste des objets cachés (et les restaure dans la fiche)
     */
    static async clearHiddenItems(actor) {
        if (!game.user.isGM) return;
        let hiddenData = foundry.utils.duplicate(HiddenItemsStorage.getHiddenItems(actor.id));
        if (!hiddenData) hiddenData = {};
        // Confirmation
        const confirm = await Dialog.confirm({
            title: game.i18n.localize("A-OMEGA.HiddenItems.ConfirmClear.Title"),
            content: game.i18n.localize("A-OMEGA.HiddenItems.ConfirmClear.Content"),
            yes: () => true,
            no: () => false,
            defaultYes: false
        });
        if (!confirm) return;
        // Restaurer tous les objets
        const itemsToRestore = Object.values(hiddenData);
        if (itemsToRestore.length > 0) {
            await actor.createEmbeddedDocuments("Item", itemsToRestore);
        }
        await HiddenItemsStorage.clearHiddenItems(actor.id);
        // --- HOOK PERSONNALISÉ ---
        Hooks.callAll('hiddenItemsUpdated', actor.id, {});
        if (CONFIG.debug?.hiddenItems) {
            console.log(`[Hidden-Items][clearHiddenItems] Storage vidé et hook 'hiddenItemsUpdated' appelé pour ${actor.name}`);
        }
        // --- FIN HOOK PERSONNALISÉ ---
        if (CONFIG.debug?.hiddenItems) {
            const flagAfter = HiddenItemsStorage.getHiddenItems(actor.id);
            console.log(`[Hidden-Items][clearHiddenItems] Storage hiddenItemsData après clearHiddenItems :`, flagAfter); // Doit être {} ou undefined
        }
        // --- FIN LOG DEBUG ---
        ui.notifications.info(game.i18n.localize("A-OMEGA.HiddenItems.Notifications.ListCleared"));
        // --- RÉTABLIR LE RENDU DE LA FICHE ---
        for (const app of Object.values(actor.apps)) {
    if (app.rendered) app.render(true);
}
        // --- FIN RÉTABLISSEMENT ---
    }
}

Hooks.once('init', () => {
    // Enregistrement du storage global pour les objets cachés (toujours, sans dépendre de libWrapper)
    game.settings.register(HiddenItemsStorage.MODULE_ID, HiddenItemsStorage.STORAGE_KEY, {
        name: "Objets cachés par acteur (stockage global)",
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    // Initialisation du manager et de l'API
    HiddenItemsManager.initialize();

    // Patching optionnel via libWrapper (si présent)
    if (!globalThis.libWrapper) {
        ui.notifications?.warn(game.i18n.localize("A-OMEGA.HiddenItems.Notifications.LibWrapperRequired"));
        return; // On ne patche pas les méthodes d'ActorSheet, mais le module reste fonctionnel
    }

    // --- PATCHES LIBWRAPPER UNIQUES ---
    try {
        libWrapper.register(
            'Hidden-Items',
            "ActorSheet.prototype.minimize",
            async function (wrapped, ...args) {
                const result = await wrapped.apply(this, args);
                if (this._hiddenItemsPopup && this._hiddenItemsPopup.rendered) {
                    if (CONFIG.debug?.hiddenItems) console.log(`[Hidden-Items] Init Patch minimize: appel minimize sur popup ${this._hiddenItemsPopup.appId}`);
                    this._hiddenItemsPopup.minimize(args[0]);
                }
                return result;
            },
            'WRAPPER'
        );
        libWrapper.register(
            'Hidden-Items',
            "ActorSheet.prototype.maximize",
            async function (wrapped, ...args) {
                const result = await wrapped.apply(this, args);
                if (this._hiddenItemsPopup && this._hiddenItemsPopup.rendered) {
                    if (CONFIG.debug?.hiddenItems) console.log(`[Hidden-Items] Init Patch maximize: appel maximize sur popup ${this._hiddenItemsPopup.appId}`);
                    this._hiddenItemsPopup.maximize(args[0]);
                }
                return result;
            },
            'WRAPPER'
        );
        libWrapper.register(
            'Hidden-Items',
            "ActorSheet.prototype.setPosition",
            async function (wrapped, ...args) {
                const result = await wrapped.apply(this, args);
                if (this._hiddenItemsPopup && this._hiddenItemsPopup.rendered) {
                    if (CONFIG.debug?.hiddenItems) console.log(`[Hidden-Items] Init Patch setPosition: appel setPosition sur popup ${this._hiddenItemsPopup.appId}`);
                    this._hiddenItemsPopup.setPosition();
                }
                return result;
            },
            'WRAPPER'
        );
        if (CONFIG.debug?.hiddenItems) console.log('[Hidden-Items] Patches ActorSheet.prototype.* enregistrés dans init.');
    } catch (e) {
        console.error("[Hidden-Items] Erreur lors de l'enregistrement des patches ActorSheet.prototype.* dans init :", e);
        if (CONFIG.debug?.hiddenItems) ui.notifications.error(`[Hidden-Items] Init Patching Error: ${e.message}`);
    }
    // --- FIN PATCHES LIBWRAPPER UNIQUES ---
});