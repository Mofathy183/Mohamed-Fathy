/**
 * assets/gift-guide.js
 * ------------------------------------------------------------------
 * Shared vanilla JS for the custom Banner + Product Grid sections and
 * the shared popup component. No jQuery, per hard constraint §2 of
 * the build-context doc.
 *
 * Currently implemented:
 *  - initMobileHeaderToggle()  → Phase 1, banner.liquid's hamburger/X
 *  - initPopups()              → Phase 3, product-popup open/close.
 *    Popups are image-anchored (absolute, inside each tile's own
 *    .product-grid__image-wrap) rather than a fixed full-screen
 *    modal — see the comment above initPopups() for what that
 *    changes about outside-click handling and scroll locking.
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
 * Open/close wiring for the centered modal popup.
 * Backdrop and the "X" both carry data-popup-close, so clicking
 * either one closes the popup — no separate outside-click detection
 * needed anymore now that it's a real fixed overlay.
 */

/**
 * Phase 3: open/close wiring for snippets/product-popup.liquid.
 *
 * ARCHITECTURE NOTE (image-anchored, not a viewport modal):
 * Each popup lives inside its own tile's .product-grid__image-wrap —
 * there is no shared backdrop element and nothing is appended to
 * <body>, so this file never scroll-locks the page the way a true
 * modal would. "Outside click" is therefore determined per-popup: a
 * click closes an open popup only if it landed outside that popup's
 * own .product-grid__image-wrap (i.e. outside both the popup and its
 * tile's image/hotspot), not just outside the popup element itself.
 *
 * Still only one popup open at a time: opening a new one closes any
 * other that's currently open, since Figma shows a single popup
 * state, not several stacked at once.
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

/** @param {HTMLElement} popup */
function openPopup(popup) {
    document
        .querySelectorAll("[data-product-popup]:not([hidden])")
        .forEach(function (otherPopup) {
            if (otherPopup instanceof HTMLElement && otherPopup !== popup) {
                closePopup(otherPopup);
            }
        });
    popup.hidden = false;
    document.body.style.overflow = "hidden";
    var closeBtn = popup.querySelector(".product-popup__close");
    if (closeBtn instanceof HTMLElement) closeBtn.focus();
}

/** @param {HTMLElement} popup */
function closePopup(popup) {
    popup.hidden = true;
    document.body.style.overflow = "";
}

/**
 * Color toggle + Size dropdown behavior, scoped per popup instance
 * via [data-variant-picker] so multiple tiles never cross-wire.
 */
