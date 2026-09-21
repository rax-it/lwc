/*
 * Copyright (c) 2024, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import {
    defineProperty,
    getOwnPropertyDescriptor,
    isFunction,
    isUndefined,
    KEY__SANITIZE_HTML_CONTENT,
} from '@lwc/shared';
import {
    NativeShadowRoot,
    nativeShadowRootInnerHTMLDescriptor,
    nativeShadowRootSetHTMLUnsafe,
} from '../../env/shadow-root';

// Read the hook off the global, not via import: this bundle's `@lwc/shared` never runs setHooks, so
// an imported reference constant-folds to a no-op. Resolved at call time so the flag can flip late.
function maybeSanitize(value: unknown): unknown {
    if (lwcRuntimeFlags.DISABLE_NATIVE_SHADOWROOT_SINK_SANITIZATION) {
        return value;
    }
    const sanitize = (globalThis as any)[KEY__SANITIZE_HTML_CONTENT];
    return isFunction(sanitize) ? sanitize(value) : value;
}

// Our wrappers install as non-configurable, so a non-configurable descriptor already means one is
// in place — use that as the idempotency signal instead of a separate marker property.
function isLocked(proto: object, name: string): boolean {
    const descriptor = getOwnPropertyDescriptor(proto, name);
    return !isUndefined(descriptor) && descriptor.configurable === false;
}

if (
    !isUndefined(nativeShadowRootInnerHTMLDescriptor) &&
    isFunction(nativeShadowRootInnerHTMLDescriptor.set) &&
    !isLocked(NativeShadowRoot.prototype, 'innerHTML')
) {
    const nativeInnerHTMLSetter = nativeShadowRootInnerHTMLDescriptor.set;
    defineProperty(NativeShadowRoot.prototype, 'innerHTML', {
        ...nativeShadowRootInnerHTMLDescriptor,
        configurable: false,
        set(this: ShadowRoot, value: unknown) {
            nativeInnerHTMLSetter.call(this, maybeSanitize(value));
        },
    });
}

if (
    isFunction(nativeShadowRootSetHTMLUnsafe) &&
    !isLocked(NativeShadowRoot.prototype, 'setHTMLUnsafe')
) {
    const nativeSetHTMLUnsafe = nativeShadowRootSetHTMLUnsafe;
    defineProperty(NativeShadowRoot.prototype, 'setHTMLUnsafe', {
        writable: false,
        enumerable: false,
        configurable: false,
        value(this: ShadowRoot, html: unknown) {
            return nativeSetHTMLUnsafe.call(this, maybeSanitize(html));
        },
    });
}
