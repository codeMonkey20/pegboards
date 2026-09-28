<!-- BEGIN:nextjs-agent-rules -->

# CLAUDE.md

## Project Overview

This project uses:

* **Next.js with the Pages Router**
* **React**
* **JavaScript only** — do not introduce TypeScript
* **Tailwind CSS** for styling
* **JSDoc** for documentation and type information
* ESLint for code quality

The goal is to maintain code that is simple, readable, maintainable, accessible, performant, and consistent with the existing Next.js project architecture.

---

# General Development Rules

## JavaScript Only

This project uses JavaScript.

### Do

* Use `.js` and `.jsx` files.
* Use JSDoc for type information.
* Use modern JavaScript syntax.
* Use object destructuring where it improves readability.
* Use optional chaining when appropriate.
* Use nullish coalescing when appropriate.

### Do Not

* Create `.ts` or `.tsx` files.
* Add TypeScript configuration for new code.
* Use TypeScript interfaces or types.
* Use TypeScript-specific syntax.

Example:

```jsx
/**
 * Displays a product card.
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @returns {JSX.Element}
 */
export default function Card({ title, description }) {
    return (
        <article>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
        </article>
    );
}
```

---

# JSDoc Standards

JSDoc is required for reusable functions, components, hooks, API functions, and non-obvious data structures.

Use JSDoc to provide useful information, not unnecessary comments.

## Components

Document component props.

```jsx
/**
 * Displays a product card.
 *
 * @param {Object} props
 * @param {string} props.name - Product name.
 * @param {number} props.price - Product price.
 * @param {string} [props.image] - Optional product image.
 * @returns {JSX.Element}
 */
export default function ProductCard({ name, price, image }) {
    // ...
}
```

## Functions

Document parameters and return values.

```js
/**
 * Formats a price for display.
 *
 * @param {number} amount
 * @param {string} [currency='USD']
 * @returns {string}
 */
export function formatPrice(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
    }).format(amount);
}
```

## Complex Objects

Use `@typedef` when an object has multiple properties and is reused.

```js
/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {number} price
 * @property {string} [description]
 * @property {string} [image]
 */
```

Then:

```js
/**
 * @param {Product} product
 * @returns {JSX.Element}
 */
function ProductCard({ product }) {
    // ...
}
```

## Hooks

Document custom hooks.

```js
/**
 * Tracks the current viewport width.
 *
 * @returns {number}
 */
export function useViewportWidth() {
    // ...
}
```

## Avoid Useless Comments

Do not write comments that simply restate the code.

Bad:

```js
// Set the user name
const userName = user.name;
```

Good:

```js
// The API may return an empty name for legacy accounts.
const userName = user.name || 'Guest';
```

Comments should explain **why**, not simply **what**.

---

# Next.js Standards

## Pages Router

This project uses the **Next.js Pages Router**.

Use the existing `pages/` directory for application routes.

Typical structure:

```text
pages/
├── _app.js
├── _document.js
├── index.js
├── about.js
├── products/
│   ├── index.js
│   └── [id].js
└── api/
    └── products.js
```

Do not introduce an `app/` directory or migrate routes to the App Router unless explicitly requested.

Do not introduce App Router-specific conventions such as:

* `app/`
* `layout.js`
* `loading.js`
* `error.js`
* `not-found.js`
* `route.js`
* Server Components
* `generateMetadata`

unless the project is explicitly being migrated to the App Router.

---

# Pages

Pages should primarily handle:

* Page composition
* Data fetching
* Page-level metadata
* Routing concerns
* Passing data to components

Avoid placing large amounts of business logic directly inside page components.

Example:

```jsx
/**
 * Product page.
 *
 * @param {Object} props
 * @param {Object} props.product
 * @returns {JSX.Element}
 */
export default function ProductPage({ product }) {
    return (
        <main>
            <h1>{product.name}</h1>
        </main>
    );
}
```

---

# Data Fetching

Use the Pages Router data-fetching methods appropriate for the requirement.

## `getServerSideProps`

Use `getServerSideProps` when data must be fetched on every request.

```js
/**
 * Fetches product data for the page.
 *
 * @param {Object} context
 * @returns {Promise<Object>}
 */
export async function getServerSideProps(context) {
    const { id } = context.params;

    const product = await getProduct(id);

    if (!product) {
        return {
            notFound: true,
        };
    }

    return {
        props: {
            product,
        },
    };
}
```

## `getStaticProps`

Use `getStaticProps` when a page can be statically generated.

