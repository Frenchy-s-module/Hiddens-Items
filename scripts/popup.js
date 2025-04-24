const HiddenItemsManager = window.HiddenItemsManager;
console.log('[Hidden-Items] popup.js chargé et exécuté');
// Classe pour la popup de gestion des objets cachés
class HiddenItemsPopup extends FormApplication {
    constructor(actor, options = {}) {
        // Crée un titre dynamique incluant le nom de l'acteur
        const dynamicTitle = `${game.i18n.localize("A-OMEGA.HiddenItems.Popup.title")} – ${actor.name}`;
        // Injecte un id unique par acteur pour permettre plusieurs popups
        options = {
            ...options,
            id: `hidden-items-popup-${actor.id}`,
            title: dynamicTitle
        };
        super(actor, options);
        this.actor = actor;
        this._realtimeSync = false;
        this._hooks = null;
        this.activateRealtimeSync();
        console.log('[Hidden-Items] HiddenItemsPopup instanciée pour', actor.name);
    }

    /**
     * Synchronisation temps réel : met à jour la popup dès qu'un changement survient sur la fiche ou les objets de l'acteur
     */
    activateRealtimeSync() {
        if (this._realtimeSync) return;
        const actorId = this.actor.id;
        this._hooks = [
            // --- HOOK PERSONNALISÉ UNIQUEMENT ---
            {
                name: 'hiddenItemsUpdated',
                id: Hooks.on('hiddenItemsUpdated', (updatedActorId, updatedHiddenData) => {
                    if (updatedActorId === actorId && this.rendered) {
                        if (CONFIG.debug?.hiddenItems) {
                            console.log(`[Hidden-Items][Popup][Hook] hiddenItemsUpdated triggered render for actor ${actorId}`);
                            console.log(`[Hidden-Items][Popup][Hook] Updated hidden data received:`, updatedHiddenData);
                        }
                        this.render(true, {keepId: true});
                    }
                })
            },
            // --- HOOKS FOUNDRY NATIFS POUR SYNCHRONISATION TEMPS RÉEL ---
            {
                name: 'createItem',
                id: Hooks.on('createItem', (item, data, options, userId) => {
                    if (item.parent?.id === actorId && this.rendered) {
                        if (CONFIG.debug?.hiddenItems) {
                            console.log(`[Hidden-Items][Popup][Hook] createItem triggered render for actor ${actorId}`);
                        }
                        this.render(true, {keepId: true});
                    }
                })
            },
            {
                name: 'deleteItem',
                id: Hooks.on('deleteItem', (item, data, options, userId) => {
                    if (item.parent?.id === actorId && this.rendered) {
                        if (CONFIG.debug?.hiddenItems) {
                            console.log(`[Hidden-Items][Popup][Hook] deleteItem triggered render for actor ${actorId}`);
                        }
                        this.render(true, {keepId: true});
                    }
                })
            },
            {
                name: 'updateItem',
                id: Hooks.on('updateItem', (item, data, options, userId) => {
                    if (item.parent?.id === actorId && this.rendered) {
                        if (CONFIG.debug?.hiddenItems) {
                            console.log(`[Hidden-Items][Popup][Hook] updateItem triggered render for actor ${actorId}`);
                        }
                        this.render(true, {keepId: true});
                    }
                })
            }
        ];
        // Nettoyage des hooks non valides
        this._hooks = this._hooks.filter(hook => hook.id !== false);
        if (CONFIG.debug?.hiddenItems) {
            console.log('[Hidden-Items] Hooks temps réel enregistrés:', this._hooks.map(h => h.name));
        }
        this._realtimeSync = true;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            // L'id sera injecté dynamiquement dans le constructeur pour chaque acteur
            // title: game.i18n.localize("A-OMEGA.HiddenItems.Popup.title"),
            template: "modules/Hidden-Items/templates/popup.html",
            width: 400,
            height: "auto",
            resizable: true,
            closeOnSubmit: false
        });
    }

    async _renderInner(data, options) {
        try {
            const html = await super._renderInner(data, options);
            console.log('[Hidden-Items] Template popup.html rendu avec succès');
            return html;
        } catch (e) {
            // Fallback en cas d'échec du template
            console.error('[Hidden-Items] Erreur de rendu du template popup.html', e);
            return $(`<div style='color:red;padding:1em;'>Erreur de chargement du template popup.html</div>`);
        }
    }

    getData() {
        // --- LOG DEBUG ---
        if (CONFIG.debug?.hiddenItems) {
            console.log(`[Hidden-Items][getData] hiddenItemsData storage content:`, HiddenItemsStorage.getHiddenItems(this.actor.id) || {});
        }
        // --- FIN LOG DEBUG ---
        // Objets visibles sur la fiche
        const visibleItems = this.actor.items.contents.map(item => ({
            id: item.id,
            name: item.name,
            type: item.type,
            img: item.img
        }));
        // Objets cachés dans le storage global
        const hiddenData = HiddenItemsStorage.getHiddenItems(this.actor.id);
        const hiddenItems = Object.values(hiddenData).map(item => ({
            id: item._id,
            name: item.name,
            type: item.type,
            img: item.img
        }));
        return {
            popupTitle: game.i18n.localize("A-OMEGA.HiddenItems.Popup.title"),
            visibleLabel: game.i18n.localize("A-OMEGA.HiddenItems.Popup.VisibleLabel"),
            hiddenLabel: game.i18n.localize("A-OMEGA.HiddenItems.Popup.HiddenLabel"),
            clearListLabel: game.i18n.localize("A-OMEGA.HiddenItems.ClearList"),
            noVisibleItemsLabel: game.i18n.localize("A-OMEGA.HiddenItems.Popup.NoVisibleItems"),
            noHiddenItemsLabel: game.i18n.localize("A-OMEGA.HiddenItems.Popup.NoHiddenItems"),
            visibleItems,
            hiddenItems,
            isGM: game.user.isGM,
            actorName: this.actor.name
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        // Cacher un objet (depuis la liste visible)
        html.find(".hide-item").click(async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const itemId = ev.currentTarget.dataset.itemId;
            await HiddenItemsManager.hideItem(this.actor, itemId);
        });
        // Restaurer un objet (depuis la liste cachée)
        html.find(".show-item").click(async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const itemId = ev.currentTarget.dataset.itemId;
            await HiddenItemsManager.showItem(this.actor, itemId);
        });
        // Gestion du bouton poubelle pour supprimer un objet caché individuellement
        html.find(".delete-hidden-item-btn").click(async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const itemId = ev.currentTarget.dataset.itemId;
            const confirmed = await Dialog.confirm({
                title: game.i18n.localize("A-OMEGA.HiddenItems.ConfirmDelete.Title"),
                content: game.i18n.localize("A-OMEGA.HiddenItems.ConfirmDelete.Content"),
                yes: () => true,
                no: () => false,
                defaultYes: false
            });
            if (!confirmed) return;
            // Suppression côté storage
            let hiddenData = foundry.utils.duplicate(HiddenItemsStorage.getHiddenItems(this.actor.id));
            delete hiddenData[itemId];
            await HiddenItemsStorage.setHiddenItems(this.actor.id, hiddenData);
            Hooks.callAll('hiddenItemsUpdated', this.actor.id, hiddenData);
            this.render(true, {keepId:true});
            ui.notifications.info(game.i18n.localize("A-OMEGA.HiddenItems.Notifications.ItemDeleted"));
        });
        // Gestion du bouton poubelle pour vider tous les objets cachés
        html.find(".clear-hidden-items-btn").click(async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const confirmed = await Dialog.confirm({
                title: game.i18n.localize("A-OMEGA.HiddenItems.ConfirmClear.Title"),
                content: game.i18n.localize("A-OMEGA.HiddenItems.ConfirmClear.Content"),
                yes: () => true,
                no: () => false,
                defaultYes: false
            });
            if (!confirmed) return;
            await HiddenItemsStorage.clearHiddenItems(this.actor.id);
            Hooks.callAll('hiddenItemsUpdated', this.actor.id, {});
            this.render(true, {keepId:true});
            ui.notifications.info(game.i18n.localize("A-OMEGA.HiddenItems.Notifications.ListCleared"));
        });
    }

    /** Positionner la popup à droite de la fiche personnage */
    setPosition(options = {}) {
        super.setPosition(options);
        if (this.options.parent && this.options.parent.position) {
            const parentPos = this.options.parent.position;
            this.element.css({
                left: (parentPos.left + parentPos.width + 20) + "px",
                top: parentPos.top + "px"
            });
        }
    }

    /** Nettoyage des hooks à la fermeture de la popup */
    async close(...args) {
        if (this._hooks) {
            this._hooks.forEach(hook => {
                if (hook && typeof hook.name === 'string' && typeof hook.id === 'number') {
                    Hooks.off(hook.name, hook.id);
                    if (CONFIG.debug?.hiddenItems) {
                        console.log(`[Hidden-Items] Désenregistrement du hook ${hook.name} (ID: ${hook.id})`);
                    }
                } else {
                    if (CONFIG.debug?.hiddenItems) {
                        console.warn("[Hidden-Items] Tentative de désenregistrement d'un hook invalide:", hook);
                    }
                }
            });
            this._hooks = null;
            this._realtimeSync = false;
        }
        // Nettoyer la référence sur la fiche parente si elle existe
        if (this.options?.parent && this.options.parent._hiddenItemsPopup === this) {
            this.options.parent._hiddenItemsPopup = null;
        }
        return super.close(...args);
    }
}

