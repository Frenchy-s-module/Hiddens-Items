const HiddenItemsManager = window.HiddenItemsManager;
console.log('[Hidden-Items] popup.js chargé et exécuté');
// Classe pour la popup de gestion des objets cachés (ApplicationV2 + Handlebars)
class HiddenItemsPopup extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "hidden-items-popup",
        position: { width: 400, height: "auto" }
    };

    // Définition de la vue Handlebars (part principale "content")
    static PARTS = {
        content: {
            template: "modules/Hidden-Items/templates/popup.html"
        }
    };
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
    constructor(actor, options = {}) {
        const injected = {
            ...options,
            id: `hidden-items-popup-${actor.id}`
        };
        super(injected);
        this.actor = actor;
        this._realtimeSync = false;
        this._hooks = null;
        this.activateRealtimeSync();
        console.log('[Hidden-Items] HiddenItemsPopup instanciée pour', actor.name);
    }

    get title() {
        return `${game.i18n.localize("A-OMEGA.HiddenItems.Popup.title")} – ${this.actor.name}`;
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

    // V2 prépare le contexte du template ici; on réutilise getData existant
    async _prepareContext(options) { return this.getData(); }

    /**
     * ApplicationV2: appelé après chaque rendu; on (re)lie les événements ici pour être certain que le DOM de la PART "content" est présent.
     */
    async _onRender(context, parts) {
        try {
            const root = parts?.content?.element ?? this.element;
            if (CONFIG.debug?.hiddenItems) console.log('[Hidden-Items][Popup] _onRender → bind events', { hasParts: !!parts, hasContent: !!parts?.content?.element });
            this.activateListeners(root);
        } catch (e) {
            console.error('[Hidden-Items][Popup] _onRender error', e);
        }
    }

    /**
     * Appelé uniquement lors du premier rendu; on logge pour diagnostic.
     */
    async _onFirstRender(context, parts) {
        if (CONFIG.debug?.hiddenItems) console.log('[Hidden-Items][Popup] _onFirstRender');
        return this._onRender(context, parts);
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
        super.activateListeners?.(html);
        const $ = window.jQuery ?? window.$;
        const rootEl = html ?? this.element;
        const $root = $(rootEl);
        if (CONFIG.debug?.hiddenItems) {
            console.log('[Hidden-Items][Popup] activateListeners', { hasHtml: !!html, elementExists: !!this.element });
        }
        if (!$root?.length) {
            console.warn('[Hidden-Items][Popup] activateListeners: root introuvable');
            return;
        }

        // Nettoyage pour éviter les doublons lors des re-renders
        $root.off('.hiddenitems');

        // Délégation d'événements (namespace .hiddenitems) pour supporter les rerenders partiels d'ApplicationV2
        $root.on('dragover.hiddenitems', '.droppable-target', ev => {
            ev.preventDefault();
            $(ev.currentTarget).addClass('droppable-hover');
        });
        $root.on('dragleave.hiddenitems', '.droppable-target', ev => {
            $(ev.currentTarget).removeClass('droppable-hover');
        });
        $root.on('drop.hiddenitems', '.droppable-target', async ev => {
            ev.preventDefault();
            $(ev.currentTarget).removeClass('droppable-hover');
            if (CONFIG.debug?.hiddenItems) console.log('[Hidden-Items][Popup] drop detected');
            if (!game.user.isGM) return ui.notifications.warn(game.i18n.localize("A-OMEGA.HiddenItems.Popup.onlyGM"));
            let data;
            try {
                data = JSON.parse(ev.originalEvent.dataTransfer.getData('text/plain'));
            } catch (e) {
                return ui.notifications.error(game.i18n.localize("A-OMEGA.HiddenItems.Popup.dropError"));
            }
            if (data.type !== 'Item' && data.type !== 'item') {
                return ui.notifications.error(game.i18n.localize("A-OMEGA.HiddenItems.Popup.onlyItems"));
            }
            let item;
            if (data.pack) {
                item = await fromUuid(data.uuid);
            } else if (data.actorId && data.data) {
                item = new CONFIG.Item.documentClass(data.data, {parent: this.actor});
            } else if (data.uuid) {
                item = await fromUuid(data.uuid);
            }
            if (!item) return ui.notifications.error(game.i18n.localize("A-OMEGA.HiddenItems.Popup.dropError"));
            let hiddenData = HiddenItemsStorage.getHiddenItems(this.actor.id) || {};
            if (hiddenData[item.id]) {
                return ui.notifications.warn(game.i18n.localize("A-OMEGA.HiddenItems.Popup.alreadyHidden"));
            }
            hiddenData[item.id] = item.toObject();
            await HiddenItemsStorage.setHiddenItems(this.actor.id, hiddenData);
            Hooks.callAll('hiddenItemsUpdated', this.actor.id, hiddenData);
            this.render(true, {keepId:true});
            ui.notifications.info(game.i18n.format("A-OMEGA.HiddenItems.Popup.itemHidden", {name: item.name}));
        });

        $root.on('click.hiddenitems', '.hide-item', async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            if (CONFIG.debug?.hiddenItems) console.log('[Hidden-Items][Popup] click .hide-item');
            const itemId = ev.currentTarget.dataset.itemId;
            await HiddenItemsManager.hideItem(this.actor, itemId);
        });

        $root.on('click.hiddenitems', '.show-item', async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            if (CONFIG.debug?.hiddenItems) console.log('[Hidden-Items][Popup] click .show-item');
            const itemId = ev.currentTarget.dataset.itemId;
            await HiddenItemsManager.showItem(this.actor, itemId);
        });

        $root.on('click.hiddenitems', '.delete-hidden-item-btn', async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            if (CONFIG.debug?.hiddenItems) console.log('[Hidden-Items][Popup] click .delete-hidden-item-btn');
            const itemId = ev.currentTarget.dataset.itemId;
            const confirmed = await Dialog.confirm({
                title: game.i18n.localize("A-OMEGA.HiddenItems.ConfirmDelete.Title"),
                content: game.i18n.localize("A-OMEGA.HiddenItems.ConfirmDelete.Content"),
                yes: () => true,
                no: () => false,
                defaultYes: false
            });
            if (!confirmed) return;
            let hiddenData = foundry.utils.duplicate(HiddenItemsStorage.getHiddenItems(this.actor.id));
            delete hiddenData[itemId];
            await HiddenItemsStorage.setHiddenItems(this.actor.id, hiddenData);
            Hooks.callAll('hiddenItemsUpdated', this.actor.id, hiddenData);
            this.render(true, {keepId:true});
            ui.notifications.info(game.i18n.localize("A-OMEGA.HiddenItems.Notifications.ItemDeleted"));
        });

        $root.on('click.hiddenitems', '.clear-hidden-items-btn', async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            if (CONFIG.debug?.hiddenItems) console.log('[Hidden-Items][Popup] click .clear-hidden-items-btn');
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
            // S'il n'y a pas de parent, on laisse Foundry gérer
            return super.setPosition?.(options) ?? options;
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
            return super.setPosition?.({ left: targetLeft, top: targetTop }) ?? { left: targetLeft, top: targetTop };

        } else {
            // --- Logique de positionnement si la fiche parente n'est PAS minimisée (logique originale, à droite de la fiche agrandie) ---
            targetLeft = parentPos.left + parentPos.width + 20; // 20px à droite de la fiche agrandie
            targetTop = parentPos.top; // Aligner en haut avec la fiche agrandie

            if (CONFIG.debug?.hiddenItems) console.log(`[Hidden-Items] setPosition: Parent ${parentApp.appId} maximisé. Position calculée: {top: ${targetTop}, left: ${targetLeft}}`);

            // Applique la position calculée en fusionnant avec les options (utile lors du drag manuel de la popup agrandie)
            return super.setPosition?.({ left: targetLeft, top: targetTop, ...options }) ?? { left: targetLeft, top: targetTop, ...options };
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