```js
/**
 * Fetches products at build time.
 *
 * @returns {Promise<Object>}
 */
export async function getStaticProps() {
    const products = await getProducts();

    return {
        props: {
            products,
        },
    };
}
```

## `getStaticPaths`

Use `getStaticPaths` for dynamic pages generated statically.

```js
/**
 * Defines the dynamic product pages to generate.
 *
 * @returns {Promise<Object>}
 */
export async function getStaticPaths() {
    const products = await getProducts();

    return {
        paths: products.map((product) => ({
            params: {
                id: product.id,
            },
        })),
        fallback: 'blocking',
    };
}
```

Choose the data-fetching method based on the actual caching and rendering requirements.

Do not use `getServerSideProps` by default when static generation is sufficient.

---

# Client-Side Data Fetching

Do not automatically use `useEffect` for every data-fetching requirement.

Prefer Next.js server-side data-fetching methods when the data can be fetched before rendering.

Use client-side fetching when the data genuinely depends on browser-side interaction or state.

For example:

* User interactions
* Filters
* Search
* Infinite scrolling
* Real-time updates
* Data that should not block the initial page render

---

# API Routes

The Pages Router uses API Routes under:

```text
pages/api/
```

Example:

```text
pages/api/products.js
```

Use API routes when an HTTP endpoint is required.

Example:

```js
/**
 * Handles product API requests.
 *
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);

        return res.status(405).json({
            message: 'Method not allowed',
        });
    }

    const products = await getProducts();

    return res.status(200).json(products);
}
```

Keep API route handlers focused on HTTP concerns.

Move complex business logic into reusable modules.

---

# Routing

Use the Pages Router file-based routing system.

Example:

```text
pages/
├── index.js
├── products/
│   ├── index.js
│   └── [id].js
└── blog/
    └── [slug].js
```

Use dynamic routes when appropriate:

```text
pages/products/[id].js
pages/blog/[slug].js
```

Do not manually implement routing when Next.js file-based routing already provides the required behavior.

---

# Navigation

Use Next.js `Link` for internal navigation.

Prefer:

```jsx
import Link from 'next/link';

<Link href="/products">
    Products
</Link>
```

For external websites, use normal anchors:

```jsx
<a
    href="https://example.com"
    target="_blank"
    rel="noreferrer"
>
    External Website
</a>
```

---

# Router

When client-side routing behavior is required, use the Pages Router API:

```js
import { useRouter } from 'next/router';
```

Do not use:

```js
import { useRouter } from 'next/navigation';
```

`next/navigation` is associated with the App Router and should not be introduced into this Pages Router project.

---

# Images

Use `next/image` for application images whenever practical.

```jsx
import Image from 'next/image';

<Image
    src={product.image}
    alt={product.name}
    width={400}
    height={400}
/>
```

Every meaningful image must have useful `alt` text.

Decorative images should use:

```jsx
alt=""
```

Do not use the image filename as alt text unless it is actually meaningful.

---

# SEO and Metadata

The Pages Router uses the `next/head` component for page-level metadata.

Example:

```jsx
import Head from 'next/head';

/**
 * @returns {JSX.Element}
 */
export default function ProductsPage() {
    return (
        <>
            <Head>
                <title>Products | Example</title>
                <meta
                    name="description"
                    content="Browse our products."
                />
            </Head>

            <main>
                <h1>Products</h1>
            </main>
        </>
    );
}
```

Use meaningful:

* Page titles
* Meta descriptions
* Canonical URLs where appropriate
* Open Graph metadata where appropriate
* Heading hierarchy

Do not keyword-stuff metadata.

---

# Custom App

Use `pages/_app.js` for application-wide concerns.

Typical responsibilities include:

* Global CSS
* Application providers
* Global layout
* Application-level state
* Analytics initialization when appropriate

Example:

```jsx
import '../styles/globals.css';

/**
 * Application root component.
 *
 * @param {Object} props
 * @param {JSX.Element} props.Component
 * @param {Object} props.pageProps
 * @returns {JSX.Element}
 */
export default function App({ Component, pageProps }) {
    return <Component {...pageProps} />;
}
```

Do not put page-specific logic into `_app.js`.

---

# Custom Document

Use `pages/_document.js` only for document-level HTML customization.

Examples:

* `<html>` attributes
* `<body>` attributes
* Custom document structure
* Server-rendered document configuration

Do not use `_document.js` for normal application logic or page-specific content.

---

# Error Pages

Use the Pages Router error conventions.

For custom 404 pages:

```text
pages/404.js
```

For custom 500 pages:

```text
pages/500.js
```

