/**
 * assets/gift-guide.js
 * ------------------------------------------------------------------
 * Shared vanilla JS for the custom Banner + Product Grid sections and
 * the shared popup component. No jQuery, per hard constraint §2 of
 * the build-context doc.
 *
 * Currently implemented:
 *  - initMobileHeaderToggle()  → Phase 1, banner.liquid's hamburger/X
 *  - initPopups()              → Phase 3, product-popup open/close
 *
 * Stubbed for later phases (left as named, empty-bodied functions so
 * the file's shape is stable and reviewable early — filled in during
 * Phase 4):
 *  - initVariantPickers()      → Phase 4
 *  - addToCart(variantId)      → Phase 4
 *  - maybeAddCrossSellItem()   → Phase 4 (Black + Medium → Soft Winter Jacket)
 */

document.addEventListener("DOMContentLoaded", function () {
    initMobileHeaderToggle();
    initPopups();
    initVariantPickers();
});

/**
 * Wires the mobile header's hamburger/X toggle (banner.liquid).
 * Toggling reveals the tagline + CHOOSE GIFT button inline below the
 * header row, per the confirmed mobile two-state header in §4a.
 */
function initMobileHeaderToggle() {
    document
        .querySelectorAll("[data-nav-toggle]")
        .forEach(function (toggleBtn) {
            var expandId = toggleBtn.getAttribute("aria-controls");
            if (!expandId) return;

            var expandEl = document.getElementById(expandId);
            if (!expandEl) return;

            const expandElConst = expandEl;

            toggleBtn.addEventListener("click", function () {
                var isOpen = toggleBtn.getAttribute("aria-expanded") === "true";
                toggleBtn.setAttribute("aria-expanded", String(!isOpen));
                expandElConst.setAttribute("data-expanded", String(!isOpen));
            });
        });
}

/**
 * Phase 3: open/close wiring for snippets/product-popup.liquid,
 * triggered by each grid tile's [data-popup-target] marker. Closes
 * on backdrop click, the "X" button, or Escape. Only ever one popup
 * open at a time.
 */
function initPopups() {
    document
        .querySelectorAll("[data-popup-target]")
        .forEach(function (trigger) {
            trigger.addEventListener("click", function () {
                var popupId = trigger.getAttribute("data-popup-target");
                if (!popupId) return;
                var popup = document.getElementById(popupId);
                if (popup) openPopup(popup);
            });
        });

    document.querySelectorAll("[data-popup-close]").forEach(function (closeEl) {
        closeEl.addEventListener("click", function () {
            var popup = closeEl.closest("[data-product-popup]");
            if (popup instanceof HTMLElement) closePopup(popup);
        });
    });

    document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") return;
        var openPopupEl = document.querySelector(
            "[data-product-popup]:not([hidden])",
        );
        if (openPopupEl instanceof HTMLElement) closePopup(openPopupEl);
    });
}

/**
 * @param {HTMLElement} popup
 */
function openPopup(popup) {
    popup.hidden = false;
    document.body.style.overflow = "hidden";
    var closeBtn = popup.querySelector(".product-popup__close");
    if (closeBtn instanceof HTMLElement) closeBtn.focus();
}

/**
 * @param {HTMLElement} popup
 */
function closePopup(popup) {
    popup.hidden = true;
    document.body.style.overflow = "";
}

/**
 * Phase 4: color/size selection on both the grid tile and popup,
 * resolving the matching variant from each product's embedded
 * [data-product-json] script tag.
 */
function initVariantPickers() {
    // TODO (Phase 4)
}

/**
 * Phase 4: POST a variant to Shopify's Ajax Cart API.
 * @param {number|string} variantId
 * @param {number} [quantity]
 * @returns {Promise<Response>}
 */
function addToCart(variantId, quantity) {
    quantity = quantity || 1;
    return fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: variantId, quantity: quantity }),
    });
}

/**
 * Phase 4: hidden cross-sell rule — if the option values just added
 * to cart are exactly Color: Black + Size: Medium, resolve and add
 * Soft Winter Jacket's (handle: dark-winter-jacket) matching
 * Black+Medium variant from its own embedded JSON. See build-context
 * doc §4b for why this is resolved dynamically rather than hardcoded.
 * @param {{color?: string, size?: string}} selectedOptions
 */
function maybeAddCrossSellItem(selectedOptions) {
    // TODO (Phase 4)
}
