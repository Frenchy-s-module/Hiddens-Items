class HiddenItemsManager {
    static ID = 'Hidden_Items';
    
    static FLAGS = {
        HIDDEN_ITEMS: 'hiddenItems'
    };

    static initialize() {
        Hooks.once('init', () => {
            game.modules.get(this.ID).api = {
                hideItem: this.hideItem.bind(this),
                showItem: this.showItem.bind(this),
                toggleItemVisibility: this.toggleItemVisibility.bind(this),
                isItemHidden: this.isItemHidden.bind(this),
                clearHiddenItems: this.clearHiddenItems.bind(this)
            };
        });

        // Ajouter un bouton dans la fiche de personnage
        Hooks.on('renderActorSheet', (app, html, data) => {
            if (!game.user.isGM) return;

            // Récupérer les items cachés
            const hiddenItems = app.actor.getFlag(this.ID, this.FLAGS.HIDDEN_ITEMS) || {};
            
            // Nettoyer les anciens boutons s'ils existent
            html.find('.item-toggle[data-module="hidden-items"]').remove();
            
            // Ajouter les boutons pour les items visibles
            // Utiliser des sélecteurs plus larges pour couvrir tous les systèmes
            const itemSelectors = [
                '.item',
                '.item-list .item',
                '.inventory-list .item',
                '.items-list .item',
                '[data-item-id]',
                '.inventory .item',
                '.gear-list .item',
                '.equipment-list .item',
                '.inventory-item',
                '.sheet-item'
            ];

            const processedItems = new Set(); // Pour éviter les doublons
            const items = html.find(itemSelectors.join(', '));
            
            items.each((i, item) => {
                const $item = $(item);
                // Chercher l'ID de l'item de différentes manières
                const itemId = item.dataset.itemId || 
                             item.dataset.documentId || 
                             $item.closest('[data-item-id]').data('item-id') ||
                             $item.find('[data-item-id]').data('item-id') ||
                             $item.attr('data-id') ||
                             $item.find('[data-id]').attr('data-id');

                if (!itemId || processedItems.has(itemId)) return;
                processedItems.add(itemId);

                // Chercher ou créer la zone de contrôles
                let controls = $item.find('.item-controls, .item-buttons, .item-actions, .actions').first();
                if (controls.length === 0) {
                    // Si pas de zone de contrôles, en créer une
                    controls = $('<div class="item-controls"></div>');
                    // Chercher un endroit approprié pour l'insérer
                    const name = $item.find('.item-name, .name, .header-name, .item-header, .title').first();
                    if (name.length > 0) {
                        name.after(controls);
                    } else {
                        $item.append(controls);
                    }
                }

                // Vérifier si le bouton existe déjà
                if (controls.find('.item-toggle[data-module="hidden-items"]').length === 0) {
                    const toggleBtn = $(`<a class="item-control item-toggle" data-module="hidden-items" title="${hiddenItems[itemId] ? "Afficher l'objet" : "Cacher l'objet"}"><i class="fas ${hiddenItems[itemId] ? 'fa-eye-slash' : 'fa-eye'}"></i></a>`);
                    toggleBtn.click(async (event) => {
                        event.preventDefault();
                        await this.toggleItemVisibility(app.actor, itemId);
                    });
                    controls.prepend(toggleBtn);
                }
            });

            // Ajouter une section pour les items cachés (visible uniquement par le MJ)
            if (Object.keys(hiddenItems).length > 0) {
                const hiddenSection = $(`
                    <div class="hidden-items-section">
                        <h3>
                            <span>${game.i18n.localize("A-OMEGA.HiddenItems.Title")}</span>
                            <button class="clear-hidden-items">
                                <i class="fas fa-trash"></i>
                                <span>${game.i18n.localize("A-OMEGA.HiddenItems.ClearList")}</span>
                            </button>
                        </h3>
                        <div class="item-list"></div>
                    </div>
                `);

                const hiddenList = hiddenSection.find('.item-list');
                
                // Ajouter le gestionnaire d'événements pour le bouton d'effacement
                hiddenSection.find('.clear-hidden-items').click(async (event) => {
                    event.preventDefault();
                    await this.clearHiddenItems(app.actor);
                });
                
                for (const [itemId, itemData] of Object.entries(hiddenItems)) {
                    const item = $(`
                        <div class="item hidden-item" data-item-id="${itemId}">
                            <div class="item-name">${itemData.name}</div>
                            <div class="item-controls">
                                <a class="item-control item-toggle" data-module="hidden-items" title="Afficher l'objet"><i class="fas fa-eye-slash"></i></a>
                            </div>
                        </div>
                    `);

                    item.find('.item-toggle').click(async (event) => {
                        event.preventDefault();
                        await this.toggleItemVisibility(app.actor, itemId);
                    });

                    hiddenList.append(item);
                }

                // Essayer plusieurs emplacements pour insérer la section des items cachés
                const possibleContainers = [
                    '.inventory-list',
                    '.items-list',
                    '.tab.inventory',
                    '.tab.items',
                    '.inventory',
                    '.equipment',
                    '.gear',
                    '.possessions',
                    '.sheet-body',
                    '.sheet-content',
                    '.actor-body',
                    '.actor-content',
                    '[data-tab="items"]',
                    '[data-tab="inventory"]',
                    '[data-tab="gear"]',
                    '.window-content .tab.active',
                    '.window-content'
                ];

                let inserted = false;
                for (const selector of possibleContainers) {
                    const container = html.find(selector).first();
                    if (container.length > 0) {
                        // Vérifier si le conteneur est visible
                        if (container.is(':visible') || container.css('display') !== 'none') {
                            container.append(hiddenSection);
                            inserted = true;
                            break;
                        }
                    }
                }

                // Si aucun conteneur n'a été trouvé ou si tous sont cachés, ajouter à la fin du contenu
                if (!inserted) {
                    const windowContent = html.find('.window-content');
                    if (windowContent.length > 0) {
                        // Créer un nouveau conteneur pour les objets cachés
                        const newContainer = $('<div class="inventory-container"></div>');
                        newContainer.append(hiddenSection);
                        windowContent.append(newContainer);
                    }
                }
            }
        });
    }

    static async hideItem(actor, itemId) {
        if (!game.user.isGM) return;
        
        const item = actor.items.get(itemId);
        if (!item) return;

        // Vérifier si l'item est déjà caché
        const hiddenItems = actor.getFlag(this.ID, this.FLAGS.HIDDEN_ITEMS) || {};
        if (hiddenItems[itemId]) {
            console.log("Cet objet est déjà caché:", item.name);
            ui.notifications.warn(game.i18n.format("A-OMEGA.HiddenItems.Notifications.AlreadyHidden", {itemName: item.name}));
            return;
        }

        // Sauvegarder l'item dans les flags avant de le supprimer
        hiddenItems[itemId] = item.toObject();

        // Mettre à jour les flags
        await actor.setFlag(this.ID, this.FLAGS.HIDDEN_ITEMS, hiddenItems);

        // Supprimer l'item de l'inventaire
        await item.delete();

        // Rafraîchir la fiche
        actor.sheet.render(true);
    }

    static async showItem(actor, itemId) {
        if (!game.user.isGM) return;

        // Récupérer les items cachés
        const hiddenItems = actor.getFlag(this.ID, this.FLAGS.HIDDEN_ITEMS) || {};
        console.log("Items cachés avant showItem:", hiddenItems);
        const itemData = hiddenItems[itemId];

        if (itemData) {
            console.log("Tentative d'affichage de l'item:", itemId);
            
            // Créer l'item dans l'inventaire
            await actor.createEmbeddedDocuments('Item', [itemData]);

            // Supprimer l'item de la liste des items cachés
            const updatedHiddenItems = { ...hiddenItems };
            delete updatedHiddenItems[itemId];
            
            console.log("Items cachés après suppression:", updatedHiddenItems);
            
            // Mettre à jour les flags avec la nouvelle liste
            await actor.unsetFlag(this.ID, this.FLAGS.HIDDEN_ITEMS);
            await actor.setFlag(this.ID, this.FLAGS.HIDDEN_ITEMS, updatedHiddenItems);

            // Rafraîchir la fiche
            actor.sheet.render(true);
        } else {
            console.log("Item non trouvé dans les items cachés:", itemId);
        }
    }

    static async toggleItemVisibility(actor, itemId) {
        if (!game.user.isGM) return;

        const hiddenItems = actor.getFlag(this.ID, this.FLAGS.HIDDEN_ITEMS) || {};
        console.log("Toggle - Items cachés actuels:", hiddenItems);
        console.log("Toggle - ItemId à traiter:", itemId);
        
        if (hiddenItems[itemId]) {
            console.log("Toggle - L'item est caché, on va le montrer");
            await this.showItem(actor, itemId);
        } else {
            console.log("Toggle - L'item est visible, on va le cacher");
            await this.hideItem(actor, itemId);
        }
    }

    static async clearHiddenItems(actor) {
        if (!game.user.isGM) return;

        const hiddenItems = actor.getFlag(this.ID, this.FLAGS.HIDDEN_ITEMS) || {};
        
        // Demander confirmation
        const confirm = await Dialog.confirm({
            title: game.i18n.localize("A-OMEGA.HiddenItems.ConfirmClear.Title"),
            content: game.i18n.localize("A-OMEGA.HiddenItems.ConfirmClear.Content"),
            yes: () => true,
            no: () => false,
            defaultYes: false
        });

        if (!confirm) return;

        // Effacer la liste
        await actor.unsetFlag(this.ID, this.FLAGS.HIDDEN_ITEMS);
        
        // Rafraîchir la fiche
        actor.sheet.render(true);
        
        ui.notifications.info(game.i18n.localize("A-OMEGA.HiddenItems.Notifications.ListCleared"));
    }

    static isItemHidden(actor, itemId) {
        const hiddenItems = actor.getFlag(this.ID, this.FLAGS.HIDDEN_ITEMS) || {};
        return !!hiddenItems[itemId];
    }
}

Hooks.once('init', () => {
    HiddenItemsManager.initialize();
});