Do not create App Router `error.js` or `not-found.js` files.

---

# React Standards

## Functional Components

Use functional components.

Do not introduce class components for new code.

```jsx
/**
 * @returns {JSX.Element}
 */
export default function Button() {
    return (
        <button type="button">
            Click me
        </button>
    );
}
```

---

# Component Design

Components should have a single clear responsibility.

Prefer small composable components over very large components.

Avoid components that contain:

* Data fetching
* Complex business logic
* Large amounts of markup
* Multiple unrelated responsibilities

all in one file.

Recommended structure:

```text
components/
├── product/
│   ├── ProductCard.jsx
│   ├── ProductList.jsx
│   └── ProductPrice.jsx
└── ui/
    ├── Button.jsx
    ├── Modal.jsx
    └── Spinner.jsx
```

---

# Props

Pass only the data a component actually needs.

Prefer:

```jsx
<ProductCard
    name={product.name}
    price={product.price}
/>
```

over:

```jsx
<ProductCard product={product} />
```

unless the component genuinely needs the entire object.

---

# React Keys

Always use stable keys when rendering lists.

Good:

```jsx
{products.map((product) => (
    <ProductCard
        key={product.id}
        product={product}
    />
))}
```

Avoid:

```jsx
{products.map((product, index) => (
    <ProductCard
        key={index}
        product={product}
    />
))}
```

Do not use array indexes as keys unless the list is static and cannot change order.

---

# Hooks

Follow React Hooks rules.

Hooks must:

* Be called at the top level.
* Only be called from React components or custom hooks.
* Not be called conditionally.

Prefer derived values over unnecessary state.

Avoid:

```jsx
const [fullName, setFullName] = useState('');

useEffect(() => {
    setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);
```

Prefer:

```jsx
const fullName = `${firstName} ${lastName}`;
```

Do not use `useEffect` when normal JavaScript can solve the problem.

---

# State Management

Use the simplest state management solution that satisfies the requirement.

Preferred order:

1. Local component state
2. URL/query parameters
3. Server-side page data
4. React Context
5. Existing project state-management solution
6. New state-management library only when necessary

Do not introduce a global state library for simple local state.

---

# Tailwind CSS Standards

Tailwind CSS is the primary styling solution.

Do not introduce CSS files for component styling unless there is a specific reason.

Avoid inline styles:

```jsx
<div style={{ marginTop: 20 }}>
```

Prefer:

```jsx
<div className="mt-5">
```

---

# Tailwind Class Organization

Keep classes readable and logically organized.

Generally organize classes in this order:

1. Layout
2. Positioning
3. Sizing
4. Spacing
5. Typography
6. Colors
7. Borders
8. Effects
9. States
10. Responsive modifiers

Example:

```jsx
<button
    className="
        inline-flex
        items-center
        justify-center
        w-full
        px-4
        py-2
        text-sm
        font-medium
        text-white
        bg-blue-600
        rounded-md
        shadow-sm
        hover:bg-blue-700
        focus:outline-none
        focus:ring-2
        focus:ring-blue-500
        sm:w-auto
    "
>
    Submit
</button>
```

If the project has an automatic Tailwind class sorting tool, follow that tool's ordering instead.

---

# Avoid Excessive Tailwind Duplication

If the same long collection of classes appears repeatedly, consider extracting a reusable component.

Prefer:

```jsx
<Button variant="primary">
    Save
</Button>
```

when the project already has a reusable Button component.

Do not create abstractions solely to eliminate a few repeated classes.

---

# Conditional Classes

For simple conditions:

```jsx
className={isActive ? 'text-blue-600' : 'text-gray-500'}
```

For multiple conditions, use the project's existing class utility such as `clsx` or `cn` if available.

Example:

```jsx
className={cn(
    'rounded-md px-4 py-2',
    isActive && 'bg-blue-600 text-white',
    disabled && 'cursor-not-allowed opacity-50'
)}
```

Do not introduce a new class utility if the project already has one.

---

# Responsive Design

Use mobile-first Tailwind classes.

Prefer:

```jsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
```

Use responsive breakpoints only when the layout actually requires them.

Do not add responsive classes unnecessarily.

---

# Dark Mode

Follow the project's existing dark-mode strategy.

If dark mode is enabled, use Tailwind's dark variants consistently.

```jsx
<div className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
```

Do not introduce a second dark-mode implementation.

---

# Accessibility

Accessibility is required.

## Semantic HTML

Prefer semantic elements:

```html
<header>
<nav>
<main>
<section>
<article>
<footer>
<button>
<form>
<label>
```

