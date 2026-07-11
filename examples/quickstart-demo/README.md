# CrossPlay Quickstart Demo Project

This is a standalone, step-by-step example project demonstrating how to use CrossPlay to automate testing across platforms. It features a modern dark-mode login application and a CrossPlay test suite configured to run against it.

---

## 1. Setup & Installation

From this directory, install the required dependencies:

```bash
npm install
```

*(This will install `@projectcrossplay/cli`, `@projectcrossplay/core`, and `@projectcrossplay/driver-web` along with Vitest and TypeScript.)*

---

## 2. Start the Demo Application

Launch the local web application:

```bash
npm run start-app
```

The application will start immediately at:  
👉 **[http://localhost:3000](http://localhost:3000)**

*(Open this URL in your web browser to see the beautiful dark mode glassmorphism interface. Try logging in with username `demo` and password `s3cret`.)*

---

## 3. Run the CrossPlay Test Suite

Open a new terminal window, navigate back to this directory, and run the automated tests:

```bash
npm run test:e2e
```

Under the hood, CrossPlay will:
1. Read `crossplay.config.mts` to locate the target environments.
2. Spin up a headless Chromium browser instance.
3. Execute `tests/login.spec.ts`, navigating through the login form and asserting outcomes.
4. Record screenshots and action states for every step.

---

## 4. Inspect the Test Traces

Every CrossPlay execution records comprehensive trace zip packages under `.crossplay/traces/` containing step logs, screenshots, and UI state details. 

Open the trace file using the CrossPlay CLI to inspect the execution:

```bash
npx crossplay show-trace .crossplay/traces/<spec-name>.trace
```

*(This will open the trace viewer on an ephemeral localhost port, allowing you to walk through the test actions step-by-step.)*

---

## How It Works

* **Unified Configuration (`crossplay.config.mts`)**: Specifies target platforms (`web`, `android`), base URLs, and timeout configurations.
* **Unified Selectors (`by.testId`)**: Instead of maintaining separate xpath/css selector files, `by.testId('username')` maps to `data-testid="username"` on web and `resource-id` or `content-desc` on Android automatically.
* **Auto-Waiting**: CrossPlay's assertion engines and action steps dynamically poll until elements are stable and interactive, eliminating the need for brittle manual `sleep()` statements.
