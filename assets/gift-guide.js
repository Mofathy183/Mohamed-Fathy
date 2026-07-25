import { CartLinesUpdateEvent } from "@shopify/events";

/**
 * assets/gift-guide.js
 * Shared vanilla JS for the Banner + Product Grid sections and the
 * popup component. No jQuery.
 *
 * Implements:
 *  - initMobileHeaderToggle() → banner.liquid's hamburger/X toggle
 *  - initPopups()             → product-popup open/close (image-anchored,
 *    not a fixed full-screen modal — see function comment for what that
 *    changes about outside-click handling)
 *  - initVariantPickers()     → Color toggle + Size listbox, and gating
 *    Add to Cart's enabled state
 *  - initAddToCart()          → resolves the selected variant, POSTs to
 *    /cart/add.js, runs maybeAddCrossSellItem(), shows success/error
 *    feedback on the button
 *  - resolveVariant() / maybeAddCrossSellItem() → variant matching +
 *    the Black+Medium → Soft Winter Jacket hidden rule
 */

document.addEventListener("DOMContentLoaded", function () {
    initMobileHeaderToggle();
    initPopups();
    initVariantPickers();
    initAddToCart();
});

/**
 * Wires the mobile header's hamburger/X toggle. Toggling reveals the
 * tagline + CHOOSE GIFT button inline below the header row.
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
 * Open/close wiring for snippets/product-popup.liquid — a real fixed
 * overlay with its own backdrop, so both the backdrop and the "X"
 * (both carry data-popup-close) close it. Only one popup is ever open
 * at a time: opening a new one closes any other that's open.
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
 * Color toggle + Size dropdown behavior, scoped per popup instance via
 * [data-variant-picker] so multiple tiles never cross-wire.
 */