Avoid:

```jsx
<div onClick={handleClick}>
```

when the element is actually a button.

Use:

```jsx
<button onClick={handleClick}>
```

---

# Forms

Every form control should have an accessible label.

Prefer:

```jsx
<label htmlFor="email">
    Email
</label>

<input
    id="email"
    name="email"
    type="email"
/>
```

Do not rely solely on placeholder text as a label.

---

# Buttons

Use `<button>` for actions.

Use `<Link>` for navigation.

Do not use clickable `<div>` elements.

Buttons should have meaningful accessible names.

---

# Keyboard Accessibility

Interactive elements must be usable with a keyboard.

Do not remove focus indicators without providing an accessible replacement.

---

# Color and Contrast

Do not rely on color alone to communicate information.

For example, error states should include text or another visual indicator in addition to a red color.

---

# Performance

Performance is a core requirement.

Prefer server-side rendering or static generation when appropriate.

Avoid unnecessary client-side JavaScript.

Do not add dependencies for functionality that can reasonably be implemented using existing project capabilities.

---

# React Rendering

Avoid unnecessary state updates and effects.

Do not memoize everything by default.

Use:

* `useMemo`
* `useCallback`
* `memo`

only when there is a demonstrated or reasonably expected performance benefit.

Do not use memoization simply because it is available.

---

# Dynamic Imports

Use Next.js dynamic imports when they meaningfully reduce the initial JavaScript bundle or when a component is expensive and not immediately required.

Example:

```js
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(
    () => import('@/components/HeavyComponent')
);
```

Do not dynamically import small components without a reason.

---

# API and Data Validation

Never blindly trust external data.

Validate data received from:

* APIs
* Forms
* URL parameters
* Query parameters
* Cookies
* Third-party services

Do not assume external data has the expected shape.

When a validation library is already installed, use the existing project convention.

---

# Security

Never expose secrets in client-side code.

Do not put private environment variables in:

```text
NEXT_PUBLIC_*
```

Anything prefixed with `NEXT_PUBLIC_` should be considered exposed to the browser.

Never hard-code:

* API keys
* Passwords
* Tokens
* Database credentials
* Private credentials

Use environment variables.

---

# Environment Variables

Use `.env.local` for local development secrets.

Do not commit secrets.

Document required variables in:

```text
.env.example
```

Example:

```env
DATABASE_URL=
API_URL=
NEXT_PUBLIC_SITE_URL=
```

Never put actual credentials in `.env.example`.

---

# Business Logic

Do not put substantial business logic directly inside JSX.

Bad:

```jsx
return (
    <div>
        {items
            .filter(...)
            .map(...)
            .sort(...)}
    </div>
);
```

For complex transformations, calculate the data separately.

```jsx
const availableItems = items
    .filter(isAvailable)
    .sort(sortByName);

return (
    <div>
        {availableItems.map(...)}
    </div>
);
```

For reusable business logic, move it into a utility or domain module.

---

# Utility Functions

Reusable utilities should live outside components.

Example:

```text
lib/
├── utils/
│   ├── formatPrice.js
│   ├── formatDate.js
│   └── validation.js
```

Document reusable utilities with JSDoc.

```js
/**
 * Converts a date into a human-readable format.
 *
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatDate(date) {
    // ...
}
```

---

# File Naming

Follow the existing project convention.

Recommended:

```text
components/
    ProductCard.jsx
    ProductList.jsx

lib/
    formatPrice.js
    getProducts.js

pages/
    index.js
    products/
        index.js
        [id].js
```

Do not rename existing files solely to enforce a different naming convention.

---

# Imports

Keep imports organized.

Generally:

1. Next.js / React imports
2. Third-party packages
3. Internal components
4. Internal utilities
5. Assets/styles

Example:

```jsx
import Image from 'next/image';
import Link from 'next/link';

import Button from '@/components/ui/Button';
import ProductPrice from '@/components/product/ProductPrice';

import { formatPrice } from '@/lib/utils/formatPrice';
```

Use configured path aliases when available.

Avoid deeply nested relative imports when an established alias exists.

---

# Error Handling

Errors should be handled intentionally.

Do not silently ignore errors.

Bad:

```js
try {
    await saveUser();
} catch {
}
```

Prefer:

```js
try {
    await saveUser();
} catch (error) {
    console.error('Failed to save user:', error);
    throw error;
}
```

Do not expose sensitive internal error details to users.

---

# Logging

Do not leave unnecessary debugging statements in production code.

Remove:

```js
console.log(data);
console.log('test');
debugger;
```