// Hook pour ajouter le bouton 'Objets cachés' (cadenas) à gauche du titre de la fiche
Hooks.on('renderActorSheet', (app, html, data) => {
    if (!game.user.isGM) return;
    // Trouver la barre d'en-tête de la fenêtre
    const $window = html.closest('.app');
    const $header = $window.find('.window-header');
    const $title = $header.find('.window-title');
    if (!$header.length || !$title.length) return;
    // Empêcher doublons
    if ($header.find('.hidden-items-header-btn').length) return;
    // Créer le bouton
    const btn = $(
        `<a class="hidden-items-header-btn" title="${game.i18n.localize('A-OMEGA.HiddenItems.HeaderButton')}" style="margin-right:6px;cursor:pointer;">
            <i class="fas fa-eye-slash icon-eye-hidden" style="color:#c00;"></i>
        </a>`
    );
    btn.on('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!app._hiddenItemsPopup || app._hiddenItemsPopup._state === 0) {
            app._hiddenItemsPopup = new HiddenItemsPopup(app.actor, {parent: app});
            app._hiddenItemsPopup.render(true);
        } else {
            app._hiddenItemsPopup.close();
            app._hiddenItemsPopup = null;
        }
    });
    // Insérer le bouton juste avant le titre
    $title.before(btn);
    // Fermer la popup si la fiche se ferme
    Hooks.once('closeActorSheet', (closedApp) => {
        if (closedApp === app && app._hiddenItemsPopup) {
            app._hiddenItemsPopup._syncClosing = true;
            app._hiddenItemsPopup.close();
            app._hiddenItemsPopup = null;
        }
    });
});