function initVariantPickers() {
    document
        .querySelectorAll("[data-variant-picker]")
        .forEach(function (picker) {
            // Color: click sets aria-pressed on the clicked one, clears
            // siblings, and slides the shared highlight (see
            // .product-popup__color-highlight in gift-guide.css) to that
            // button's position via two CSS custom properties:
            //   --color-count → how many segments to divide the track into
            //   --color-index → which segment (0-based) to slide under
            // --color-count is set once up front from the actual number of
            // rendered swatches (not hardcoded to 2), so this still works
            // correctly if a product ever has more than two color values.
            var colorsWrapper = picker.querySelector(".product-popup__colors");
            var colorButtons = picker.querySelectorAll(
                ".product-popup__color-swatch",
            );

            if (colorsWrapper instanceof HTMLElement && colorButtons.length) {
                colorsWrapper.style.setProperty(
                    "--color-count",
                    String(colorButtons.length),
                );

                colorButtons.forEach(function (btn, index) {
                    btn.addEventListener("click", function () {
                        colorButtons.forEach(function (b) {
                            b.setAttribute("aria-pressed", String(b === btn));
                        });

                        // Nothing is selected until the first click (see
                        // product-popup.liquid — every button starts
                        // aria-pressed="false"); data-has-selection is what
                        // fades the highlight in the first time, after which
                        // only its position (--color-index) changes.
                        colorsWrapper.style.setProperty(
                            "--color-index",
                            String(index),
                        );
                        colorsWrapper.setAttribute(
                            "data-has-selection",
                            "true",
                        );

                        maybeEnableAddToCart(picker);
                    });
                });
            }

            // Size: custom listbox — mirrors the Color toggle's sliding
            // highlight (one shared element moved with --size-index),
            // plus the open/close + keyboard behavior a native <select>
            // gives for free (ArrowUp/Down to move, Enter to pick,
            // Escape to close), since this list is real markup
            // (ul[role=listbox] > li[role=option]) rather than a
            // native form control.
            var sizeDropdown = picker.querySelector("[data-size-dropdown]");
            var sizeToggle = picker.querySelector("[data-size-toggle]");
            var sizeOptionsWrap = picker.querySelector(
                "[data-size-options-wrap]",
            );
            var sizeList = picker.querySelector("[data-size-options]");

            if (
                sizeDropdown instanceof HTMLElement &&
                sizeToggle instanceof HTMLElement &&
                sizeOptionsWrap instanceof HTMLElement &&
                sizeList instanceof HTMLElement
            ) {
                const dropdown = sizeDropdown;
                const toggle = sizeToggle;
                const optionsWrap = sizeOptionsWrap;
                const summaryText = picker.querySelector(
                    "[data-size-summary-text]",
                );
                const placeholderText =
                    summaryText instanceof HTMLElement
                        ? summaryText.textContent
                        : "";
                const options = Array.prototype.slice.call(
                    sizeList.querySelectorAll(".product-popup__size-option"),
                );

                function isSizeListOpen() {
                    return dropdown.getAttribute("data-expanded") === "true";
                }

                // The options panel is `position: fixed` now (see
                // gift-guide.css for why — decouples it from
                // .product-popup__panel's own overflow-y so opening it
                // can never force the panel itself to scroll). A fixed
                // element can't be told "sit under the toggle" in CSS
                // alone, so its on-screen position is measured here and
                // written in as inline styles every time it opens, and
                // kept in sync while open in case the popup panel itself
                // scrolls or the window resizes underneath it.
                function positionSizeOptions() {
                    var rect = toggle.getBoundingClientRect();
                    optionsWrap.style.top = rect.bottom + "px";
                    optionsWrap.style.left = rect.left + "px";
                    optionsWrap.style.width = rect.width + "px";
                }

                // Roving tabindex: exactly one option is ever in the Tab
                // order (tabindex="0") — the one the shopper last landed
                // on via click or arrow key — everything else is "-1".
                // That's what lets ArrowUp/ArrowDown move focus between
                // plain <li> options the way a native <select>'s list
                // does, without every row being a separate Tab stop.
                function setActiveOption(option) {
                    options.forEach(function (o) {
                        o.setAttribute("tabindex", o === option ? "0" : "-1");
                    });
                }

                function openSizeList(focusOption) {
                    positionSizeOptions();
                    if (summaryText instanceof HTMLElement) {
                        summaryText.textContent = placeholderText;
                        summaryText.style.justifyContent = "left"
                    }
                    dropdown.setAttribute("data-expanded", "true");
                    toggle.setAttribute("aria-expanded", "true");
                    // Capture phase so this also fires for scroll events
                    // on .product-popup__panel itself, which don't bubble
                    // to window — capture-phase listeners still see them.
                    window.addEventListener("resize", positionSizeOptions);
                    window.addEventListener(
                        "scroll",
                        positionSizeOptions,
                        true,
                    );
                    if (focusOption instanceof HTMLElement) {
                        setActiveOption(focusOption);
                        focusOption.focus();
                    }
                }

                function closeSizeList(refocusToggle) {
                    if (summaryText instanceof HTMLElement) {
                        var selected = currentlySelectedOption();
                        summaryText.textContent = selected
                            ? selected.getAttribute("data-option-value") || placeholderText
                            : placeholderText;
                        summaryText.style.justifyContent = "center"
                    }
                    dropdown.setAttribute("data-expanded", "false");
                    toggle.setAttribute("aria-expanded", "false");
                    window.removeEventListener("resize", positionSizeOptions);
                    window.removeEventListener(
                        "scroll",
                        positionSizeOptions,
                        true,
                    );
                    if (refocusToggle) toggle.focus();
                }

                function currentlySelectedOption() {
                    return sizeList.querySelector(
                        '.product-popup__size-option[aria-selected="true"]',
                    );
                }

                function selectOption(option) {
                    var index =
                        Number(option.getAttribute("data-size-index")) || 0;

                    options.forEach(function (o) {
                        o.setAttribute("aria-selected", String(o === option));
                    });

                    // Slides the shared black highlight to this row (see
                    // .product-popup__size-highlight in gift-guide.css)
                    // and reveals it the first time a size is picked —
                    // same pattern as the Color toggle's --color-index.
                    optionsWrap.style.setProperty(
                        "--size-index",
                        String(index),
                    );
                    optionsWrap.setAttribute("data-has-selection", "true");

                    if (summaryText instanceof HTMLElement) {
                        summaryText.textContent =
                            option.getAttribute("data-option-value") || "";
                    }

                    setActiveOption(option);
                    closeSizeList(true);
                    maybeEnableAddToCart(picker);
                }

                toggle.addEventListener("click", function () {
                    if (isSizeListOpen()) {
                        closeSizeList(false);
                        return;
                    }
                    openSizeList(currentlySelectedOption() || options[0]);
                });

                toggle.addEventListener("keydown", function (event) {
                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        if (!isSizeListOpen()) {
                            openSizeList(
                                currentlySelectedOption() || options[0],
                            );
                        }
                    }
                });

                options.forEach(function (option, index) {
                    option.addEventListener("click", function () {
                        selectOption(option);
                    });

                    option.addEventListener("keydown", function (event) {
                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            var next =
                                options[index + 1] ||
                                options[options.length - 1];
                            setActiveOption(next);
                            next.focus();
                        } else if (event.key === "ArrowUp") {
                            event.preventDefault();
                            var prev = options[index - 1] || options[0];
                            setActiveOption(prev);
                            prev.focus();
                        } else if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectOption(option);
                        } else if (event.key === "Escape") {
                            // Closes just this dropdown, not the whole
                            // product popup — stopPropagation keeps the
                            // popup-level Escape handler in initPopups()
                            // from also treating this as "close the
                            // popup" in the same keystroke.
                            event.preventDefault();
                            event.stopPropagation();
                            closeSizeList(true);
                        }
                    });
                });

                // Click anywhere outside this dropdown closes it — the
                // list isn't a full-screen overlay with its own backdrop,
                // so this is scoped to "outside THIS dropdown" rather
                // than reusing the popup's own [data-popup-close] wiring.
                document.addEventListener("click", function (event) {
                    if (!isSizeListOpen()) return;
                    if (
                        event.target instanceof Node &&
                        !dropdown.contains(event.target)
                    ) {
                        closeSizeList(false);
                    }
                });
            }
        });
}

/**
 * Enables the Add to Cart button once both Color and Size (whichever
 * options actually exist for this product) have a selection. Variant
 * resolution + the actual /cart/add.js call is still Phase 4 work.
 * @param {Element} picker
 */
function maybeEnableAddToCart(picker) {
    var panel = picker.closest(".product-popup__panel");
    if (!panel) return;
    var addBtn = panel.querySelector("[data-add-to-cart]");
    if (!(addBtn instanceof HTMLElement)) return;

    var hasColor = picker.querySelector(".product-popup__color-swatch")
        ? true
        : false;
    var hasSize = picker.querySelector(".product-popup__size-option")
        ? true
        : false;

    var colorPicked =
        !hasColor ||
        !!picker.querySelector(
            '.product-popup__color-swatch[aria-pressed="true"]',
        );
    var sizePicked =
        !hasSize ||
        !!picker.querySelector(
            '.product-popup__size-option[aria-selected="true"]',
        );

    if (colorPicked && sizePicked) {
        addBtn.removeAttribute("disabled");
    } else {
        addBtn.setAttribute("disabled", "");
    }
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