before completing a task unless the logging is intentionally part of the application.

When logging errors, provide enough context to diagnose the issue without exposing sensitive information.

---

# Dependency Management

Before adding a dependency:

1. Check whether the functionality already exists in the project.
2. Check whether Next.js, React, or the browser provides the functionality.
3. Check whether an existing dependency can solve the problem.
4. Only then add a new dependency if it provides meaningful value.

Do not add libraries for trivial functionality.

---

# Code Quality

Prioritize:

* Readability
* Simplicity
* Maintainability
* Accessibility
* Performance
* Consistency

Prefer straightforward code over clever code.

Avoid overly compressed expressions when they reduce readability.

Prefer explicit code when it makes the logic easier to understand.

---

# Avoid Premature Abstraction

Do not create abstractions before they are needed.

Three similar lines of code do not automatically require a utility.

Extract code when:

* It is reused.
* It has a clear responsibility.
* It makes the code significantly easier to understand.
* It represents meaningful domain logic.

---

# Existing Codebase Conventions

When modifying an existing project, inspect the existing code before introducing new patterns.

Follow existing conventions for:

* Folder structure
* Component organization
* Naming
* State management
* API handling
* Authentication
* Error handling
* Tailwind configuration
* Utility libraries
* Testing

Do not rewrite unrelated code simply to match personal preferences.

---

# Changes and Refactoring

Keep changes focused.

When implementing a feature:

* Change only what is necessary.
* Avoid unrelated refactoring.
* Avoid changing public APIs unnecessarily.
* Preserve existing behavior unless the task requires changing it.

If a refactor is necessary, keep it focused and explain why.

---

# Testing

When tests exist, update or add tests for changed behavior.

Tests should focus on behavior rather than implementation details.

Prioritize testing:

* Business logic
* User interactions
* Validation
* API behavior
* Important edge cases

Do not modify tests simply to make failing tests pass without investigating the underlying problem.

---

# Before Completing a Task

Before considering a task complete:

1. Check for JavaScript syntax errors.
2. Check ESLint errors.
3. Check for unused imports and variables.
4. Check that JSDoc is present for newly created reusable functions/components.
5. Check responsive behavior.
6. Check accessibility.
7. Check loading and error states where applicable.
8. Check that Pages Router conventions are being followed.
9. Check that no secrets were introduced.
10. Check that no unnecessary dependencies were added.
11. Check that unrelated files were not modified.
12. Run the project's available tests/build/lint commands when practical.

---

# Claude-Specific Instructions

When making changes to this project:

* Read relevant existing files before creating new ones.
* Follow the project's existing architecture.
* Do not introduce TypeScript.
* Use JavaScript with JSDoc.
* Use the **Next.js Pages Router**.
* Do not introduce the App Router.
* Use Tailwind CSS for styling.
* Prefer server-side data fetching when appropriate.
* Minimize unnecessary client-side JavaScript.
* Use semantic HTML.
* Prioritize accessibility.
* Avoid unnecessary dependencies.
* Avoid unnecessary abstractions.
* Do not rewrite unrelated code.
* Preserve existing functionality unless explicitly asked to change it.
* Explain significant architectural decisions briefly.
* When uncertain, prefer the simplest solution consistent with the existing codebase.

## Code Generation Requirements

When generating new code:

1. Use JavaScript.
2. Use `.js` or `.jsx`.
3. Add JSDoc to reusable functions/components/hooks.
4. Use Tailwind CSS for styling.
5. Follow Next.js Pages Router conventions.
6. Use `getServerSideProps` when request-time server data is required.
7. Use `getStaticProps` when static generation is appropriate.
8. Use `getStaticPaths` for statically generated dynamic routes.
9. Use `next/head` for page metadata.
10. Use `pages/api` for Next.js API Routes.
11. Use semantic HTML.
12. Consider accessibility.
13. Keep the implementation simple and maintainable.

## Final Review

Before presenting a completed implementation, verify:

```text
[ ] JavaScript only
[ ] No TypeScript introduced
[ ] JSDoc added where appropriate
[ ] Pages Router conventions followed
[ ] No App Router patterns introduced
[ ] Correct Next.js data-fetching method used
[ ] Tailwind CSS used for styling
[ ] Responsive behavior considered
[ ] Accessible markup used
[ ] No unnecessary dependencies
[ ] No secrets exposed
[ ] No unnecessary refactoring
[ ] Existing project conventions preserved
[ ] Lint/build/tests checked when available
```

<!-- END:nextjs-agent-rules -->
