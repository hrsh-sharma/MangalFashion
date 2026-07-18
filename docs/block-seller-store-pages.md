# Blocking Seller-Store Pages (Redirect to Home)

This document explains how we disabled the **seller-store detail pages**
(e.g. `/seller/store/rapportmart`) so they redirect to the homepage instead of
showing a third-party seller's storefront. Use it to replicate the same change
on another website built on the same FastKart / Angular codebase.

---

## 1. Background — what the problem is

FastKart is a **multi-vendor** e-commerce template. Out of the box it ships a
"seller" feature with these public routes:

| URL | Purpose |
|-----|---------|
| `/seller/store/:slug` | A single seller's storefront (the page we want to block) |
| `/seller/stores` | A listing of all seller stores |
| `/seller/become-seller` | "Become a seller" page |

On a **single-brand** store these pages pull in other sellers' branding,
contact details, and products — which looks like "another website" inside your
own site. The goal is to make `/seller/store/<anything>` never render and send
the visitor to the homepage instead.

---

## 2. Where the route lives

The seller routes are defined in the **shop routing module**:

```
src/app/components/shop/shop-routing.module.ts
```

The relevant (original) entry looks like this:

```ts
{
  path: 'seller/store/:slug',
  component: SellerDetailsComponent,
  resolve: {
    data: StoreResolver
  }
},
```

> Tip for locating it on another project: search the codebase for
> `seller/store` or `seller/store/:slug`. In this template it's always in
> `shop-routing.module.ts`.

### How the URL maps

- The shop module is lazy-loaded at the **root path** (`path: ""`), so
  `seller/store/:slug` resolves to the full URL `/seller/store/:slug`.
  (See `src/app/shared/routes/routes.ts` — the `ShopModule` entry has `path: ""`.)
- The **homepage** is also the empty path (`path: ""` → `ThemesModule`), so the
  app root `/` *is* the home page. That's why we redirect to `/`.

---

## 3. The change

Replace the `seller/store/:slug` route with a redirect to the app root.

**Before:**

```ts
{
  path: 'seller/store/:slug',
  component: SellerDetailsComponent,
  resolve: {
    data: StoreResolver
  }
},
```

**After:**

```ts
{
  // Seller store detail pages are disabled. Any /seller/store/:slug URL
  // (e.g. /seller/store/rapportmart) redirects to home so third-party
  // seller storefronts are never shown.
  path: 'seller/store/:slug',
  redirectTo: '/',
  pathMatch: 'full',
},
```

### Clean up the now-unused imports

After the change, two imports in `shop-routing.module.ts` are no longer used.
Remove them so the file stays clean:

```ts
// remove this line:
import { StoreResolver } from '../../shared/resolvers/store.resolver';

// remove this line:
import { SellerDetailsComponent } from './seller/seller-details/seller-details.component';
```

> ⚠️ Before deleting an import, confirm it isn't used by another route in the
> same file. In this template `StoreResolver` and `SellerDetailsComponent` are
> used **only** by the seller-store route, so they're safe to remove.
> `SellerDetailsComponent` is still declared in `shop.module.ts`, which is fine —
> it just becomes unreachable.

That's the entire change — **one file edited.**

---

## 4. Variations (optional)

### A) Show a 404 "Page Not Found" instead of redirecting home

This template already has a `/404` page. To make the seller URL look like it
doesn't exist:

```ts
{
  path: 'seller/store/:slug',
  redirectTo: '/404',
  pathMatch: 'full',
},
```

### B) Block the entire seller feature (listing + become-seller too)

Also redirect the other two seller routes in the same file:

```ts
{ path: 'seller/become-seller', redirectTo: '/', pathMatch: 'full' },
{ path: 'seller/stores',        redirectTo: '/', pathMatch: 'full' },
{ path: 'seller/store/:slug',   redirectTo: '/', pathMatch: 'full' },
```

If you do this, also remove/hide any **links** that point to these pages
(navigation menu, footer, breadcrumbs) so users can't click into them. Search
the codebase for `seller/stores`, `seller/store`, and `become-seller` in
`.html` files to find them.

---

## 5. Verify it works

1. Make sure the dev server is running: `npm start`
   (the app serves at `http://localhost:4200/`).
2. The Angular dev server uses **watch mode**, so saving the file triggers an
   automatic rebuild + browser reload. Confirm the terminal shows
   `Application bundle generation complete` / `Page reload sent to client(s)`
   with **no `✘ [ERROR]` lines**. (Harmless `NG8107` optional-chain *warnings*
   are pre-existing and can be ignored.)
3. In the browser, open `http://localhost:4200/seller/store/rapportmart`
   (do a hard refresh). You should land on the **homepage**.
4. Try another slug, e.g. `/seller/store/anything` — it should also redirect
   to home.

---

## 6. Why `redirectTo: '/'` (and not `''`)

In a lazy-loaded child module, a **relative** `redirectTo: ''` is resolved
against the route's parent and can behave unexpectedly. A **leading slash**
(`'/'`) is an **absolute** redirect from the application root, which reliably
lands on the homepage regardless of where the route is declared. That's why we
use `redirectTo: '/'`.

---

## Summary

| | |
|---|---|
| **File changed** | `src/app/components/shop/shop-routing.module.ts` |
| **Edit** | `seller/store/:slug` route → `redirectTo: '/'` + `pathMatch: 'full'` |
| **Cleanup** | Removed unused `SellerDetailsComponent` and `StoreResolver` imports |
| **Result** | Every `/seller/store/...` URL now redirects to the homepage |
