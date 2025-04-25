const HiddenItemsManager = window.HiddenItemsManager;
console.log('[Hidden-Items] popup.js chargé et exécuté');
// Classe pour la popup de gestion des objets cachés
// Classe pour la popup de gestion des objets cachés
class HiddenItemsPopup extends FormApplication {
    /**
     * Synchronise la réduction/aggrandissement avec la fiche parente
     */
    minimize(options) {
        const result = super.minimize(options);
        if (this.options.parent) {
            this.setPosition(options);
        }
        return result;
    }
    maximize(options) {
        const result = super.maximize(options);
        if (this.options.parent) {
            this.setPosition(options);
        }
        return result;
    }
    /**
     * Surveille les changements d'état de la fiche parente AU RENDU
     */
    render(force=false, options={}) {
        if (this.options.parent && this.options.parent.minimized && !this.minimized) {
            this.minimize();
        } else if (this.options.parent && !this.options.parent.minimized && this.minimized) {
            this.maximize();
        }
        return super.render(force, options);
    }
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

        // Drag & drop natif Foundry sur la zone objets cachés
        const droppable = html.find('.droppable-target');
        if (droppable.length) {
            // Visuel dragover
            droppable.on('dragover', ev => {
                ev.preventDefault();
                droppable.addClass('droppable-hover');
            });
            droppable.on('dragleave', ev => {
                droppable.removeClass('droppable-hover');
            });
            droppable.on('drop', async ev => {
                ev.preventDefault();
                droppable.removeClass('droppable-hover');
                if (!game.user.isGM) return ui.notifications.warn(game.i18n.localize("A-OMEGA.HiddenItems.Popup.onlyGM"));
                let data;
                try {
                    data = JSON.parse(ev.originalEvent.dataTransfer.getData('text/plain'));
                } catch (e) {
                    return ui.notifications.error(game.i18n.localize("A-OMEGA.HiddenItems.Popup.dropError"));
                }
                // Vérifie si c'est un Item
                if (data.type !== 'Item' && data.type !== 'item') {
                    return ui.notifications.error(game.i18n.localize("A-OMEGA.HiddenItems.Popup.onlyItems"));
                }
                // Récupère l'item depuis la source
                let item;
                if (data.pack) {
                    item = await fromUuid(data.uuid);
                } else if (data.actorId && data.data) {
                    item = new CONFIG.Item.documentClass(data.data, {parent: this.actor});
                } else if (data.uuid) {
                    item = await fromUuid(data.uuid);
                }
                if (!item) return ui.notifications.error(game.i18n.localize("A-OMEGA.HiddenItems.Popup.dropError"));
                // Vérifie si déjà présent
                let hiddenData = HiddenItemsStorage.getHiddenItems(this.actor.id) || {};
                if (hiddenData[item.id]) {
                    return ui.notifications.warn(game.i18n.localize("A-OMEGA.HiddenItems.Popup.alreadyHidden"));
                }
                // Ajoute l'objet à HiddenItemsStorage
                hiddenData[item.id] = item.toObject();
                await HiddenItemsStorage.setHiddenItems(this.actor.id, hiddenData);
                Hooks.callAll('hiddenItemsUpdated', this.actor.id, hiddenData);
                this.render(true, {keepId:true});
                ui.notifications.info(game.i18n.format("A-OMEGA.HiddenItems.Popup.itemHidden", {name: item.name}));
            });
        }
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

    /** Positionner la popup intelligemment selon l’état de la fiche parente */
    setPosition(options = {}) {
        const parentApp = this.options.parent;
        if (!parentApp) {
            // S'il n'y a pas de parent, on laisse Foundry gérer ou on applique une position par défaut
            return super.setPosition(options);
        }

        // Note : parentApp.position donne la position *actuelle* reportée par Foundry
        // Il peut y avoir un léger décalage visuel juste après une action rapide comme minimiser
        const parentPos = parentApp.position;
        let targetLeft, targetTop;

        if (parentApp.minimized) {
            // --- Logique de positionnement si la fiche parente est minimisée (DOCK HORIZONTALEMENT À DROITE) ---
            // On la place à droite de la fiche minimisée.
            // On lit la largeur de l'élément HTML de la fiche parente pour sa taille réelle minimisée.
            const minimizedParentWidth = parentApp.element ? parentApp.element.outerWidth() : 200; // Lire la largeur ou estimer
            const horizontalGap = 5; // Petit espace horizontal entre les deux fenêtres

            targetLeft = parentPos.left + minimizedParentWidth + horizontalGap; // Placer à droite de la fiche minimisée + espace
            targetTop = parentPos.top; // Aligner en haut avec la fiche minimisée

            if (CONFIG.debug?.hiddenItems) console.log(`[Hidden-Items] setPosition: Parent ${parentApp.appId} minimisé (Dock Horizontal). Position calculée: {top: ${targetTop}, left: ${targetLeft}}`);

            // Applique la position calculée. IMPORTANT : Ne PAS passer les 'options' ici pour éviter les interférences
            return super.setPosition({ left: targetLeft, top: targetTop }); // <-- MODIFIÉ : Retire ...options

        } else {
            // --- Logique de positionnement si la fiche parente n'est PAS minimisée (logique originale, à droite de la fiche agrandie) ---
            targetLeft = parentPos.left + parentPos.width + 20; // 20px à droite de la fiche agrandie
            targetTop = parentPos.top; // Aligner en haut avec la fiche agrandie

            if (CONFIG.debug?.hiddenItems) console.log(`[Hidden-Items] setPosition: Parent ${parentApp.appId} maximisé. Position calculée: {top: ${targetTop}, left: ${targetLeft}}`);

            // Applique la position calculée en fusionnant avec les options (utile lors du drag manuel de la popup agrandie)
            return super.setPosition({ left: targetLeft, top: targetTop, ...options }); // <-- GARDER : Conserve ...options ici
        }
    }
}

// Hook pour ajouter le bouton 'Objets cachés' (cadenas) à gauche du titre de la fiche
Hooks.on('renderActorSheet', (app, html, data) => {
    if (!game.user.isGM) return;

    // --- PATCH minimize/maximize via libWrapper ---

    // --- FIN PATCH ---
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
