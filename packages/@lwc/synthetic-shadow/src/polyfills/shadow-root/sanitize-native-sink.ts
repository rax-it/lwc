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

// Read from the global instead of importing `sanitizeHtmlContent`: this bundle's own `@lwc/shared`
// copy never runs `setHooks`, so a bundler constant-folds the imported hook to a no-op.
function maybeSanitize(value: unknown): unknown {
    const sanitize = (globalThis as any)[KEY__SANITIZE_HTML_CONTENT];
    return isFunction(sanitize) ? sanitize(value) : value;
}

// Idempotency without a forgeable global flag: the wrappers are installed non-configurable, so a
// prototype whose sink descriptor is already non-configurable has been patched (by us, or a prior
// synthetic-shadow copy) — re-defining would throw, so skip. This reads the real descriptor rather
// than a global marker, so sandboxed code can't fake "already patched" to skip protection; the only
// way to make the descriptor non-configurable is to actually lock it, which is what we want anyway.
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