function initVariantPickers() {
    document
        .querySelectorAll("[data-variant-picker]")
        .forEach(function (picker) {
            // Color: click sets aria-pressed on the clicked button, clears
            // siblings, and slides the shared highlight to that button's
            // position via --color-index. --color-count is set from the
            // actual number of rendered swatches (not hardcoded to 2).
            /** @type {HTMLElement|null} */
            var colorsWrapper = picker.querySelector(".product-popup__colors");
            var colorButtons = picker.querySelectorAll(
                ".product-popup__color-swatch",
            );

            if (colorsWrapper instanceof HTMLElement && colorButtons.length) {
                const colorsWrapperEl = colorsWrapper;

                colorsWrapperEl.style.setProperty(
                    "--color-count",
                    String(colorButtons.length),
                );

                colorButtons.forEach(function (btn, index) {
                    btn.addEventListener("click", function () {
                        colorButtons.forEach(function (b) {
                            b.setAttribute("aria-pressed", String(b === btn));
                        });

                        colorsWrapperEl.style.setProperty(
                            "--color-index",
                            String(index),
                        );
                        colorsWrapperEl.setAttribute(
                            "data-has-selection",
                            "true",
                        );

                        maybeEnableAddToCart(picker);
                    });
                });
            }

            // Size: custom listbox — mirrors the Color toggle's sliding
            // highlight, plus the keyboard behavior a native <select>
            // gives for free (ArrowUp/Down, Enter, Escape), since this is
            // real markup (ul[role=listbox] > li[role=option]).
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
                const list = sizeList;
                const summaryText = picker.querySelector(
                    "[data-size-summary-text]",
                );
                const placeholderText =
                    summaryText instanceof HTMLElement
                        ? summaryText.textContent
                        : "";
                /** @type {HTMLElement[]} */
                const options = Array.prototype.slice.call(
                    list.querySelectorAll(".product-popup__size-option"),
                );

                function isSizeListOpen() {
                    return dropdown.getAttribute("data-expanded") === "true";
                }

                // The options panel is `position: fixed` (see gift-guide.css
                // for why), so it can't be told "sit under the toggle" via
                // CSS alone — its position is measured and written in as
                // inline styles every time it opens, and kept in sync while
                // open in case the panel scrolls or the window resizes.
                function positionSizeOptions() {
                    var rect = toggle.getBoundingClientRect();
                    optionsWrap.style.top = rect.bottom + "px";
                    optionsWrap.style.left = rect.left + "px";
                    optionsWrap.style.width = rect.width + "px";
                }

                // Roving tabindex: only the last-focused option is a Tab
                // stop, letting ArrowUp/ArrowDown move focus between plain
                // <li> options the way a native <select>'s list does.
                /** @param {Element} option */
                function setActiveOption(option) {
                    options.forEach(function (o) {
                        o.setAttribute("tabindex", o === option ? "0" : "-1");
                    });
                }

                /** @param {Element} [focusOption] */
                function openSizeList(focusOption) {
                    positionSizeOptions();
                    if (summaryText instanceof HTMLElement) {
                        summaryText.textContent = placeholderText;
                        summaryText.style.justifyContent = "left";
                    }
                    dropdown.setAttribute("data-expanded", "true");
                    toggle.setAttribute("aria-expanded", "true");
                    // Capture phase so this also fires for scroll on
                    // .product-popup__panel itself, which doesn't bubble.
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

                /** @param {boolean} refocusToggle */
                function closeSizeList(refocusToggle) {
                    if (summaryText instanceof HTMLElement) {
                        var selected = currentlySelectedOption();
                        summaryText.textContent = selected
                            ? selected.getAttribute("data-option-value") ||
                              placeholderText
                            : placeholderText;
                        summaryText.style.justifyContent = "center";
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
                    return list.querySelector(
                        '.product-popup__size-option[aria-selected="true"]',
                    );
                }

                /** @param {Element} option */
                function selectOption(option) {
                    var index =
                        Number(option.getAttribute("data-size-index")) || 0;

                    options.forEach(function (o) {
                        o.setAttribute("aria-selected", String(o === option));
                    });

                    // Slides the shared highlight to this row and reveals
                    // it the first time a size is picked.
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

                toggle.addEventListener(
                    "keydown",
                    /** @param {KeyboardEvent} event */ function (event) {
                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            if (!isSizeListOpen()) {
                                openSizeList(
                                    currentlySelectedOption() || options[0],
                                );
                            }
                        }
                    },
                );

                options.forEach(function (option, index) {
                    option.addEventListener("click", function () {
                        selectOption(option);
                    });

                    option.addEventListener(
                        "keydown",
                        /** @param {KeyboardEvent} event */ function (event) {
                            if (event.key === "ArrowDown") {
                                event.preventDefault();
                                var next =
                                    options[index + 1] ||
                                    options[options.length - 1];
                                if (!next) return;
                                setActiveOption(next);
                                next.focus();
                            } else if (event.key === "ArrowUp") {
                                event.preventDefault();
                                var prev = options[index - 1] || options[0];
                                if (!prev) return;
                                setActiveOption(prev);
                                prev.focus();
                            } else if (
                                event.key === "Enter" ||
                                event.key === " "
                            ) {
                                event.preventDefault();
                                selectOption(option);
                            } else if (event.key === "Escape") {
                                // Closes just this dropdown, not the whole
                                // popup — stopPropagation prevents the
                                // popup-level Escape handler from also
                                // firing on the same keystroke.
                                event.preventDefault();
                                event.stopPropagation();
                                closeSizeList(true);
                            }
                        },
                    );
                });

                // Click outside this dropdown closes it.
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
 * Enables Add to Cart once every option this product actually has
 * (Color and/or Size) has a selection.
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

/** Handle of the seeded cross-sell product (deliberately excluded from the visible grid). */
var CROSS_SELL_HANDLE = "dark-winter-jacket";

/**
 * Parses the JSON payload out of a <script type="application/json">
 * tag matched by `selector`. Returns null on any failure so callers
 * can treat "no data" and "bad data" the same way.
 * @param {string} selector
 * @returns {any|null}
 */
function parseJsonScript(selector) {
    var el = document.querySelector(selector);
    if (!(el instanceof HTMLElement)) return null;
    try {
        return JSON.parse(el.textContent || "");
    } catch (err) {
        return null;
    }
}

/**
 * Shape of one entry in `product.variants | json`, limited to the
 * fields this file touches. The Record<string, any> intersection adds
 * a string index signature so `variant["option" + n]` type-checks.
 * @typedef {{ id: number|string, option1?: string, option2?: string, option3?: string } & Record<string, any>} ShopifyVariant
 */

/**
 * Reads the currently selected Color/Size values from a popup, keyed
 * by each control's data-option-name.
 * @param {Element} picker
 * @returns {Object<string, string>}
 */
function getSelectedOptions(picker) {
    /** @type {Object<string, string>} */
    var selected = {};

    var colorBtn = picker.querySelector(
        '.product-popup__color-swatch[aria-pressed="true"]',
    );
    if (colorBtn) {
        var colorName = colorBtn.getAttribute("data-option-name");
        if (colorName) {
            selected[colorName] =
                colorBtn.getAttribute("data-option-value") || "";
        }
    }

    var sizeOption = picker.querySelector(
        '.product-popup__size-option[aria-selected="true"]',
    );
    if (sizeOption) {
        var sizeName = sizeOption.getAttribute("data-option-name");
        if (sizeName) {
            selected[sizeName] =
                sizeOption.getAttribute("data-option-value") || "";
        }
    }

    return selected;
}

/**
 * Resolves the variant whose option1/2/3 values match `selectedByName`,
 * using `optionsOrder` to map each named selection onto the right
 * optionN slot. Returns null if any option is still unselected, or no
 * variant matches.
 * @param {Array<ShopifyVariant>|null} variants
 * @param {Array<string>|null} optionsOrder
 * @param {Object<string, string>} selectedByName
 * @returns {ShopifyVariant|null}
 */
function resolveVariant(variants, optionsOrder, selectedByName) {
    if (!Array.isArray(variants) || !Array.isArray(optionsOrder)) return null;

    var orderedValues = optionsOrder.map(function (name) {
        return selectedByName[name];
    });

    if (
        orderedValues.some(function (value) {
            return !value;
        })
    )
        return null;

    /** @type {ShopifyVariant|null} */
    var match = null;
    variants.some(function (variant) {
        var isMatch = orderedValues.every(function (value, index) {
            return variant["option" + (index + 1)] === value;
        });
        if (isMatch) match = variant;
        return isMatch;
    });

    return match;
}

/**
 * POSTs one or more variants to /cart/add.js sequentially (needed for the
 * Black+Medium cross-sell, which is two adds), then fetches the fresh
 * /cart.js snapshot once at the end.
 * @param {Array<{id:number|string, quantity:number}>} items
 * @returns {Promise<any>} the raw /cart.js AJAX cart response
 */
async function postCartAdds(items) {
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var response = await fetch("/cart/add.js", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: item?.id,
                quantity: item?.quantity || 1,
            }),
        });
        if (!response.ok) throw new Error("add.js request failed");
    }

    var cartResponse = await fetch("/cart.js");
    return cartResponse.json();
}

/**
 * Resolves Soft Winter Jacket's Black+Medium variant if the just-selected
 * options are exactly Color: Black + Size: Medium. Returns null otherwise
 * or if no match is found — caller decides what to do with null.
 * @param {Object<string, string>} selectedOptions
 * @returns {ShopifyVariant|null}
 */
function resolveCrossSellVariant(selectedOptions) {
    var isTriggerCombo =
        selectedOptions.Color === "Black" && selectedOptions.Size === "Medium";
    if (!isTriggerCombo) return null;

    var jacketVariants = parseJsonScript(
        '[data-cross-sell-variants="' + CROSS_SELL_HANDLE + '"]',
    );
    var jacketOptionsOrder = parseJsonScript(
        '[data-cross-sell-options="' + CROSS_SELL_HANDLE + '"]',
    );
    return resolveVariant(jacketVariants, jacketOptionsOrder, {
        Color: "Black",
        Size: "Medium",
    });
}

/**
 * Wires every popup's "ADD TO CART" button: resolves the selected
 * variant from that product's embedded JSON, POSTs it, chains the
 * hidden cross-sell check, then shows success/error feedback on the
 * button itself.
 */
function initAddToCart() {
    document
        .querySelectorAll("[data-variant-picker]")
        .forEach(function (picker) {
            var panel = picker.closest(".product-popup__panel");
            var popup = panel && panel.closest("[data-product-popup]");
            var addBtn = panel && panel.querySelector("[data-add-to-cart]");

            if (
                !(popup instanceof HTMLElement) ||
                !(addBtn instanceof HTMLElement)
            ) {
                return;
            }

            const popupEl = popup;
            const addToCartBtn = addBtn;

            var productId = popupEl.getAttribute("data-product-id");
            if (!productId) return;

            // Preserve the original label/icon markup so feedback states
            // can restore it exactly.
            var originalHtml = addToCartBtn.innerHTML;
            /** @type {number|null} */
            var feedbackTimer = null;

            /**
             * @param {string} message
             * @param {boolean} isError
             */
            function showFeedback(message, isError) {
                if (feedbackTimer) window.clearTimeout(feedbackTimer);
                addToCartBtn.textContent = message;
                addToCartBtn.classList.toggle(
                    "product-popup__add-to-cart--error",
                    !!isError,
                );
                feedbackTimer = window.setTimeout(function () {
                    addToCartBtn.innerHTML = originalHtml;
                    addToCartBtn.classList.remove(
                        "product-popup__add-to-cart--error",
                    );
                    maybeEnableAddToCart(picker);
                }, 1800);
            }

            addToCartBtn.addEventListener("click", function () {
                if (addToCartBtn.hasAttribute("disabled")) return;

                var variants = parseJsonScript(
                    '[data-product-json="' + productId + '"]',
                );
                var optionsOrder = parseJsonScript(
                    '[data-product-options="' + productId + '"]',
                );
                var selected = getSelectedOptions(picker);
                var variant = resolveVariant(variants, optionsOrder, selected);

                if (!variant) {
                    showFeedback("No matching variant", true);
                    return;
                }

                var itemsToAdd = [{ id: variant.id, quantity: 1 }];
                var jacketVariant = resolveCrossSellVariant(selected);
                if (jacketVariant)
                    itemsToAdd.push({ id: jacketVariant.id, quantity: 1 });

                addToCartBtn.setAttribute("disabled", "");
                addToCartBtn.textContent = "Adding…";

                // Dispatch immediately with a pending promise — cart-icon.js and
                // cart-drawer.js (both listen on document) update themselves once it
                // resolves. This is the theme's own update mechanism; no manual DOM
                // patching or extra fetches needed on our end beyond the adds below.
                var resultPromise = postCartAdds(itemsToAdd).then(
                    function (ajaxCart) {
                        return {
                            cart: CartLinesUpdateEvent.createCartFromAjaxResponse(
                                ajaxCart,
                            ),
                        };
                    },
                );

                document.dispatchEvent(
                    new CartLinesUpdateEvent({
                        action: "add",
                        context: "dialog",
                        lines: itemsToAdd.map(function (item) {
                            return {
                                merchandiseId: item.id,
                                quantity: item.quantity,
                            };
                        }),
                        promise: resultPromise,
                    }),
                );

                resultPromise
                    .then(function () {
                        showFeedback("Added!", false);
                    })
                    .catch(function () {
                        showFeedback("Couldn't add — try again", true);
                    });
            });
        });
}
