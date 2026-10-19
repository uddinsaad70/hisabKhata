# HisabKhata (হিসাবখাতা) — Master Development Checkpoints (`CHECKPOINTS.md`)

এই ফাইলটি `docs/hishabkhata_app_specificationV2.md` অনুযায়ী **Phase 1 (React Native + Expo Local-Only MVP)** এবং **Phase 2 (Node.js + Express + Prisma + PostgreSQL Custom Sync Backend)** তৈরির সম্পূর্ণ ধাপে ধাপে রোডম্যাপ। প্রতিটি চেকপয়েন্ট এত ছোট রাখা হয়েছে যেন এক বসায় কোড লিখে, টেস্ট চালিয়ে এবং যাচাই করে একটি করে ক্লিন Git Commit করা যায়।

## ০. Spec Issues (স্পেসে পাওয়া সূক্ষ্ম অস্পষ্টতা ও আমাদের সমাধান)

কোড শুরু করার আগে স্পেস (`hishabkhata_app_specificationV2.md`) রিভিউ করে নিচের **৬টি সূক্ষ্ম টেকনিক্যাল বিষয় (Edge Cases & Ambiguities)** চিহ্নিত করা হয়েছে এবং চেকপয়েন্টগুলোতে সেগুলোর সমাধান অন্তর্ভুক্ত করা হয়েছে:

1. **Multi-Table Pull Cursor (`GET /sync/pull` — সেকশন ৬.৪ ও ৭.৫.৩):**
   * *সমস্যা:* স্পেসে `GET /sync/pull`-এ একটি মাত্র `cursor` স্ট্রিং (`server_updated_at_id`) দিয়ে ৪টি টেবিল (`businesses`, `customers`, `customer_entries`, `cashbook_entries`) থেকে একসাথে ডেটা আনার কথা বলা হয়েছে। কিন্তু ৪টি আলাদা টেবিলে একই টাইমস্ট্যাম্প কার্সর শেয়ার করলে এবং `limit=200` কাটলে কোন টেবিলের কতটুকু পুল হয়েছে তা ট্র্যাক করা জটিল হয়ে যায়। এছাড়া `sync_state` টেবিলে প্রাইমারি কি `business_id` দেওয়া ছিল, অথচ `businesses` টেবিল নিজেই পুল হয়।
   * *সমাধান (`CP03`, `CP24`, `CP27`):* লোকাল `sync_state` টেবিলে একটি `'GLOBAL'` রো থাকবে। আর কার্সর হিসেবে ৪টি টেবিলের আলাদা কার্সর স্টেট (`{ businesses, customers, customerEntries, cashbookEntries }`) Base64URL এনকোডেড JSON স্ট্রিং হিসেবে ব্যবহৃত হবে এবং সার্ভার সবসময় FK ক্রম (`businesses` $\rightarrow$ `customers` $\rightarrow$ `customer_entries` $\rightarrow$ `cashbook_entries`) মেনে পুল দেবে।
2. **Customer Soft-Delete করার পর Undo/Restore বাগ (সেকশন ৬.৫.৪):**
   * *সমস্যা:* কাস্টমার ডিলিট করলে একই ট্রানজেকশনে তার সব এন্ট্রি `is_deleted = 1` করা হয়। কিন্তু কাস্টমারের যদি আগে থেকেই (যেমন ১ মাস আগে) ডিলিট করা কিছু এন্ট্রি থাকে, সেগুলোর `updated_at` যেন কাস্টমার ডিলিটের সময় ওভাররাইট না হয়।
   * *সমাধান (`CP05a`, `CP07`):* কাস্টমার সফট-ডিলিটের সময় শুধুমাত্র `WHERE customer_id = ? AND is_deleted = 0` শর্তে সক্রিয় এন্ট্রিগুলোকে একই `batchTimestamp` দিয়ে `is_deleted = 1` করা হবে।
3. **তারিখ ফিল্টারে (`Start Date`) রিপোর্টের `Opening Balance` কুয়েরি (সেকশন ২.৪ ও ৬.৫):**
   * *সমস্যা:* কাস্টমার রিপোর্টে যখন `START DATE` (যেমন `01 OCT 26`) ফিল্টার দেওয়া হয়, তখন পিডিএফে `Opening Balance` দেখানোর কথা বলা হয়েছে, কিন্তু সেকশন ৬.৫-এ এর আলাদা SQL কুয়েরি লেখা ছিল না।
   * *সমাধান (`CP13`):* `entry_date < :startDate AND is_deleted = 0` শর্তে আগের সব লেনদেনের যোগফলকে `ROUND(..., 2)` করে `Opening Balance` হিসেবে দেখানো হবে।
4. **ক্যালকুলেটরের চেইনড হিসাব ও Division-by-Zero এজ-কেস (সেকশন ২.৩ ও ৩.২):**
   * *সমস্যা:* ইউজার ক্যালকুলেটরে `41300+7000=48300*125=60380` এভাবে ধাপে ধাপে হিসাব করতে পারেন কিংবা `100 ÷ 0` বা শেষে অপারেটর রেখে (`500 +`) সেভ চাপতে পারেন।
   * *সমাধান (`CP08`):* ক্যালকুলেটর ইঞ্জিনে প্রতিটি `=` চাপার সাথে সাথে `roundMoney()` দিয়ে ২ ঘরে রাউন্ড হবে, এক্সপ্রেশন স্ট্রিংটি চাইলে Details বক্সে অটো-কপি করার অপশন থাকবে, শেষে অপারেটর থাকলে ট্রিম হবে এবং `÷ 0` বা `amount <= 0` হলে সেভ ব্লক থাকবে।
5. **সার্ভারে `BigInt` JSON Serialization ক্র্যাশ (সেকশন ৭.৪ ও ৭.৫):**
   * *সমস্যা:* Prisma স্কিমায় `timestamp`, `createdAt`, ও `updatedAt` কলামগুলো `BigInt` হিসেবে আছে। কিন্তু Node.js/Express-এ `res.json()` ডিফল্টভাবে `BigInt` সিরিয়ালাইজ করতে পারে না এবং `TypeError` দেয়।
   * *সমাধান (`CP19`, `CP23`):* রেসপন্স DTO ম্যাপিংয়ে `BigInt` ফিল্ডগুলোকে `Number(val)`-এ রূপান্তর করে পাঠানো হবে (UTC epoch ms আগামী ২,৮৫,০০০ বছর পর্যন্ত `Number.MAX_SAFE_INTEGER`-এর ভেতরে নিরাপদ)।
6. **Idempotent Push ও Clock Drift Clamp (সেকশন ৭.৩.১ ও ৭.৩.৩):**
   * *সমস্যা:* নেটওয়ার্ক রিট্রাইয়ের কারণে একই রিকোয়েস্ট দ্বিতীয়বার গেলে `updated_at` সমান হওয়ায় যেন কনফ্লিক্ট না ধরে এবং ইউজারের ফোনের ঘড়ি ভবিষ্যতে সেট করা থাকলে যেন LWW নষ্ট না হয়।
   * *সমাধান (`CP23`):* সার্ভারে ক্লায়েন্টের `updated_at > server_now + 5 min` হলে তা `server_now`-এ Clamp করা হবে এবং Upsert শর্তে `EXCLUDED.updated_at >= target.updated_at` (`>=` চিহ্ন) ব্যবহৃত হবে।

## ১. কাজের নিয়ম ও গিট ওয়ার্কফ্লো (Pair-Programming Workflow Rules)

1. **নতুন সেশন বা চ্যাট শুরু করার নিয়ম (New Session Protocol):**
   * প্রতিবার আপনি নতুন চ্যাট/সেশন খুললে কোড লেখার আগে আমি সবার প্রথমে `docs/CHECKPOINTS.md` এবং `docs/hishabkhata_app_specificationV2.md` পড়ব।
   * এরপর প্রথম অসমাপ্ত (`[ ]`) চেকপয়েন্ট কোনটি তা চিহ্নিত করব এবং তার আগে সম্পন্ন হওয়া (`[x]`) কাজের **১০ লাইনের মধ্যে একটি সারাংশ** আপনাকে দেখিয়ে কনফার্ম করিয়ে নেব, তারপর ওই অসমাপ্ত চেকপয়েন্টের কাজ শুরু করব।
2. **একবারে ১টি ছোট চেকপয়েন্ট:** আমরা একবারে শুধুমাত্র ১টি চেকপয়েন্ট নিয়ে কাজ করব। শেষ হলে **"Done when"** যাচাইয়ের কমান্ড/ধাপ দেব এবং আপনি নিশ্চিত না করা পর্যন্ত অপেক্ষা করব।
3. **Expo প্যাকেজ ইনস্টলের নিয়ম (`npx expo install`):**
   * Expo ও React Native-এর যেকোনো প্যাকেজ সবসময় **`npx expo install <package>`** দিয়ে ইনস্টল করতে হবে (যাতে বর্তমান Expo SDK ভার্সনের সাথে কম্প্যাটিবল ভার্সন ইনস্টল হয়)।
   * `create-expo-app` এর ডিফল্ট টেমপ্লেটে যেসব প্যাকেজ আগে থেকেই আছে (যেমন `expo-router`, `react-native-safe-area-context`, `react-native-screens`, `expo-linking`, `expo-constants`, `expo-status-bar`), সেগুলো `package.json` দেখে আগে চেক করে নেওয়া হবে যেন অযথা ডুপ্লিকেট ইনস্টল না করা হয়, এবং বয়লারপ্লেট পরিষ্কার করে স্পেসের সেকশন ৯.৩-এর ফোল্ডার স্ট্রাকচারের সাথে হুবহু মেলানো হবে।
4. **Windows PowerShell কমান্ড:** সব কমান্ড Windows PowerShell সিনট্যাক্সে দেওয়া হবে (কেন কমান্ডটি চালাচ্ছি তার ১ লাইনের ব্যাখ্যাসহ)।
5. **কমিট ও ট্যাগ নিয়ম:** প্রতিটি চেকপয়েন্ট শেষে (টেস্ট পাস থাকা অবস্থায়) আপনাকে সঠিক `git add ...` এবং `git commit -m "..."` কমান্ড দেব। আপনি কমিট করার পর `docs/CHECKPOINTS.md`-এ ওই চেকপয়েন্ট `[x]` (কমিট হ্যাশসহ) আপডেট করব।
6. **মাইলস্টোন ট্যাগ (`git tag`):**
   * `CP05b` শেষে (Local DB & All Queries Ready): `git tag v0.1.0-db`
   * `CP18` শেষে (Phase 1 MVP Complete): `git tag v1.0.0-mvp`
   * `CP25` শেষে (Phase 2 Backend API Complete): `git tag v1.5.0-api`
   * `CP29` শেষে (Full-Stack Production Ready): `git tag v2.0.0`

## ২. Phase 1 Checkpoints: Local-Only Mobile App (MVP)

### সেটআপ ও ভিত্তি (Setup & Foundation)

#### [ ] CP00: Monorepo Root, `docs/` Commit এবং Expo TypeScript অ্যাপ বুটস্ট্র্যাপ
* **লক্ষ্য:** প্রজেক্ট রুট (`hisabkhata/`) তৈরি করে `.gitignore`, রুট `README.md`, এবং `docs/` ফোল্ডারে স্পেস ও চেকপয়েন্ট রেখে প্রথম `docs:` কমিট করা; এরপর `apps/mobile` বুটস্ট্র্যাপ করে স্পেসের ফোল্ডার স্ট্রাকচার অনুযায়ী সাজানো ও UUID v7 পলিফিল যুক্ত করা।
* **ধাপে ধাপে করণীয়:**
  1. **ধাপ ক (Docs & Root Setup Commit):**
     * PowerShell-এ `hisabkhata` রুট ফোল্ডার ও `docs/` ফোল্ডার তৈরি করে `git init` চালানো।
     * রুটে `.gitignore` (`node_modules/`, `.env*`, `.expo/`, `dist/`, `build/`, `web-build/`, `*.db`, `*.db-wal`, `*.db-shm`, `coverage/`, `.DS_Store`), রুট `README.md`, এবং `docs/hishabkhata_app_specificationV2.md` ও `docs/CHECKPOINTS.md` রাখা।
     * সবার আগে প্রথম কমিট করা: `git commit -m "docs: add specification, checkpoints roadmap, root readme, and gitignore"`।
  2. **ধাপ খ (Expo Mobile App Bootstrap Commit):**
     * `npx create-expo-app@latest apps/mobile` চালিয়ে `apps/mobile/package.json` চেক করা (ডিফল্ট টেমপ্লেটে `expo-router` ও নেভিগেশন ডিপেন্ডেন্সিগুলো আগে থেকেই আছে কিনা দেখা এবং উদাহরণ বয়লারপ্লেট ফাইলগুলো পরিষ্কার করে স্পেসের সেকশন ৯.৩ অনুযায়ী `app/`, `components/`, `db/`, `store/`, `i18n/`, `utils/` ফোল্ডার তৈরি করা)।
     * অনুপস্থিত ডে-১ প্যাকেজ ইনস্টল করা: `npx expo install expo-sqlite react-native-get-random-values jest-expo jest` এবং `npm install uuid` ও `npm install -D @types/jest @types/uuid`।
     * `apps/mobile/app/_layout.tsx`-এর **একদম ১ নম্বর লাইনে** `import 'react-native-get-random-values';` যুক্ত করা এবং `app.json`-এ `"scheme": "hisabkhata"` ও `"userInterfaceStyle": "light"` নিশ্চিত করা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * `git log --oneline` দিলে প্রথমে `docs:` কমিট এবং তার উপরে `chore(mobile):` কমিট দেখা যায়।
  * `apps/mobile`-এ `npx tsc --noEmit` এবং `npm test` (`uuid.test.ts`) পাস করে, এবং `npx expo start` দিলে ফোনের Expo Go-তে `"HisabKhata Ready"` ও একটি জেনারেটেড UUID v7 দেখায়।
* **প্রয়োজনীয় টেস্ট:** `apps/mobile/utils/__tests__/uuid.test.ts` — জেনারেট হওয়া আইডি বৈধ UUID v7 ফরম্যাট (`019...`) এবং কালানুক্রমিকভাবে সর্টেবল কিনা তার ইউনিট টেস্ট।
* **কমিট মেসেজ:**
  1. `docs: add specification, checkpoints roadmap, root readme, and gitignore`
  2. `chore(mobile): bootstrap expo router typescript app with uuidv7 polyfill`
* **শেখার পয়েন্ট (React Native বনাম ওয়েব):**
  * ওয়েব ব্রাউজারে `window.crypto.getRandomValues()` বিল্ট-ইন থাকে, কিন্তু React Native-এর Hermes JS ইঞ্জিনে এটি ডিফল্টভাবে থাকে না। তাই `react-native-get-random-values` পলিফিলটি সব ফাইলের আগে (`_layout.tsx`-এর একদম উপরে) ইম্পোর্ট করতে হয়। এছাড়া ওয়েবে `<div>` ও `<p>` ব্যবহার করলেও React Native-এ সব লেআউট `<View>` (যা ডিফল্টভাবে `display: flex; flex-direction: column`) এবং সব টেক্সট বাধ্যতামূলকভাবে `<Text>` কম্পোনেন্টের ভেতরে রাখতে হয়।

#### [ ] CP01: ডিজাইন টোকেন, টাকার নির্ভুলতা (`formatCurrency.ts`) এবং লোকাল টাইমজোন (`dateUtils.ts`)
* **লক্ষ্য:** স্পেসের সেকশন ১.২, ৪ এবং ৬.২ অনুযায়ী কালার প্যালেট কনস্ট্যান্ট, ২-দশমিক রাউন্ডিং ও `en-IN` ফরম্যাটিং ফাংশন এবং ডিভাইসের লোকাল টাইমজোন হেল্পার তৈরি ও শতভাগ ইউনিট টেস্ট করা।
* **ধাপে ধাপে করণীয়:**
  1. `constants/theme.ts`-এ স্পেসের সব হেক্স কালার (`#1355A3`, `#C91C42`, `#108944`, `#FFF5F6`, `#FFC107` ইত্যাদি) ডিফাইন করা।
  2. `utils/formatCurrency.ts`-এ `CurrencyCode` (`'BDT' | 'INR'`), `roundMoney(val)` (round-half-up), `isSettled(bal)` (`Math.abs(bal) < 0.005`), এবং `formatCurrency(amount, code, showAbsolute)` লেখা।
  3. `utils/dateUtils.ts`-এ হার্ডকোডেড টাইমজোন ছাড়া ডিভাইসের লোকাল ক্যালেন্ডার অনুযায়ী `getLocalDateString()` (`YYYY-MM-DD`), `getLocalTimeString()` (`hh:mm AM/PM`), `isFutureDate(dateStr)`, এবং আপেক্ষিক সময় `formatRelativeTime(timestamp)` (`26 minutes ago`) লেখা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * `npm test` চালালে ফ্লোটিং-পয়েন্ট ও টাইমজোনের সব এজ-কেস টেস্ট পাস করে।
* **প্রয়োজনীয় টেস্ট:**
  * `utils/__tests__/formatCurrency.test.ts`: `roundMoney(0.1 + 0.2) === 0.3`, `roundMoney(10.005) === 10.01`, `isSettled(0.004) === true`, `isSettled(0.01) === false`, `formatCurrency(4203148, 'BDT') === '৳ 42,03,148'`, `formatCurrency(1250.5, 'INR') === '₹ 1,250.50'`।
  * `utils/__tests__/dateUtils.test.ts`: লোকাল মধ্যরাতের (`00:15 AM`) তারিখ যেন UTC-এর আগের দিনে না যায় এবং ভবিষ্যতের তারিখ (`tomorrow`) যেন `isFutureDate() === true` রিটার্ন করে।
* **কমিট মেসেজ:** `feat(utils): add money precision helpers, en-IN formatter, and local date utils`
* **শেখার পয়েন্ট (React Native বনাম ওয়েব):**
  * ওয়েবে CSS ভেরিয়েবল (`var(--primary-blue)`) ব্যবহার করা হয়, কিন্তু React Native-এ `StyleSheet.create({})` জাভাস্ক্রিপ্ট অবজেক্ট নেয়—তাই কালার ও স্পেসিং একটি টাইপ-সেফ TypeScript অবজেক্ট (`COLORS.primaryBlue`) থেকে সরাসরি ইমপোর্ট করে ব্যবহার করতে হয়।

#### [ ] CP02: কোর নেভিগেশন শেল (`CUSTOMERS | CASHBOOK` Header Tabs ও Bottom Tabs) এবং UI Store
* **লক্ষ্য:** স্পেসের সেকশন ২.১, ৫.১ এবং ৯.১ অনুযায়ী Zustand UI স্টোর (`activeBusinessId`, `activeHomeTab`, ফিল্টার ও স্ন্যাকবার স্টেট) এবং হোম স্ক্রিনের টপ অ্যাপ বার (`#1355A3`) ও `CUSTOMERS | CASHBOOK` ট্যাব সুইচার তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `npm install zustand` চালিয়ে `store/uiStore.ts` তৈরি করা (যেখানে কোনো DB ডেটা থাকবে না; শুধু `activeBusinessId`, `activeHomeTab: 'customers' | 'cashbook'`, `customerFilter`, `customerSort`, এবং `undoSnackbar` স্টেট থাকবে)।
  2. `app/(tabs)/_layout.tsx`-এ দুটি বটম ট্যাব (`Home / খাতা` এবং `More / সেটিংস`) সেটআপ করা।
  3. `app/(tabs)/index.tsx`-এ রয়্যাল ব্লু (`#1355A3`) টপ অ্যাপ বার (বামে খাতা আইকন ও ব্যবসার নাম ড্রপডাউন বাটন, ডানে সিঙ্ক আইকন) এবং তার নিচে হলুদ (`#FFC107`) অ্যাক্টিভ আন্ডারলাইনসহ **`CUSTOMERS`** ও **`CASHBOOK`** দুটি হেডার ট্যাব তৈরি করা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * অ্যাপে টপ হেডারের `CUSTOMERS` এবং `CASHBOOK` ট্যাবে ট্যাপ করলে সাথে সাথে নিচের ভিউ পরিবর্তন হয় এবং বটম বারের `Home` ও `More` ট্যাব কাজ করে।
* **প্রয়োজনীয় টেস্ট:** `store/__tests__/uiStore.test.ts` — ট্যাব পরিবর্তন, ফিল্টার রিসেট এবং স্ন্যাকবার ট্রিগার স্টেট টেস্ট।
* **কমিট মেসেজ:** `feat(nav): implement bottom tabs, royal blue header, and CUSTOMERS/CASHBOOK tab switcher`
* **শেখার পয়েন্ট (React Native বনাম ওয়েব):**
  * ওয়েবে URL কুয়েরি বা React Router `<Outlet>` ব্যবহার করা হয়; Expo Router ফাইল-ভিত্তিক রাউটিং (Next.js App Router-এর মতো) ব্যবহার করে। এছাড়া মোবাইলে ফোনের উপরের নচ (Notch) ও স্ট্যাটাস বারের সাথে যেন হেডার মিলে না যায়, সেজন্য `SafeAreaView` বা `useSafeAreaInsets()` ব্যবহার করতে হয়।

### লোকাল DB ও টেস্ট হারনেস (Local SQLite Database, Test Harness & Queries)

#### [ ] CP02b: DB Adapter Interface (`DatabaseAdapter`) এবং `better-sqlite3` In-Memory Test Harness
* **লক্ষ্য:** যেহেতু `expo-sqlite` একটি নেটিভ মোবাইল মডিউল এবং Jest/Node.js পরিবেশে চলে না, তাই অ্যাপের সব DB কোডের জন্য একটি ছোট ইন্টারফেস (`DatabaseAdapter`: `getAllAsync`, `getFirstAsync`, `runAsync`, `execAsync`, `withTransactionAsync`) তৈরি করা এবং Jest টেস্টের জন্য `better-sqlite3` (`:memory:`) দিয়ে এর Node-সাইড অ্যাডাপ্টার তৈরি করা—যাতে `CP03`–`CP05b`-এর সব SQL ও Window Function টেস্ট আসল SQLite ইঞ্জিনে চলে।
* **ধাপে ধাপে করণীয়:**
  1. `apps/mobile`-এ devDependency হিসেবে `npm install -D better-sqlite3 @types/better-sqlite3` ইনস্টল করা।
  2. `db/adapter.ts` তৈরি করা:
     * `DatabaseAdapter` ইন্টারফেস (`getAllAsync<T>`, `getFirstAsync<T>`, `runAsync`, `execAsync`, `withTransactionAsync`) ডিফাইন করা।
     * প্রোডাকশন মোবাইল অ্যাপের জন্য `createExpoSqliteAdapter(db: SQLiteDatabase): DatabaseAdapter` ইমপ্লিমেন্ট করা।
  3. `db/__tests__/testDbHelper.ts` তৈরি করা: যা `better-sqlite3` দিয়ে ইন-মেমোরি ডাটাবেজ (`new Database(':memory:')`) তৈরি করে এবং হুবহু `DatabaseAdapter`-এর অ্যাসিঙ্ক মেথডগুলো (`BEGIN` / `COMMIT` / `ROLLBACK` ট্রানজেকশনসহ) ইমপ্লিমেন্ট করে।
* **Done when (যাচাইযোগ্য শর্ত):**
  * `npm test` চালালে Jest-এর ভেতরে কোনো মক ছাড়াই আসল ইন-মেমোরি SQLite-এ টেবিল তৈরি, প্যারামিটারাইজড ইনসার্ট, `SUM() OVER ()` Window Function এবং ট্রানজেকশন রোলব্যাক কাজ করে।
* **প্রয়োজনীয় টেস্ট:** `db/__tests__/adapter.test.ts` — `getAllAsync`, `getFirstAsync`, `runAsync`, `execAsync`, এবং `withTransactionAsync` (কমিট ও এরর হলে রোলব্যাক)-এর টেস্ট।
* **কমিট মেসেজ:** `test(db): add DatabaseAdapter interface and better-sqlite3 in-memory test harness`
* **শেখার পয়েন্ট (React Native JSI বনাম Node Test Environment):**
  * `expo-sqlite` ফোনের ভেতরে C++ JSI বাইন্ডিং দিয়ে চলে যা Node.js-এ লোড হয় না। অনেকে Jest-এ `expo-sqlite`-কে `jest.fn()` দিয়ে মক করে—কিন্তু মক করলে SQL সিনট্যাক্স ভুল বা Window Function বাগ কখনোই ধরা পড়ে না। `DatabaseAdapter` + `better-sqlite3` (`:memory:`) ব্যবহারের ফলে আমাদের অ্যাপের ১০০% SQL কোড টেস্টের সময়ও আসল C-লেভেলের SQLite ইঞ্জিনেই রান করবে!

#### [ ] CP03: SQLite V1 DDL স্কিমা (`db/schema.ts`) ও `PRAGMA user_version` মাইগ্রেশন রানার (`db/migrations.ts`)
* **লক্ষ্য:** স্পেসের সেকশন ৬.৩ ও ৬.৪ অনুযায়ী `DatabaseAdapter`-এর ওপর ভিত্তি করে `businesses`, `customers`, `customer_entries`, `cashbook_entries`, ও `sync_state` টেবিল, সব ইনডেক্স এবং `PRAGMA user_version` মাইগ্রেশন রানার তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `db/schema.ts`-এ `PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;` এবং ৫টি টেবিল ও সব পারফরম্যান্স ইনডেক্সের SQL DDL লেখা (`businesses.currency` কলামে `CHECK (currency IN ('BDT', 'INR'))` এবং `sync_state` টেবিলে `'GLOBAL'` কার্সর কি সহ)।
  2. `db/migrations.ts`-এ `LATEST_SCHEMA_VERSION = 1` এবং `runMigrations(db: DatabaseAdapter)` ফাংশন লেখা—যা বর্তমান `user_version` চেক করে ক্রমিকভাবে মাইগ্রেশন চালায় এবং `user_version > LATEST_SCHEMA_VERSION` হলে `BACKUP_VERSION_TOO_NEW` এরর থ্রো করে।
  3. `app/_layout.tsx`-এ অ্যাপ ওপেন হওয়ার সময় `expo-sqlite` ডাটাবেজ ওপেন করে `createExpoSqliteAdapter(rawDb)` দিয়ে `runMigrations()` কল করা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * `better-sqlite3` টেস্ট হারনেসে এবং ফোনে অ্যাপ চালু হলে `PRAGMA user_version = 1` এবং ৫টি টেবিল ও সব ইনডেক্স তৈরি হয়েছে বলে নিশ্চিত হওয়া যায়।
* **প্রয়োজনীয় টেস্ট:** `db/__tests__/migrations.test.ts` (আসল ইন-মেমোরি SQLite-এ) — (১) শূন্য থেকে `v1` মাইগ্রেশন ও ৫টি টেবিল/CHECK কনস্ট্রেইন্ট যাচাই, (২) দ্বিতীয়বার চালালে idempotent থাকা, এবং (৩) ডাটাবেজের `user_version = 99` থাকলে `BACKUP_VERSION_TOO_NEW` এরর দেওয়া।
* **কমিট মেসেজ:** `feat(db): add sqlite v1 schema, indexes, and pragma user_version migration runner`
* **শেখার পয়েন্ট (SQLite CHECK Constraints & Foreign Keys):**
  * SQLite-এ টেবিল তৈরির স্কিমার ভেতরে `FOREIGN KEY` লেখা থাকলেও প্রতিবার ডাটাবেজ কানেকশন ওপেন করার পর `PRAGMA foreign_keys = ON;` না চালালে ফরেন কি এনফোর্স হয় না। তাই অ্যাডাপ্টার ইনিশিয়ালাইজেশনের শুরুতেই এটি চালানো বাধ্যতামূলক।

#### [ ] CP04: মাল্টি-বিজনেস CRUD কুয়েরি (`businessQueries.ts`), Onboarding স্ক্রিন এবং Business Switcher Modal
* **লক্ষ্য:** স্পেসের সেকশন ৫.১, ৬.১ ও ৮.১.৬ অনুযায়ী প্রথমবার অ্যাপ ওপেন করলে ব্যবসা তৈরির স্ক্রিন (`/onboarding`), মাল্টি-বিজনেস কুয়েরি এবং টপ বারের **Business Switcher Modal** তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `db/businessQueries.ts`-এ `getAllBusinesses(db)`, `createBusiness(db, input)`, `updateBusiness(db, input)`, এবং `getOrInitDeviceSyncState(db)` লেখা (প্রতিটি ব্যবসার সক্রিয় কাস্টমার সংখ্যাসহ)।
  2. `app/onboarding.tsx` তৈরি করা: ডাটাবেজে কোনো ব্যবসা না থাকলে অ্যাপ স্বয়ংক্রিয়ভাবে এই স্ক্রিনে নিয়ে যাবে, যেখানে ব্যবসার নাম (যেমন `আমার দোকান`) এবং কারেন্সি (`BDT ৳` বা `INR ₹`) দিয়ে প্রথম ব্যবসা তৈরি করা যাবে।
  3. `components/BusinessSwitcherModal.tsx` তৈরি করা: টপ বারে ব্যবসার নামে ট্যাপ করলে সব ব্যবসার তালিকা দেখাবে, এক ট্যাপে অ্যাক্টিভ ব্যবসা পরিবর্তন করা যাবে এবং `+ নতুন ব্যবসা যোগ করুন` দিয়ে নতুন ব্যবসা খোলা যাবে।
* **Done when (যাচাইযোগ্য শর্ত):**
  * প্রথমবার অ্যাপ চালালে `/onboarding` স্ক্রিন আসে, ব্যবসা সেভ করলে হোম পেজে যায়, এবং টপ বার থেকে ২য় একটি ব্যবসা তৈরি করে দুই ব্যবসার মধ্যে সুইচ করা যায়।
* **প্রয়োজনীয় টেস্ট:** `db/__tests__/businessQueries.test.ts` — ব্যবসা তৈরি, আপডেট, অবৈধ কারেন্সি কোড দিলে SQLite CHECK এরর এবং `is_synced = 0` ফ্ল্যাগ যাচাই।
* **কমিট মেসেজ:** `feat(business): add multi-business queries, first-run onboarding, and switcher modal`
* **শেখার পয়েন্ট (React Native বনাম ওয়েব):**
  * ওয়েবে মডালের জন্য সাধারণত CSS `position: fixed; z-index: 999` ব্যবহার করা হয়। React Native-এ নেটিভ `<Modal transparent animationType="slide">` কম্পোনেন্ট ব্যবহার করতে হয়, যা বর্তমান স্ক্রিনের উপরে হার্ডওয়্যার-অ্যাক্সিলারেটেড লেয়ার হিসেবে রেন্ডার হয়।

#### [ ] CP05a: Customer Ledger কোর ডাটাবেজ কুয়েরি (`db/customerQueries.ts`)
* **লক্ষ্য:** স্পেসের সেকশন ৬.৫.২–৬.৫.৫ অনুযায়ী কাস্টমারের CRUD, ডুপ্লিকেট ফোন চেক, হোম সামারি, Window Function রানিং ব্যালেন্স (`Bal.`), `recomputeBalance()`, এবং Cascade Soft-Delete ও Undo রিস্টোর কুয়েরি তৈরি ও আসল SQLite-এ টেস্ট করা।
* **ধাপে ধাপে করণীয়:**
  1. `db/customerQueries.ts` তৈরি করা (`DatabaseAdapter` ব্যবহার করে):
     * `createCustomer()`, `updateCustomer()`, `checkDuplicatePhone(db, businessId, phone, excludeId?)`
     * `getCustomersWithSummary(db, businessId, search, filter, sort)` এবং হোম সামারি কার্ডের (`You will give` ও `You will get`) টোটাল কুয়েরি (শুধুমাত্র `is_deleted = 0` কাস্টমারদের নিয়ে)।
     * `getCustomerLedgerEntries(db, businessId, customerId)` — স্পেসের সেকশন ৬.৫.২-এর `ROUND(SUM(CASE WHEN type = 'GOT' THEN amount ELSE -amount END) OVER (PARTITION BY customer_id ORDER BY entry_date ASC, timestamp ASC, id ASC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 2)` Window Function সহ।
     * `addCustomerEntry()`, `updateCustomerEntry()`, `softDeleteCustomerEntry()`, `undoDeleteCustomerEntry()` — প্রতিটিতেই ইনপুট `roundMoney()` করা এবং একই ট্রানজেকশনে (`db.withTransactionAsync`) `recomputeBalance()` কল করা (যা কাস্টমারের `updated_at` বা `is_synced` বদলাবে না)।
     * `softDeleteCustomerCascade(db, businessId, customerId)` — একই ট্রানজেকশনে কাস্টমার এবং তার অধীনে থাকা সব সক্রিয় (`is_deleted = 0`) এন্ট্রিকে `is_deleted = 1, is_synced = 0, updated_at = batchNow` করা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * স্পেসের সেকশন ৬.৫.৫-এর ব্যাকডেটেড এন্ট্রি উদাহরণসহ (১০ অক্টোবর `GAVE 1000`, ১৫ অক্টোবর `GOT 400`, এরপর ১২ অক্টোবরের ব্যাকডেটেড `GOT 300` ইনসার্ট ও পরে ১০ অক্টোবরের এন্ট্রি `800`-তে এডিট) সব কাস্টমার কুয়েরির টেস্ট `better-sqlite3`-এ ১০০% পাস করে।
* **প্রয়োজনীয় টেস্ট:** `db/__tests__/customerQueries.test.ts` — (১) ব্যাকডেটেড এন্ট্রি ইনসার্ট ও এডিটে রানিং ব্যালেন্স ও `net_balance` ঠিক থাকা, (২) `recomputeBalance()` কাস্টমারের `updated_at`/`is_synced` না বদলানো, (৩) কাস্টমার সফট-ডিলিটে শুধুমাত্র সক্রিয় এন্ট্রিগুলো Tombstone হওয়া এবং হোম টোটাল থেকে বাদ পড়া, (৪) ডুপ্লিকেট ফোন চেক ও বিজনেস আইসোলেশন টেস্ট।
* **কমিট মেসেজ:** `feat(db): implement customer ledger queries, window function running balance, and cascade soft-delete`
* **শেখার পয়েন্ট (SQLite Window Functions & Tie-Breaking):**
  * একই দিনে ও একই মিলিসেকেন্ডে দুটি এন্ট্রি হলে Window Function-এ যেন রানিং ব্যালেন্সের ক্রম কখনোই এলোমেলো না হয়, সেজন্য `ORDER BY entry_date ASC, timestamp ASC, id ASC` (টাই-ব্রেকার হিসেবে `id ASC`) এবং `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` দেওয়া অপরিহার্য।

#### [ ] CP05b: Cashbook কোর ডাটাবেজ কুয়েরি (`db/cashbookQueries.ts`) এবং `v0.1.0-db` ট্যাগ
* **লক্ষ্য:** স্পেসের সেকশন ৬.৫.১ অনুযায়ী ক্যাশবুকের ড্যাশবোর্ড সামারি (`Total` ও `Today's Balance`, `Cash in Hand` ও `Online` স্প্লিট), এন্ট্রি CRUD, সফট-ডিলিট + Undo, এবং CTE + Window Function দিয়ে মাসিক ডেইলি ও কিউমুলেটিভ ব্যালেন্স রিপোর্ট কুয়েরি তৈরি ও টেস্ট করা।
* **ধাপে ধাপে করণীয়:**
  1. `db/cashbookQueries.ts` তৈরি করা (`DatabaseAdapter` ব্যবহার করে):
     * `getCashbookDashboardSummary(db, businessId, todayDate)` — সেকশন ৬.৫.১(ক)-এর `total_cash`, `total_online`, `total_balance`, `today_cash`, `today_online`, `today_balance` কুয়েরি (`ROUND(..., 2)` সহ)।
     * `getCashbookEntriesByDate(db, businessId, date)` এবং `addCashbookEntry()`, `updateCashbookEntry()`, `softDeleteCashbookEntry()`, `undoDeleteCashbookEntry()`।
     * `getCashbookDailyReport(db, businessId, startDate, endDate)` — সেকশন ৬.৫.১(খ)-এর `daily_summary` ও `cumulative_summary` CTE এবং `ROUND(SUM(daily_balance) OVER (ORDER BY entry_date ASC), 2)` Window Function কুয়েরি।
* **Done when (যাচাইযোগ্য শর্ত):**
  * ক্যাশবুকে একাধিক তারিখে `CASH` ও `ONLINE` মোডে `IN` ও `OUT` এন্ট্রি দিয়ে ড্যাশবোর্ড সামারি এবং তারিখ রেঞ্জ ফিল্টারে ক্রমযোজিত `total_balance` নিখুঁতভাবে মিলে যায়।
* **প্রয়োজনীয় টেস্ট:** `db/__tests__/cashbookQueries.test.ts` — (১) `Cash in Hand` বনাম `Online` স্প্লিট ও `Today's Balance` হিসাব, (২) এন্ট্রি এডিট ও সফট-ডিলিট + Undo রিস্টোর, (৩) একাধিক দিনের কিউমুলেটিভ ব্যালেন্স (`SUM() OVER (ORDER BY entry_date ASC)`) যখন `startDate` মাসের মাঝখান থেকে শুরু হয় তখনো পূর্বের দিনের জেরসহ সঠিক `total_balance` দেখায় কিনা তার টেস্ট।
* **কমিট মেসেজ:** `feat(db): implement cashbook summary, crud, and cumulative daily report queries`
  *(এই কমিটের পর মাইলস্টোন ট্যাগ: `git tag v0.1.0-db`)*
* **শেখার পয়েন্ট (CTE Ordering in SQLite):**
  * ক্যাশবুক রিপোর্টে যদি ইউজার `10 Oct` থেকে `20 Oct` ফিল্টার দেন, তখন `10 Oct`-এর `TOTAL BALANCE` মানে হলো একদম শুরু থেকে `10 Oct` পর্যন্ত ক্রমযোজিত ব্যালেন্স। তাই CTE-এর ভেতরে আগে সব তারিখের ওপর `SUM(daily_balance) OVER (ORDER BY entry_date ASC)` চালিয়ে তারপর বাইরের `SELECT`-এ `WHERE entry_date BETWEEN :startDate AND :endDate` ফিল্টার করতে হয়।

### মডিউল ১: Customer Ledger (UI & Flows)

#### [ ] CP06: কাস্টমার হোম ট্যাব (Summary Card, Search, Filter/Sort Bottom Sheet ও Customer List)
* **লক্ষ্য:** স্পেসের সেকশন ২.১ অনুযায়ী `CUSTOMERS` ট্যাবের টপ সামারি কার্ড (`You will give` সবুজ, `You will get` লাল), লাইভ সার্চ বার, ফিল্টার/সর্ট বটম শিট, কাস্টমার লিস্ট (`@shopify/flash-list`) এবং Empty State তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `npx expo install @shopify/flash-list` দিয়ে FlashList ইনস্টল করা।
  2. `CUSTOMERS` ট্যাবে ফ্লোটিং সাদা সামারি কার্ড (`You will give` | `You will get` এবং নিচে `[PDF] View Reports >` বাটন) যুক্ত করা।
  3. সার্চ ইনপুট (`🔍 Search Customer` $\rightarrow$ ফোকাস করলে `✕ Name, Mobile no.`) এবং ডানে `▽ Filters` বাটন ও বটম শিট মডাল (`All`, `You will get`, `You will give`, `Settled` এবং ৪টি সর্ট অপশন) তৈরি করা।
  4. প্রতিটি কাস্টমার রো-তে গোলাকার ইনিশিয়াল অ্যাভাটার (`YM`), বোল্ড নাম, আপেক্ষিক সময় (`26 minutes ago`), এবং ডান পাশে রঙিন নেট ব্যালেন্স (`৳ 0` ধূসর, `You will give` সবুজ, `You will get` লাল) দেখানো। নিচে ডান কোণায় `+ ADD CUSTOMER` (`#B8144D`) ফ্লোটিং বাটন বসানো।
* **Done when (যাচাইযোগ্য শর্ত):**
  * কাস্টমার লিস্টে নাম বা ফোন নম্বর লিখে লাইভ সার্চ ও ফিল্টার কাজ করে এবং ব্যবসা পরিবর্তন করলে ওই ব্যবসার কাস্টমার ও টপ সামারি সাথে সাথে আপডেট হয়।
* **প্রয়োজনীয় টেস্ট:** সার্চ ও ফিল্টার কম্বিনেশনের কুয়েরি ও রেন্ডার টেস্ট।
* **কমিট মেসেজ:** `feat(customer): build customers home tab with summary card, search, filter, and flashlist`
* **শেখার পয়েন্ট (React Native বনাম ওয়েব):**
  * ওয়েবে বড় লিস্টে সাধারণ `.map()` দিলেও ব্রাউজার ডম হ্যান্ডেল করে, কিন্তু মোবাইলে হাজারখানেক কাস্টমার `.map()` দিয়ে রেন্ডার করলে মেমোরি ভরে অ্যাপ ফ্রিজ হয়। `@shopify/flash-list` স্ক্রিনের বাইরে যাওয়া ভিউগুলো রিসাইকেল (View Recycling) করে ৬০ FPS স্ক্রলিং বজায় রাখে।

#### [ ] CP07: নতুন কাস্টমার যোগ (`/customer/add`) এবং কাস্টমার সেটিংস (`/customer/[id]/settings`)
* **লক্ষ্য:** স্পেসের সেকশন ২.১.৬, ২.২.১ এবং ৮.১.৫ অনুযায়ী নতুন কাস্টমার যোগ করার ফর্ম (ডুপ্লিকেট ফোন নম্বর সতর্কবার্তাসহ) এবং কাস্টমারের নাম/ফোন এডিট ও ক্যাসকেড সফট-ডিলিট স্ক্রিন তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `npm install react-hook-form zod @hookform/resolvers` ইনস্টল করে `app/customer/add.tsx` তৈরি করা: নাম (বাধ্যতামূলক) ও মোবাইল নম্বর (ঐচ্ছিক)।
  2. মোবাইল নম্বর দিলে সেভ করার আগে `checkDuplicatePhone()` দিয়ে চেক করা—একই ব্যবসায় ওই নম্বর আগে থাকলে `"এই নম্বরে [Customer Name] আগে থেকেই যুক্ত আছেন"` সতর্কবার্তা দেখানো। সেভ সফল হলে সরাসরি `/customer/[id]` লেজার স্ক্রিনে নিয়ে যাওয়া (`router.replace`)।
  3. `app/customer/[id]/settings.tsx` তৈরি করা: কাস্টমারের নাম ও ফোন নম্বর এডিট করে সেভ করা এবং নিচে লাল `Delete Customer` বাটন (কনফার্মেশন মডালসহ, যা কনফার্ম করলে `softDeleteCustomerCascade()` চালিয়ে হোম পেজে ফিরিয়ে আনবে)।
* **Done when (যাচাইযোগ্য শর্ত):**
  * নতুন কাস্টমার সেভ করলে সরাসরি তার লেজার স্ক্রিন ওপেন হয়, ডুপ্লিকেট ফোনে সতর্কবার্তা দেয়, এবং কাস্টমার ডিলিট করলে তার ব্যালেন্স হোম সামারি থেকে সাথে সাথে বাদ পড়ে।
* **প্রয়োজনীয় টেস্ট:** ফর্ম ভ্যালিডেশন ও ডুপ্লিকেট ফোন ডিটেকশন টেস্ট।
* **কমিট মেসেজ:** `feat(customer): add create customer form with duplicate phone check and customer settings screen`
* **শেখার পয়েন্ট (React Native বনাম ওয়েব):**
  * ওয়েবে `<form onSubmit>` ও `<input>` থাকে। React Native-এ কোনো `<form>` ট্যাগ নেই; `<TextInput>`-এ `onChangeText` (ওয়েবের `onChange(e => e.target.value)`-এর বদলে সরাসরি স্ট্রিং দেয়) এবং কিবোর্ডের নিচে ইনপুট ঢেকে যাওয়া ঠেকাতে `<KeyboardAvoidingView>` ব্যবহার করতে হয়।

#### [ ] CP08: কাস্টম ইন-অ্যাপ ক্যালকুলেটর কিপ্যাড কম্পোনেন্ট (`CalculatorKeypad.tsx`)
* **লক্ষ্য:** স্পেসের সেকশন ২.৩ ও ৩.২ অনুযায়ী কাস্টমার লেজার ও ক্যাশবুক উভয় জায়গায় ব্যবহারের জন্য কাস্টম ক্যালকুলেটর কিপ্যাড (`C`, `M+`, `M-`, `⌫`, `+`, `-`, `×`, `÷`, `%`, `=`) এবং অটো-ক্যালকুলেশন এক্সপ্রেশন ইঞ্জিন তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `utils/calculatorEngine.ts` তৈরি করা: যা নিরাপদভাবে গাণিতিক এক্সপ্রেশন (`+`, `-`, `×`, `÷`, `%`), মেমোরি বাটন (`M+`, `M-`), এবং চেইনড হিসাব (যেমন `41300+7000=48300*125=60380`) প্রসেস করে এবং প্রতিটি ফলাফল `roundMoney()` দিয়ে ২ দশমিক ঘরে রাউন্ড করে।
  2. এজ-কেস হ্যান্ডলিং: শেষে অপারেটর থাকলে (`500+`) সেভের সময় স্বয়ংক্রিয়ভাবে অপারেটর বাদ দিয়ে `500` নেওয়া, `÷ 0` হলে এরর ফ্ল্যাগ দেওয়া এবং সর্বোচ্চ সীমা `99,99,99,999.99` চেক করা।
  3. `components/CalculatorKeypad.tsx` তৈরি করা: মোবাইল স্ক্রিনের নিচে ফিক্সড বাটনের গ্রিড, যেখানে ডিফল্ট ওএস কিবোর্ড ওপেন না হয়ে আমাদের কাস্টম কিপ্যাড দিয়ে দ্রুত অ্যামাউন্ট টাইপ করা যাবে।
* **Done when (যাচাইযোগ্য শর্ত):**
  * ক্যালকুলেটরে `41300 + 7000 = × 125 =` চাপলে নিখুঁতভাবে ফলাফল ও এক্সপ্রেশন স্ট্রিং পাওয়া যায় এবং সব এজ-কেস টেস্ট পাস করে।
* **প্রয়োজনীয় টেস্ট:** `utils/__tests__/calculatorEngine.test.ts` — যোগ, বিয়োগ, গুণ, ভাগ, শতকরা (`%`), `M+`/`M-`, দশমিক রাউন্ডিং, ট্রেইলিং অপারেটর এবং `÷ 0` টেস্ট।
* **কমিট মেসেজ:** `feat(calculator): build custom calculator engine and keypad component`
* **শেখার পয়েন্ট (React Native বনাম ওয়েব):**
  * অ্যামাউন্ট বক্সে সাধারণ `<TextInput>` দিলে ফোনের নিজস্ব কিবোর্ড ভেসে উঠে কাস্টম ক্যালকুলেটর ঢেকে দেয়। তাই অ্যামাউন্ট ডিসপ্লে বক্সটি `<Pressable>` + `<Text>` দিয়ে তৈরি করতে হয় (অথবা `showSoftInputOnFocus={false}` দিতে হয়) যাতে শুধুমাত্র আমাদের কাস্টম ক্যালকুলেটর কিপ্যাডই কাজ করে।

#### [ ] CP09: কাস্টমার ব্যক্তিগত লেজার স্ক্রিন (`/customer/[id]`) এবং নতুন এন্ট্রি ফর্ম (`/customer/[id]/entry-form`)
* **লক্ষ্য:** স্পেসের সেকশন ২.২ ও ২.৩ অনুযায়ী কাস্টমারের ব্যক্তিগত লেজার স্ক্রিন (টপ স্ট্যাটাস ব্যানার, ৩-কলাম লেজার টেবিল, তারিখ পিল, রানিং `Bal.` ব্যাজ) এবং `YOU GAVE ৳` / `YOU GOT ৳` এন্ট্রি স্ক্রিন তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `app/customer/[id]/index.tsx` তৈরি করা:
     * টপ ব্লু হেডারে ব্যাক অ্যারো, অ্যাভাটার, কাস্টমারের নাম, `View settings` লিংক এবং ডানে `📞` কল আইকন (`Linking.openURL('tel:...')`)।
     * হেডারের ভেতরে সাদা ব্যালেন্স স্ট্যাটাস কার্ড (`Settled Up ৳ 0`, সবুজ `You will give`, অথবা লাল `You will get`) এবং নিচে `[PDF] Report` বাটন।
     * ৩ কলামের স্টিকি হেডার (`ENTRIES` ৫০% | `YOU GAVE` ২৫% গোলাপি `#FFF5F6` কলাম | `YOU GOT` ২৫% সাদা কলাম), তারিখ বিভাজক পিল (`18 Oct 26 - Today`), এবং প্রতিটি কার্ডে সময়, কুয়েরি থেকে পাওয়া রানিং ব্যালেন্স পিল (`Bal. ৳ ...`), ও বিবরণ।
     * নিচে দুটি বড় বাটন: লাল `YOU GAVE ৳` এবং সবুজ `YOU GOT ৳`।
  2. `app/customer/[id]/entry-form.tsx` তৈরি করা:
     * `type=GAVE` হলে লাল থিম এবং `type=GOT` হলে সবুজ থিম।
     * অ্যামাউন্ট `> 0` হলে নিচে `Enter details` ইনপুট বক্স এবং তারিখ পিকার বাটন (`📅 18 Oct 26 ▾`) দেখানো, যেখানে ভবিষ্যতের তারিখ (`entry_date > today`) ব্লক থাকবে।
     * `SAVE` চাপলে ২-দশমিক রাউন্ড করে ডাটাবেজে সেভ করা এবং লেজার স্ক্রিনে ফিরে আসা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * কাস্টমারের ভেতরে ঢুকে `YOU GAVE` ও `YOU GOT` এন্ট্রি দিলে (আজকের এবং আগের কোনো ব্যাকডেটেড তারিখের) রানিং ব্যালেন্স (`Bal.`) এবং টপ নেট ব্যালেন্স সাথে সাথে নিখুঁতভাবে আপডেট হয়।
* **প্রয়োজনীয় টেস্ট:** ব্যাকডেটেড এন্ট্রি যোগ করার পর UI ডেটা ফ্লো ও ভবিষ্যৎ তারিখ ভ্যালিডেশন টেস্ট।
* **কমিট মেসেজ:** `feat(customer): implement individual customer ledger screen and calculator entry form`
* **শেখার পয়েন্ট (React Native বনাম ওয়েব):**
  * ওয়েবে টেবিলের জন্য `<table><tr><td>` থাকে, কিন্তু React Native-এ কোনো টেবিল ট্যাগ নেই। ৩-কলামের লেজার টেবিল বানানোর জন্য প্রতিটি রো-কে `flexDirection: 'row'` দিয়ে বাম কলামে `flex: 2`, মাঝের গোলাপি কলামে `flex: 1, backgroundColor: '#FFF5F6'`, এবং ডান কলামে `flex: 1` দিয়ে নিখুঁত কলাম অ্যালাইনমেন্ট তৈরি করতে হয়।

#### [ ] CP10: কাস্টমার এন্ট্রি ডিটেইলস, এডিট এবং ডিলিট + ৫-সেকেন্ড Undo Snackbar (`/customer/[id]/entry/[entryId]`)
* **লক্ষ্য:** স্পেসের সেকশন ২.৩ ও ৮.১.৪ অনুযায়ী যেকোনো কাস্টমার এন্ট্রিতে ট্যাপ করলে ডিটেইলস দেখা, এডিট করা এবং ডিলিট করলে কনফার্মেশন মডাল ও ৫-সেকেন্ডের `Entry Deleted [UNDO]` স্ন্যাকবার তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `components/DeleteConfirmModal.tsx` এবং `components/UndoSnackbar.tsx` তৈরি করা (যা কাস্টমার লেজার ও ক্যাশবুক উভয় জায়গায় ব্যবহৃত হবে)।
  2. `app/customer/[id]/entry/[entryId].tsx` তৈরি করা: এন্ট্রির ধরন (`GAVE`/`GOT`), তারিখ ও সময়, টাকার পরিমাণ, বিবরণ, সিঙ্ক ব্যাকআপ ব্যাজ, `✎ EDIT ENTRY` বাটন এবং নিচে `🗑️ DELETE` বাটন।
  3. `✎ EDIT ENTRY` চাপলে `/customer/[id]/entry-form?entryId=...` স্ক্রিনে পূর্বের তথ্যসহ ওপেন করা এবং আপডেট করলে রানিং ও নেট ব্যালেন্স আপডেট হওয়া।
  4. `🗑️ DELETE` কনফার্ম করলে এন্ট্রি সফট-ডিলিট করে `/customer/[id]` স্ক্রিনে ফিরে আসা এবং নিচে ৫ সেকেন্ডের জন্য `Entry Deleted [UNDO]` স্ন্যাকবার দেখানো—`UNDO` চাপলে সাথে সাথে এন্ট্রি ও ব্যালেন্স পূর্বাবস্থায় ফিরে আসা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * কাস্টমার এন্ট্রি এডিট ও ডিলিট কাজ করে এবং ডিলিট করার পর `UNDO` বাটনে ট্যাপ করলে এন্ট্রিটি পুনরায় লেজারে ফিরে আসে ও ব্যালেন্স ঠিক হয়ে যায়।
* **প্রয়োজনীয় টেস্ট:** এন্ট্রি এডিট, সফট-ডিলিট এবং Undo রিস্টোর করার পর `recomputeBalance()` যাচাই।
* **কমিট মেসেজ:** `feat(customer): add customer entry details, edit flow, and soft-delete with undo snackbar`
* **শেখার পয়েন্ট (React Native বনাম ওয়েব):**
  * Expo Router-এ আগের স্ক্রিনে ফিরে যাওয়ার পর (`router.back()`) ডাটাবেজ থেকে নতুন ডেটা রিফ্রেশ করার জন্য React Navigation-এর `useFocusEffect` হুক ব্যবহার করতে হয় (কারণ মোবাইলে স্ট্যাকের আগের স্ক্রিন আনমাউন্ট না হয়ে মেমোরিতে মাউন্টেড অবস্থায় থাকে, তাই শুধু `useEffect(..., [])` দিলে ব্যাক করার পর রি-রান হয় না)।

### মডিউল ২: Cashbook (UI & Flows)

#### [ ] CP11: ক্যাশবুক ড্যাশবোর্ড (`CASHBOOK` Tab) এবং `- OUT` / `+ IN` এন্ট্রি ফর্ম (`/cashbook/entry-form`)
* **লক্ষ্য:** স্পেসের সেকশন ৩.১ ও ৩.২ অনুযায়ী হোম স্ক্রিনের `CASHBOOK` ট্যাব (টপ ডুয়াল ব্যালেন্স কার্ড: `Total Balance` ও `Today's Balance`, `Cash in Hand` ও `Online` স্প্লিট, ডেইলি হেডার ও ৩-কলাম লিস্ট) এবং ক্যাশবুকের এন্ট্রি স্ক্রিন তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. হোম স্ক্রিনের `CASHBOOK` ট্যাব ভিউ তৈরি করা:
     * টপ কার্ডে বামে `Total Balance` (`Cash in Hand` ও `Online` সহ) এবং ডানে `Today's Balance` (`Cash in Hand` ও `Online` সহ) এবং নিচে `[PDF] VIEW CASHBOOK REPORT` বাটন।
     * ডেইলি হেডার রো (`18 OCT • 12 Entries`, মাঝখানে লাল `OUT` টোটাল, ডানে সবুজ `IN` টোটাল) এবং ৩-কলাম এন্ট্রি লিস্ট।
     * নিচে ফিক্সড অ্যাকশন বার: বামে লাল `[−] OUT` বাটন এবং ডানে সবুজ `[+] IN` বাটন।
  2. `app/cashbook/entry-form.tsx` তৈরি করা:
     * ডাইনামিক টপ বার (`← OUT entry of ৳ ...` লাল অথবা `← IN entry of ৳ ...` সবুজ)।
     * `Payment Mode` পিল টগল: `Cash` (ডিফল্ট) | `Online`।
     * কাস্টম ক্যালকুলেটর কিপ্যাড, ডিটেইলস বক্স, তারিখ পিকার (ভবিষ্যৎ তারিখ ব্লকসহ) এবং `SAVE` বাটন।
* **Done when (যাচাইযোগ্য শর্ত):**
  * ক্যাশবুকে `Cash` ও `Online` মোডে `OUT` এবং `IN` এন্ট্রি দিলে `Today's Balance`, `Total Balance`, `Cash in Hand`, এবং `Online` ব্যালেন্স সাথে সাথে নিখুঁতভাবে আপডেট হয়।
* **প্রয়োজনীয় টেস্ট:** ক্যাশ বনাম অনলাইন পেমেন্ট মোডে ইনসার্ট করার পর ড্যাশবোর্ড সামারি কুয়েরির টেস্ট।
* **কমিট মেসেজ:** `feat(cashbook): build cashbook dashboard tab and IN/OUT calculator entry screen`
* **শেখার পয়েন্ট (React Native বনাম ওয়েব):**
  * হোম স্ক্রিনে `CUSTOMERS` এবং `CASHBOOK` ট্যাবের ভেতর সুইচ করার সময় স্ক্রল পজিশন ও পারফরম্যান্স ঠিক রাখতে নিচের ফিক্সড বাটনগুলো (`+ ADD CUSTOMER` বনাম `- OUT / + IN`) অ্যাক্টিভ ট্যাব অনুযায়ী কন্ডিশনালি রেন্ডার করা হয়।

#### [ ] CP12: ক্যাশবুক এন্ট্রি ডিটেইলস, এডিট, ডিলিট এবং আনডু (`/cashbook/entry/[entryId]`)
* **লক্ষ্য:** স্পেসের সেকশন ৩.৩ অনুযায়ী ক্যাশবুক এন্ট্রির ডিটেইলস স্ক্রিন, এডিট ফ্লো এবং ডিলিট কনফার্মেশন ও ৫-সেকেন্ড `UNDO` স্ন্যাকবার যুক্ত করা।
* **ধাপে ধাপে করণীয়:**
  1. `app/cashbook/entry/[entryId].tsx` তৈরি করা: এন্ট্রির ধরন (`- OUT` লাল বা `+ IN` সবুজ), সময় ও তারিখ, পেমেন্ট মোড (`Cash`/`Online`), টাকার পরিমাণ, বিবরণ, সিঙ্ক ব্যাকআপ ব্যাজ এবং `✎ EDIT ENTRY` ও `🗑️ DELETE` বাটন।
  2. `✎ EDIT ENTRY` চাপলে `/cashbook/entry-form?entryId=...` স্ক্রিনে প্রি-ফিল্ড অবস্থায় নিয়ে যাওয়া (যেখানে পেমেন্ট মোড `Cash` থেকে `Online` বা অ্যামাউন্ট পরিবর্তন করা যাবে)।
  3. `🗑️ DELETE` চাপলে `DeleteConfirmModal` (`"Delete the entry from this date?"`) দেখানো এবং কনফার্ম করলে সফট-ডিলিট করে ক্যাশবুক ট্যাবে ফিরে এসে `UndoSnackbar` দেখানো।
* **Done when (যাচাইযোগ্য শর্ত):**
  * ক্যাশবুক এন্ট্রি এডিট ও ডিলিট করলে ব্যালেন্স তাৎক্ষণিক পরিবর্তিত হয় এবং ৫ সেকেন্ডের মধ্যে `UNDO` চাপলে ডিলিট হওয়া এন্ট্রি ও আগের ব্যালেন্স ফিরে আসে।
* **প্রয়োজনীয় টেস্ট:** ক্যাশবুক এন্ট্রি এডিট (যেমন `Cash` থেকে `Online`-এ পরিবর্তন) ও Undo রিস্টোর টেস্ট।
* **কমিট মেসেজ:** `feat(cashbook): add cashbook entry details, edit flow, and delete with undo`
* **শেখার পয়েন্ট (Component Reuse in React Native):**
  * `CP08` ও `CP10`-এ বানানো `CalculatorKeypad`, `DeleteConfirmModal` এবং `UndoSnackbar` কম্পোনেন্টগুলো আমরা কোনো ডুপ্লিকেট কোড ছাড়াই ক্যাশবুকে পুনর্ব্যবহার করলাম।

### রিপোর্ট ও PDF জেনারেশন (Reports & PDF Export/Share)

#### [ ] CP13: কাস্টমার রিপোর্ট (`/customer/[id]/report`), সকল কাস্টমার রিপোর্ট (`/customer/report-all`) ও তারিখ রেঞ্জ ফিল্টার
* **লক্ষ্য:** স্পেসের সেকশন ২.৪ ও ৫.১ অনুযায়ী কাস্টমারের স্টেটমেন্ট রিপোর্ট স্ক্রিন (`START DATE` ও `END DATE` ক্যালেন্ডার মডাল, ডিউরেশন ড্রপডাউন, সার্চ, এবং `Net Balance / TOTAL / YOU GAVE / YOU GOT` সামারি স্ট্রিপ) এবং সকল কাস্টমারের সামগ্রিক রিপোর্ট স্ক্রিন তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `components/DateRangePickerModal.tsx` তৈরি করা (`Start Date` ও `End Date` ক্যালেন্ডার সিলেক্টর, নিচে `OK`, `CANCEL`, `REMOVE` বাটন এবং কুইক প্রিসেট: `All`, `This Month`, `Last Month`, `Today`, `Custom Date Range`)।
  2. `app/customer/[id]/report.tsx` তৈরি করা: তারিখ ফিল্টার ও `🔍 Search Entries` অনুযায়ী এন্ট্রিগুলো ফিল্টার করা, `startDate` থাকলে তার আগের লেনদেন থেকে `Opening Balance` হিসাব করা এবং সামারি স্ট্রিপে মোট এন্ট্রি সংখ্যা, মোট `YOU GAVE`, মোট `YOU GOT` ও `Net Balance` দেখানো।
  3. `app/customer/report-all.tsx` তৈরি করা: হোম সামারি কার্ডের `[PDF] View Reports >` বাটনে ট্যাপ করলে ব্যবসার সব কাস্টমারের সম্মিলিত লেনদেন ও ব্যালেন্স রিপোর্ট দেখানো।
* **Done when (যাচাইযোগ্য শর্ত):**
  * `01 OCT 26` থেকে নির্দিষ্ট তারিখ সিলেক্ট করলে শুধুমাত্র ওই সময়ের এন্ট্রি ও সামারি টোটাল দেখায় এবং `REMOVE` চাপলে আবার সব এন্ট্রি দেখায়।
* **প্রয়োজনীয় টেস্ট:** তারিখ রেঞ্জ ফিল্টার ও `Opening Balance` SQL কুয়েরির ইউনিট টেস্ট।
* **কমিট মেসেজ:** `feat(report): add customer statement report, all-customers report, and date range filter`
* **শেখার পয়েন্ট (SQL Date Filtering):**
  * আমরা যেহেতু `entry_date` কলামে ISO `'YYYY-MM-DD'` ফরম্যাটে লোকাল তারিখ স্টোর করেছি, তাই SQLite-এ `entry_date BETWEEN '2026-10-01' AND '2026-10-31'` লেক্সিকোগ্রাফিকাল (বর্ণানুক্রমিক) তুলনাতেই শতভাগ নিখুঁত ও ইনডেক্স-ফাস্ট কাজ করে।

#### [ ] CP14: ক্যাশবুক ডেইলি রিপোর্ট (`/cashbook/report`) এবং PDF স্টেটমেন্ট ডাউনলোড ও শেয়ার (`pdfGenerator.ts`)
* **লক্ষ্য:** স্পেসের সেকশন ২.৪.৪, ২.৪.৫, ৩.৪ এবং ৯.১ অনুযায়ী ক্যাশবুকের তারিখভিত্তিক (`DATE | DAILY BALANCE | TOTAL BALANCE`) রিপোর্ট স্ক্রিন এবং `expo-print` ও `expo-sharing` দিয়ে কাস্টমার ও ক্যাশবুক উভয়ের প্রফেশনাল PDF তৈরি, ডাউনলোড ও WhatsApp শেয়ার যুক্ত করা।
* **ধাপে ধাপে করণীয়:**
  1. `npx expo install expo-print expo-sharing expo-file-system` চালিয়ে প্যাকেজগুলো ইনস্টল করা।
  2. `app/cashbook/report.tsx` তৈরি করা: `START DATE` / `END DATE` এবং ডিউরেশন ড্রপডাউন (`THIS MONTH ▾`), নিচে ৩ কলামের টেবিল (`DATE` | `DAILY BALANCE` লাল/সবুজ/কালো | `TOTAL BALANCE >` ক্রমযোজিত ব্যালেন্স)। কোনো তারিখের রো-তে ট্যাপ করলে ওই দিনের ক্যাশবুক এন্ট্রিগুলো দেখানো।
  3. `utils/pdfGenerator.ts` তৈরি করা:
     * কাস্টমার রিপোর্টে `Download` বা `Share` চাপলে আগে বটম শিট পপআপ (`Include in report -> [✓] Entry Details -> OK`) দেখানো।
     * ব্যবসায়ের নাম, কাস্টমারের নাম, তারিখের সীমা, ৪ কলামের সামারি বক্স (`Opening Balance`, `Total Debit (-)`, `Total Credit (+)`, `Net Balance`) এবং হালকা গোলাপি Debit কলামসহ HTML টেবিল থেকে `Print.printToFileAsync()` দিয়ে পিডিএফ তৈরি করে ফোনে সেভ বা `Sharing.shareAsync()` দিয়ে শেয়ার করা।
     * ক্যাশবুক রিপোর্টের `[PDF] DOWNLOAD` বাটনেও একইভাবে মাসিক ক্যাশবুক পিডিএফ তৈরি ও শেয়ার করা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * কাস্টমার রিপোর্ট এবং ক্যাশবুক রিপোর্ট থেকে `Download` ও `Share` চাপলে বাংলা ও ইংরেজি ফন্ট এবং `৳`/`₹` সিম্বলসহ নিখুঁত PDF ফাইল তৈরি হয়ে ফোনে ওপেন ও শেয়ার হয়।
* **প্রয়োজনীয় টেস্ট:** `utils/__tests__/pdfGenerator.test.ts` — জেনারেট হওয়া HTML টেমপ্লেটে সঠিক ব্যালেন্স, কারেন্সি সিম্বল এবং `includeDetails: false` দিলে বিবরণ কলাম লুকানো থাকে কিনা তার টেস্ট।
* **কমিট মেসেজ:** `feat(pdf): implement cashbook daily report and pdf statement generator with share sheet`
* **শেখার পয়েন্ট (React Native বনাম ওয়েব):**
  * ওয়েবে `window.print()` বা `jspdf` ব্যবহার করা হয়। React Native-এ `expo-print` ওএস-এর নেটিভ WebView প্রিন্ট ইঞ্জিন (Android PrintManager / iOS UIPrintPageRenderer) ব্যবহার করে HTML+CSS স্ট্রিং থেকে সরাসরি ভেক্টর PDF ফাইল তৈরি করে—ফলে বাংলা যুক্তাক্ষর (`Noto Sans Bengali`) ভাঙার কোনো ভয় থাকে না।

### সুরক্ষা, সেটিংস ও ব্যাকআপ (Settings, Security & Local Backup)

#### [ ] CP15: বাংলা/ইংরেজি ভাষা (`i18n`) এবং কারেন্সি (`BDT ৳` / `INR ₹`) সেটিংস (`/more`)
* **লক্ষ্য:** স্পেসের সেকশন ৮.১.৩ ও ৯.১ অনুযায়ী `More / সেটিংস` ট্যাবে বাংলা (`bn`) ও ইংরেজি (`en`) ভাষা পরিবর্তন এবং বর্তমান ব্যবসার কারেন্সি (`BDT ৳` / `INR ₹`) টগল করার সুবিধা যুক্ত করা।
* **ধাপে ধাপে করণীয়:**
  1. `npx expo install expo-localization` এবং `npm install i18next react-i18next` ইনস্টল করে `i18n/bn.json`, `i18n/en.json` এবং `i18n/index.ts` কনফিগার করা।
  2. `app/(tabs)/more.tsx` স্ক্রিনে ব্যবসার নাম ও কারেন্সি (`BDT (৳)` / `INR (₹)`) পরিবর্তনের অপশন এবং অ্যাপের ভাষা (`বাংলা` / `English`) টগল যুক্ত করা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * সেটিংস থেকে ভাষা `বাংলা` বা `English` করলে সাথে সাথে অ্যাপের সব লেবেল পরিবর্তিত হয় এবং কারেন্সি `INR (₹)` করলে সব ব্যালেন্স `₹` চিহ্নে দেখায়।
* **প্রয়োজনীয় টেস্ট:** ভাষা ও কারেন্সি পরিবর্তনের ইন্টিগ্রেশন টেস্ট।
* **কমিট মেসেজ:** `feat(settings): add bengali/english localization and BDT/INR currency toggle in more tab`
* **শেখার পয়েন্ট (React Native Localization):**
  * ওয়েবে ব্রাউজার রিলোড করে ভাষা বদলানো গেলেও মোবাইলে ইউজার রিলোড ছাড়াই তাৎক্ষণিক ভাষা পরিবর্তন আশা করেন; `react-i18next`-এর `i18n.changeLanguage('bn')` রিঅ্যাক্ট কনটেক্সটের মাধ্যমে সব মাউন্টেড স্ক্রিন সাথে সাথে রি-রেন্ডার করে।

#### [ ] CP16: App PIN এবং Biometric (Fingerprint/FaceID) লক (`/lock`)
* **লক্ষ্য:** স্পেসের সেকশন ৫.১ ও ৮.১.১ অনুযায়ী ৪-ডিজিট PIN এবং ফিঙ্গারপ্রিন্ট/FaceID লক (`expo-local-authentication` + `expo-secure-store`) তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `npx expo install expo-local-authentication expo-secure-store` চালিয়ে প্যাকেজ দুটি ইনস্টল করা।
  2. `More` স্ক্রিনে App Lock অন/অফ এবং ৪-ডিজিট PIN সেট করার অপশন তৈরি করা (PIN টি `SecureStore`-এ সংরক্ষিত থাকবে)।
  3. `app/lock.tsx` তৈরি করা এবং `app/_layout.tsx`-এ `AppState` লিসেনার (`active` বনাম `background`) বসানো—যাতে অ্যাপ ওপেন করলে বা ব্যাকগ্রাউন্ড থেকে ফোরগ্রাউন্ডে ফিরলে পিন বা বায়োমেট্রিক ভেরিফিকেশন ছাড়া খাতা দেখা না যায়।
* **Done when (যাচাইযোগ্য শর্ত):**
  * App Lock চালু করার পর অ্যাপ ক্লোজ করে আবার ওপেন করলে `/lock` স্ক্রিন আসে এবং সঠিক PIN বা ফিঙ্গারপ্রিন্ট দিলে আনলক হয়।
* **প্রয়োজনীয় টেস্ট:** PIN সেট, ভেরিফাই ও ভুল PIN দিলে ব্লক করার ইউনিট টেস্ট।
* **কমিট মেসেজ:** `feat(security): implement 4-digit pin and biometric app lock guard`
* **শেখার পয়েন্ট (React Native AppState Lifecycle):**
  * ওয়েবে `document.visibilityState` থাকে, আর React Native-এ `AppState.addEventListener('change', nextState => ...)` দিয়ে অ্যাপ কখন ব্যাকগ্রাউন্ডে (`background`) গেছে আর কখন আবার ওপেন (`active`) হয়েছে তা ট্র্যাক করা হয়।

#### [ ] CP17: লোকাল ব্যাকআপ ও রিস্টোর (`.db` ফাইল + `PRAGMA user_version` গার্ড এবং CSV/JSON এক্সপোর্ট/ইমপোর্ট)
* **লক্ষ্য:** স্পেসের সেকশন ৬.৩ ও ৮.১.২ অনুযায়ী সম্পূর্ণ অফলাইনে `.db` ফাইল ব্যাকআপ ও রিস্টোর (ভার্সন চেকসহ) এবং JSON/CSV এক্সপোর্ট ও ইমপোর্ট তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `npx expo install expo-document-picker` চালিয়ে `db/backupService.ts` তৈরি করা।
  2. **Export Backup:** এক ক্লিকে বর্তমান SQLite `.db` ফাইল (`WAL` চেকপয়েন্ট `PRAGMA wal_checkpoint(TRUNCATE)` করার পর) অথবা সম্পূর্ণ ডেটার JSON/CSV ফাইল তৈরি করে `Sharing.shareAsync()` দিয়ে Google Drive/WhatsApp/Files-এ সেভ করার অপশন।
  3. **Restore `.db` Backup with Version Guard:** `DocumentPicker` দিয়ে ইউজার `.db` ফাইল সিলেক্ট করলে সেটি আগে অস্থায়ী ফাইলে (`temp_restore.db`) কপি করে ওপেন করা, `PRAGMA integrity_check` ও `PRAGMA user_version` চেক করা:
     * যদি `user_version > LATEST_SCHEMA_VERSION` হয়, তবে **রিস্টোর ব্লক করে সতর্কবার্তা দেখানো**।
     * যদি `user_version <= LATEST_SCHEMA_VERSION` হয়, তবে মূল ডাটাবেজে রিস্টোর করে `runMigrations()` চালানো এবং সব কাস্টমারের `recomputeBalance()` রান করা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * ডেটা ব্যাকআপ নিয়ে অ্যাপের ডেটা মুছে আবার রিস্টোর করলে সব ব্যবসা, কাস্টমার ও ক্যাশবুক এন্ট্রি হুবহু ফিরে আসে; এবং বেশি `user_version`-এর ডামি `.db` ফাইল দিলে রিস্টোর ব্লক করে সতর্কবার্তা দেয়।
* **প্রয়োজনীয় টেস্ট:** `db/__tests__/backupService.test.ts` — JSON এক্সপোর্ট/ইমপোর্ট, পুরনো ভার্সনের ডিবি মাইগ্রেট রিস্টোর এবং নতুন ভার্সনের ডিবি (`user_version = 99`) ব্লক টেস্ট।
* **কমিট মেসেজ:** `feat(backup): add local sqlite db backup/restore with user_version guard and json/csv export`
* **শেখার পয়েন্ট (SQLite WAL Checkpoint Before Copy):**
  * SQLite যখন `WAL (Write-Ahead Logging)` মোডে চলে, তখন সাম্প্রতিক কিছু এন্ট্রি মূল `.db` ফাইলের বদলে `.db-wal` ফাইলে থাকে। তাই `.db` ফাইল কপি করার ঠিক আগে `PRAGMA wal_checkpoint(TRUNCATE);` চালানো বাধ্যতামূলক—নতুবা সর্বশেষ এন্ট্রিগুলো ব্যাকআপ ফাইলে যাবে না!

#### [ ] CP18: Phase 1 QA, Empty States, Edge-Case Audit এবং MVP Gate (`v1.0.0-mvp`)
* **লক্ষ্য:** স্পেসের সেকশন ৮.১-এর সব Must-Have শর্ত, Empty States এবং ইনপুট ভ্যালিডেশন এজ-কেস যাচাই করে Phase 1 লোকাল MVP চূড়ান্ত করা।
* **ধাপে ধাপে করণীয়:**
  1. কাস্টমার লিস্ট, কাস্টমার লেজার এবং ক্যাশবুকে কোনো ডেটা না থাকলে পরিষ্কার বাংলা/ইংরেজি ভিজ্যুয়াল Empty State যোগ করা।
  2. সব ভ্যালিডেশন চেক লিস্ট মিলিয়ে দেখা: `amount > 0`, `amount <= 99,99,99,999.99`, `entry_date <= today`, `ABS(balance) < 0.005` হলে `Settled Up`।
  3. সম্পূর্ণ টেস্ট স্যুট (`npm test`) এবং টাইপচেক (`npx tsc --noEmit`) রান করা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * সব টেস্ট পাস করে এবং অফলাইনে দুই মডিউলের (`CUSTOMERS` ও `CASHBOOK`) ১৪টি রাউটই কোনো বাগ ছাড়া কাজ করে।
* **প্রয়োজনীয় টেস্ট:** ফুল Phase 1 টেস্ট স্যুট রান।
* **কমিট মেসেজ:** `chore(mvp): complete phase 1 empty states, validation audit, and mvp verification`
  *(মাইলস্টোন ট্যাগ: `git tag v1.0.0-mvp`)*
* **শেখার পয়েন্ট:** বড় অ্যাপে ক্লাউড সিঙ্ক যোগ করার আগে লোকাল স্টেট মেশিন ও ডাটাবেজ ১০০% বাগ-মুক্ত করে ট্যাগ (`v1.0.0-mvp`) করে রাখলে পরবর্তীতে সিঙ্ক বাগ ডিবাগ করা অনেক সহজ হয়।

## ৩. Phase 2 Checkpoints: Custom Node.js + Express + Prisma + PostgreSQL Backend & Sync

### API ভিত্তি ও সার্ভার স্কিমা (Backend Foundation & PostgreSQL Schema)

#### [ ] CP19: `apps/api` Node.js + Express + TypeScript প্রজেক্ট সেটআপ, Docker Postgres এবং Pino/Helmet/Zod ভিত্তি
* **লক্ষ্য:** স্পেসের সেকশন ৭.১, ৭.৬ ও ৯.৩ অনুযায়ী `apps/api` ব্যাকএন্ড প্রজেক্ট, লোকাল ডেভেলপমেন্ট ও টেস্টের জন্য `docker-compose.yml` (PostgreSQL 16), এবং Express অ্যাপের কোর মিডলওয়্যার তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `apps/api` ফোল্ডারে TypeScript, `express`, `cors`, `helmet`, `pino`, `pino-http`, `zod`, `express-rate-limit` এবং ডেভ-ডিপেন্ডেন্সি হিসেবে `vitest`, `supertest`, `tsx` ইনস্টল করা।
  2. `apps/api/docker-compose.yml` তৈরি করা (ডেভেলপমেন্ট DB পোর্ট `5432` এবং ইন্টিগ্রেশন টেস্ট DB পোর্ট `5433` সহ)।
  3. `src/config/env.ts` (Zod দিয়ে `DATABASE_URL`, `JWT_ACCESS_SECRET` ইত্যাদি ভ্যালিডেশন), `src/index.ts` (Express app + `/health` এন্ডপয়েন্ট + BigInt JSON সিরিয়ালাইজেশন হেল্পার) তৈরি করা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * `docker compose up -d` দিলে Postgres কন্টেইনার চালু হয় এবং `GET /health` কল করলে `200 OK` (`{ "status": "ok" }`) রিটার্ন করে।
* **প্রয়োজনীয় টেস্ট:** `tests/health.test.ts` — `/health` এন্ডপয়েন্ট ও সিকিউরিটি হেডার টেস্ট।
* **কমিট মেসেজ:** `feat(api): scaffold express typescript backend with docker postgres, pino, and zod env`
* **শেখার পয়েন্ট (Backend Insight):**
  * Express অ্যাপ তৈরি (`src/app.ts`) এবং সার্ভার লিসেনিং (`src/server.ts`) আলাদা ফাইলে রাখলে `supertest` দিয়ে ইন্টিগ্রেশন টেস্ট চালানোর সময় পোর্ট কনফ্লিক্ট ছাড়াই সরাসরি `app` ইন্সট্যান্স টেস্ট করা যায়।

#### [ ] CP20: Prisma PostgreSQL স্কিমা (`NUMERIC(14,2)`), `server_updated_at` DB Trigger এবং মাইগ্রেশন
* **লক্ষ্য:** স্পেসের সেকশন ৭.৪ অনুযায়ী ৭টি সার্ভার টেবিল (`users`, `refresh_tokens`, `devices`, `businesses`, `customers`, `customer_entries`, `cashbook_entries`), কম্পোজিট কার্সর ইনডেক্স এবং PostgreSQL `set_server_updated_at()` ট্রিগার মাইগ্রেশন তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `apps/api/prisma/schema.prisma`-এ স্পেসের ৭.৪ সেকশনের সম্পূর্ণ স্কিমা লেখা (অ্যামাউন্ট `@db.Decimal(14, 2)`, `customers` টেবিলে কোনো `net_balance` নেই, এবং প্রতিটি সিঙ্ক টেবিলে `@@index([businessId, serverUpdatedAt, id])`)।
  2. `npx prisma migrate dev --name init_schema --create-only` চালিয়ে জেনারেটেড SQL ফাইলের নিচে `set_server_updated_at()` PL/pgSQL ফাংশন এবং ৪টি টেবিলের `BEFORE INSERT OR UPDATE` ট্রিগার যোগ করে মাইগ্রেশন অ্যাপ্লাই করা।
  3. প্রতিটি Prisma মডেলের পাশে সমতুল্য Raw SQL কমেন্টে লিখে রাখা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * মাইগ্রেশন সফলভাবে রান করে এবং টেস্টে কোনো রো ইনসার্ট বা আপডেট করলে PostgreSQL স্বয়ংক্রিয়ভাবে `server_updated_at = clock_timestamp()` আপডেট করে।
* **প্রয়োজনীয় টেস্ট:** `tests/schema.integration.test.ts` — রো আপডেট করলে `server_updated_at` স্বয়ংক্রিয়ভাবে বাড়ে কিনা এবং `Decimal(14,2)` নিখুঁতভাবে ২ দশমিক ঘর রাখে কিনা তার টেস্ট।
* **কমিট মেসেজ:** `feat(api-db): add prisma postgresql schema and server_updated_at plpgsql triggers`
* **শেখার পয়েন্ট (Prisma বনাম Raw SQL Trigger):**
  * Prisma-এর `@updatedAt` শুধুমাত্র Prisma Client-এর ভেতর দিয়ে কুয়েরি চালালে কাজ করে; কিন্তু আমরা যখন বাল্ক সিঙ্কের জন্য Raw SQL (`INSERT ... ON CONFLICT DO UPDATE`) চালাব, তখন ডাটাবেজ লেভেলের PostgreSQL Trigger (`BEFORE INSERT OR UPDATE`) গ্যারান্টি দেয় যে কোনো রো-তেই `server_updated_at` মিস হবে না।

### Auth ও Ownership Middleware (Authentication & Authorization)

#### [ ] CP21: Email/Password (`argon2`), Google ID Token Verify এবং Refresh Token Rotation (`/auth/*`)
* **লক্ষ্য:** স্পেসের সেকশন ৭.২ ও ৭.৫.১ অনুযায়ী `POST /auth/register`, `POST /auth/login`, `POST /auth/google`, এবং `POST /auth/refresh` এন্ডপয়েন্ট ও ডিভাইস রেজিস্ট্রেশন তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `argon2`, `jsonwebtoken`, ও `google-auth-library` ইনস্টল করা।
  2. `src/auth/auth.service.ts` তৈরি করা (প্রতিটি Prisma কুয়েরির পাশে সমতুল্য Raw SQL কমেন্টসহ):
     * ইমেইল/পাসওয়ার্ড রেজিস্ট্রেশন ও লগইন (`argon2.hash` ও `argon2.verify`)।
     * Google `idToken` ভেরিফিকেশন (`OAuth2Client.verifyIdToken`)।
     * লগইনের সময় `devices` টেবিলে ক্লায়েন্টের `deviceId` আপসার্ট করা।
     * ১৫ মিনিটের JWT Access Token এবং ৩০ দিনের Refresh Token (SHA-256 হ্যাশ করে `refresh_tokens` টেবিলে সেভ) জেনারেট করা এবং `/auth/refresh`-এ পুরনো টোকেন `revoked_at = now()` করে নতুন টোকেন দেওয়া (**Refresh Token Rotation**)।
* **Done when (যাচাইযোগ্য শর্ত):**
  * রেজিস্টার, লগইন, গুগল মক ভেরিফাই এবং রিফ্রেশ টোকেন রোটেশনের সব ইন্টিগ্রেশন টেস্ট পাস করে (একই রিফ্রেশ টোকেন দ্বিতীয়বার ব্যবহার করলে `401 Unauthorized` দেয়)।
* **প্রয়োজনীয় টেস্ট:** `tests/auth.integration.test.ts` — রেজিস্টার, ভুল পাসওয়ার্ড, রিফ্রেশ টোকেন রোটেশন এবং রেট লিমিটার টেস্ট।
* **কমিট মেসেজ:** `feat(api-auth): implement register, login, google id-token auth, and refresh token rotation`
* **শেখার পয়েন্ট (Security Insight):**
  * ডাটাবেজে কখনোই কাঁচা (Plaintext) Refresh Token স্টোর করা উচিত নয়; পাসওয়ার্ডের মতোই Refresh Token-এর SHA-256 হ্যাশ স্টোর করলে ডাটাবেজ ডাম্প ফাঁস হলেও হ্যাকার কোনো সেশন হাইজ্যাক করতে পারবে না।

#### [ ] CP22: JWT Auth Middleware এবং `business_id` Ownership Authorization Middleware
* **লক্ষ্য:** স্পেসের সেকশন ৭.২ অনুযায়ী প্রতিটি প্রোটেক্টেড রিকোয়েস্টে JWT যাচাই এবং রিকোয়েস্টে থাকা সব `business_id` ওই ইউজারের মালিকানাধীন কিনা তা যাচাই করার মিডলওয়্যার তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `src/middleware/authMiddleware.ts` তৈরি করা: `Authorization: Bearer <token>` থেকে `req.userId` ভেরিফাই করা।
  2. `src/middleware/ownershipMiddleware.ts` তৈরি করা (সমতুল্য Raw SQL কমেন্টসহ): রিকোয়েস্টের বডি বা কুয়েরিতে থাকা সমস্ত `businessId` বের করে ডাটাবেজে চেক করা—যদি একটিও অন্য ইউজারের হয়, তবে সাথে সাথে `403 Forbidden` দেওয়া।
* **Done when (যাচাইযোগ্য শর্ত):**
  * ইউজার A হয়ে ইউজার B-এর `businessId`-তে ডেটা পুশ বা পুল করার চেষ্টা করলে সার্ভার `403 Forbidden` রিটার্ন করে।
* **প্রয়োজনীয় টেস্ট:** `tests/ownership.integration.test.ts` — বৈধ বনাম অন্য ইউজারের `businessId` অ্যাক্সেস টেস্ট।
* **কমিট মেসেজ:** `feat(api-auth): add jwt verification and business_id ownership authorization middleware`
* **শেখার পয়েন্ট (Application Middleware vs DB RLS):**
  * প্রতি রো-তে ডাটাবেজ RLS চালানোর বদলে রিকোয়েস্টের শুরুতে একবার `SELECT id FROM businesses WHERE id = ANY($1) AND owner_user_id = $2` চালিয়ে ওনারশিপ ভেরিফাই করে নিলে পরের সব বাল্ক কুয়েরি পূর্ণ গতিতে চলে।

### সিঙ্ক সার্ভার (Sync Push, Pull & Tombstone Purge)

#### [ ] CP23: Batch Push Endpoint (`POST /sync/push`) — FK ক্রম, LWW Conflict, Clock Drift Clamp ও Idempotency
* **লক্ষ্য:** স্পেসের সেকশন ৭.৩.১, ৭.৩.৩ ও ৭.৫.২ অনুযায়ী এক ট্রানজেকশনে সর্বোচ্চ ২০০ রো-এর ব্যাচ পুশ, ঘড়ি এগিয়ে থাকার ক্ল্যাম্পিং, Last-Write-Wins কনফ্লিক্ট রেজোলিউশন এবং `accepted` ও `rejectedConflicts` রেসপন্স তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `src/sync/sync.schema.ts`-এ `POST /sync/push`-এর Zod ভ্যালিডেশন স্কিমা লেখা (মোট রো $\le 200$, অ্যামাউন্ট ২ দশমিক ঘর, বৈধ UUID)।
  2. `src/sync/sync.service.ts`-এ `processPushBatch()` লেখা (Prisma ও Raw SQL উভয় কোড ও কমেন্টসহ):
     * **Clock Drift Clamp:** ক্লায়েন্টের `updatedAt > serverNowMs + 5 * 60 * 1000` হলে সেটিকে `serverNowMs`-এ সীমাবদ্ধ করা।
     * **Strict FK Order:** একটি ডাটাবেজ ট্রানজেকশনের (`prisma.$transaction`) ভেতরে পর্যায়ক্রমে `1. businesses` $\rightarrow$ `2. customers` $\rightarrow$ `3. customer_entries` $\rightarrow$ `4. cashbook_entries` প্রসেস করা।
     * **LWW & Idempotency:** যদি সার্ভারে ওই `id` আগে না থাকে বা `incoming.updatedAt >= existing.updatedAt` হয়, তবে আপসার্ট করে `accepted` তালিকায় যোগ করা; আর যদি `existing.updatedAt > incoming.updatedAt` হয়, তবে আপডেট না করে সার্ভারের বর্তমান রো-টি `rejectedConflicts` তালিকায় যোগ করা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * নতুন এন্ট্রি পুশ, একই রিকোয়েস্ট দ্বিতীয়বার পুশ (Idempotent), এবং পুরনো `updatedAt` দিয়ে পুশ করলে `rejectedConflicts`-এ সার্ভারের জয়ী রো ফিরে আসার ইন্টিগ্রেশন টেস্ট পাস করে।
* **প্রয়োজনীয় টেস্ট:** `tests/sync-push.integration.test.ts` — (১) FK ক্রম মেনে ৪ টেবিল ইনসার্ট, (২) Idempotent retry, (৩) LWW conflict রেজোলিউশন, (৪) Future clock drift clamp টেস্ট।
* **কমিট মেসেজ:** `feat(api-sync): implement idempotent batch push with fk ordering, clock clamp, and lww conflict resolution`
* **শেখার পয়েন্ট (Prisma vs Raw SQL Upsert):**
  * সাধারণ `prisma.customerEntry.upsert()`-এ `ON CONFLICT DO UPDATE WHERE EXCLUDED.updated_at >= customer_entries.updated_at` শর্ত দেওয়া যায় না। তাই কন্ডিশনাল LWW আপসার্টের জন্য Raw SQL (`INSERT ... ON CONFLICT (id) DO UPDATE ... WHERE ...`) ব্যবহার করা সবচেয়ে পরিচ্ছন্ন ও দ্রুত।

#### [ ] CP24: Paginated Pull Endpoint (`GET /sync/pull`), `(server_updated_at, id)` Cursor, `410 Gone` ও Tombstone Purge
* **লক্ষ্য:** স্পেসের সেকশন ৭.৩.১, ৭.৩.২ ও ৭.৫.৩ অনুযায়ী সার্ভার-টাইম কার্সর পেজিনেশন, `devices` টেবিলের কার্সর আপডেট, ৯০ দিনের পুরনো কার্সরে `410 Gone` এবং নিরাপদ Tombstone Purge ফাংশন তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `src/sync/sync.service.ts`-এ `processPull()` লেখা (সমতুল্য Raw SQL কমেন্টসহ):
     * কার্সর ভ্যালিডেশন: যদি কার্সরের টাইমস্ট্যাম্প বর্তমান সার্ভার সময় থেকে ৯০ দিনের বেশি পুরনো হয় (`cursorTs < now() - 90 days`), তবে সাথে সাথে **`HTTP 410 Gone` (`CURSOR_EXPIRED_FULL_RESYNC_REQUIRED`)** রিটার্ন করা।
     * অন্যথায় ইউজারের মালিকানাধীন ব্যবসায়ের ডেটা `(server_updated_at, id) > (:cursorTs, :cursorId)` শর্তে এবং `ORDER BY server_updated_at ASC, id ASC` ক্রমে `limit` অনুযায়ী ফেচ করা (`hasMore` ও `nextCursor` সহ)।
     * পুল সফল হলে `devices` টেবিলে ওই `deviceId`-এর `last_pulled_cursor`, `last_pulled_at`, ও `last_seen_at` আপডেট করা।
  2. `purgeTombstones()` ফাংশন লেখা: যা শুধুমাত্র সেইসব `is_deleted = true` রো ফিজিক্যালি ডিলিট করবে যেগুলোর `server_updated_at` ওই ইউজারের সব সক্রিয় ডিভাইসের `MIN(last_pulled_at)`-এর চেয়ে পুরনো অথবা ৯০ দিন পার হয়ে গেছে।
* **Done when (যাচাইযোগ্য শর্ত):**
  * ক্লায়েন্টের ঘড়ি পিছিয়ে থাকা সত্ত্বেও এডিট করা রো অন্য ডিভাইসের Pull-এ ঠিকমতো আসে, `limit` ছোট দিলে `hasMore: true` ও `nextCursor` দিয়ে পেজিনেশন কাজ করে, এবং ৯১ দিনের পুরনো কার্সর পাঠালে `410 Gone` রিটার্ন করে।
* **প্রয়োজনীয় টেস্ট:** `tests/sync-pull.integration.test.ts` — (১) ঘড়ি পিছিয়ে থাকা ডিভাইসের এডিট পুল হওয়া, (২) মাল্টি-পেজ কার্সর পেজিনেশন, (৩) `410 Gone` রেসপন্স, এবং (৪) মাল্টি-ডিভাইস Tombstone Purge টেস্ট।
* **কমিট মেসেজ:** `feat(api-sync): implement server_updated_at cursor pull, 410 gone guard, and device-aware tombstone purge`
* **শেখার পয়েন্ট (Tuple Cursor Pagination):**
  * SQL-এ `OFFSET` পেজিনেশন ব্যবহার করলে মাঝখানে নতুন রো ঢুকলে রো ডুপ্লিকেট বা স্কিপ হয় এবং হাজারতম পেজে কুয়েরি স্লো হয়ে যায়। কিন্তু PostgreSQL-এর Row Value সংযুক্ত তুলনা `WHERE (server_updated_at, id) > ($1::timestamptz, $2::uuid)` কম্পোজিট B-Tree ইনডেক্স ব্যবহার করে সবসময় $O(\log N)$ সময়ে নিখুঁত পরের পেজ দেয়।

#### [ ] CP25: OpenAPI 3.1 ডকুমেন্টেশন (`/docs`) এবং Backend Engineering Checklist পূর্ণাঙ্গ যাচাই (`v1.5.0-api`)
* **লক্ষ্য:** স্পেসের সেকশন ৭.৬ অনুযায়ী `/docs` রাউটে Swagger/OpenAPI ডকুমেন্টেশন যুক্ত করা এবং সম্পূর্ণ ব্যাকএন্ড টেস্ট স্যুট রান করে API মাইলস্টোন সম্পন্ন করা।
* **ধাপে ধাপে করণীয়:**
  1. `src/docs/openapi.ts` তৈরি করে `/auth/*` এবং `/sync/*` এন্ডপয়েন্টগুলোর OpenAPI 3.1 স্পেক ও `/docs` UI রাউট যুক্ত করা।
  2. রেট লিমিটার, স্ট্রাকচার্ড লগিং (পাসওয়ার্ড/টোকেন রেডাকশনসহ) এবং সব ইন্টিগ্রেশন টেস্ট একসাথে রান করে যাচাই করা।
* **Done when (যাচাইযোগ্য শর্ত):**
  * ব্রাউজারে `http://localhost:4000/docs` ওপেন করলে সম্পূর্ণ API ডক দেখা যায় এবং `npm test` (সব ইন্টিগ্রেশন টেস্টসহ) ১০০% পাস করে।
* **প্রয়োজনীয় টেস্ট:** ফুল API ইন্টিগ্রেশন টেস্ট স্যুট।
* **কমিট মেসেজ:** `docs(api): add openapi 3.1 specification and complete backend engineering checklist`
  *(মাইলস্টোন ট্যাগ: `git tag v1.5.0-api`)*
* **শেখার পয়েন্ট:** মোবাইল অ্যাপে সিঙ্ক ক্লায়েন্ট লেখার আগে ব্যাকএন্ডের ইন্টিগ্রেশন টেস্ট ও Swagger ডক রেডি থাকলে ফ্রন্টএন্ড-ব্যাকএন্ড ইন্টিগ্রেশনে কোনো অনুমানের ওপর নির্ভর করতে হয় না।

### মোবাইল সিঙ্ক ক্লায়েন্ট (Mobile Sync Client & Auth Integration)

#### [ ] CP26: মোবাইল Auth স্ক্রিন, টোকেন রোটেশন ক্লায়েন্ট এবং প্রথম লগইনে `owner_user_id` বাইন্ডিং
* **লক্ষ্য:** স্পেসের সেকশন ৭.২ ও ৯.১ অনুযায়ী মোবাইল অ্যাপের `More -> Cloud Sync` থেকে লগইন/রেজিস্টার করা, `expo-secure-store`-এ টোকেন রাখা ও অটো-রিফ্রেশ করা এবং প্রথমবার লগইনে লোকাল ব্যবসাগুলো ইউজারের অ্যাকাউন্টে যুক্ত করা।
* **ধাপে ধাপে করণীয়:**
  1. `services/apiClient.ts` তৈরি করা: যা প্রতিটি রিকোয়েস্টে `accessToken` যুক্ত করে এবং `401` পেলে স্বয়ংক্রিয়ভাবে `/auth/refresh` কল করে নতুন টোকেন নিয়ে রিকোয়েস্ট রিট্রাই করে।
  2. `app/auth/login.tsx` তৈরি করা (Google Sign-In বাটন ও Email/Password ফর্ম)।
  3. প্রথমবার লগইন সফল হওয়ার সাথে সাথে লোকাল SQLite-এ `UPDATE businesses SET owner_user_id = ?, is_synced = 0, updated_at = ? WHERE owner_user_id IS NULL;` চালানো।
* **Done when (যাচাইযোগ্য শর্ত):**
  * মোবাইল অ্যাপ থেকে রেজিস্টার/লগইন করলে টোকেন সেভ হয় এবং ফেজ ১-এ তৈরি করা লোকাল ব্যবসাগুলোর `owner_user_id` আপডেট হয়ে সিঙ্কের জন্য প্রস্তুত (`is_synced = 0`) হয়।
* **প্রয়োজনীয় টেস্ট:** প্রথম লগইনে লোকাল ডেটা বাইন্ডিং ও টোকেন অটো-রিফ্রেশের ইউনিট টেস্ট।
* **কমিট মেসেজ:** `feat(mobile-auth): add auth screen, token refresh interceptor, and first-login business binding`
* **শেখার পয়েন্ট (React Native বনাম ওয়েব):**
  * ওয়েবে রিফ্রেশ টোকেন সাধারণত `HttpOnly Cookie`-তে রাখা হয়; কিন্তু নেটিভ মোবাইল অ্যাপে ব্রাউজার কুকি জার নির্ভরযোগ্য নয়—তাই OS Keychain / Keystore-ভিত্তিক এনক্রিপ্টেড `expo-secure-store`-এ টোকেন সংরক্ষণ করা স্ট্যান্ডার্ড নিয়ম।

#### [ ] CP27: মোবাইল `syncService.ts` (`SyncTransport` ইন্টারফেস, Batch Push ও Cursor Pull Orchestrator)
* **লক্ষ্য:** স্পেসের সেকশন ৬.৩, ৬.৫.৩, ৭.৩ ও ৯.১ অনুযায়ী মোবাইলে `SyncTransport` ইন্টারফেসের পেছনে সম্পূর্ণ Push এবং Pull সিঙ্ক ইঞ্জিন তৈরি করা।
* **ধাপে ধাপে করণীয়:**
  1. `db/syncService.ts`-এ `SyncTransport` ইন্টারফেস এবং `HttpSyncTransport` ইমপ্লিমেন্ট করা।
  2. **Push Flow (`pushPendingChanges`):** লোকাল SQLite থেকে `WHERE is_synced = 0` রো-গুলো FK ক্রম মেনে সর্বোচ্চ ২০০টি করে ব্যাচ আকারে তোলা (`customers` থেকে `net_balance` ও `last_transaction_at` বাদ দিয়ে), নতুন `Idempotency-Key` দিয়ে পুশ করা, এবং রেসপন্সের `accepted` রো-গুলোকে `is_synced = 1` করা ও `rejectedConflicts` রো-গুলোকে সার্ভারের জয়ী ডেটা দিয়ে লোকালে আপডেট করে `is_synced = 1` করা।
  3. **Pull Flow (`pullRemoteChanges`):** `sync_state` থেকে `last_pulled_cursor` নিয়ে `hasMore === false` না হওয়া পর্যন্ত লুপে পুল করা, লোকাল SQLite ট্রানজেকশনে আপসার্ট করা (`is_synced = 1`), এবং শেষে প্রভাবিত কাস্টমারদের `recomputeBalance()` চালানো (যা `updated_at` বা `is_synced` বদলাবে না)।
* **Done when (যাচাইযোগ্য শর্ত):**
  * ফোন ১-এ কাস্টমার ও এন্ট্রি যোগ/এডিট/ডিলিট করে সিঙ্ক করলে তা সার্ভারে যায় এবং ফোন ২-এ (বা অন্য ইমুলেটরে) সিঙ্ক করলে হুবহু সব ডেটা ও ব্যালেন্স চলে আসে।
* **প্রয়োজনীয় টেস্ট:** `db/__tests__/syncService.test.ts` (`better-sqlite3` ইন-মেমোরি ডিবি + মক `SyncTransport`) — Push ব্যাচিং, LWW conflict রেজোলিউশন, Pull পেজিনেশন এবং পুল শেষে `recomputeBalance()` টেস্ট।
* **কমিট মেসেজ:** `feat(mobile-sync): implement syncService push/pull orchestrator and local balance recomputation`
* **শেখার পয়েন্ট (Offline-First Architecture):**
  * UI কম্পোনেন্টগুলো কখনোই সরাসরি API কল করে না; UI সবসময় লোকাল SQLite থেকে পড়ে ও লেখে, আর `syncService` ব্যাকগ্রাউন্ডে SQLite ও সার্ভারের মধ্যে ডেটা আদান-প্রদান করে।

#### [ ] CP28: মোবাইল `410 Gone` ফুল-রিসিঙ্ক হ্যান্ডলার এবং সিঙ্ক স্ট্যাটাস UI ব্যাজ
* **লক্ষ্য:** স্পেসের সেকশন ৩.৩.২ ও ৭.৩.২ অনুযায়ী `410 Gone` পেলে নিরাপদে ফুল-রিসিঙ্ক করা এবং টপ অ্যাপ বার ও এন্ট্রি ডিটেইলসে সিঙ্ক স্ট্যাটাস (`Entry is backed up` / `Entry is not backed up`) দেখানো।
* **ধাপে ধাপে করণীয়:**
  1. `syncService.ts`-এ `410 Gone` হ্যান্ডলার যোগ করা: পুল করার সময় সার্ভার `410` দিলে আগে নিজের সব `is_synced = 0` রো পুশ করা, এরপর লোকাল সিঙ্কড রো (`is_synced = 1`) ক্লিয়ার করে `last_pulled_cursor = null` দিয়ে শুরু থেকে ফ্রেশ পুল করা এবং সব কাস্টমারের `recomputeBalance()` চালানো।
  2. হোম টপ বারে সিঙ্ক বাটন/ব্যাজ এবং এন্ট্রি ডিটেইলস স্ক্রিনে `is_synced === 1` হলে `☁️✓ Entry is backed up` ও `0` হলে `🔄 Entry is not backed up` দেখানো।
* **Done when (যাচাইযোগ্য শর্ত):**
  * কার্সর এক্সপায়ার্ড (`410 Gone`) সিমুলেট করলে কোনো আনসিঙ্কড লোকাল এন্ট্রি না হারিয়েই পুরো ডাটাবেজ শুরু থেকে রিসিঙ্ক হয়ে যায়।
* **প্রয়োজনীয় টেস্ট:** `db/__tests__/sync410Resync.test.ts` — আনসিঙ্কড লোকাল এন্ট্রি থাকা অবস্থায় `410 Gone` এলে ডেটা লস ছাড়া ফুল-রিসিঙ্ক টেস্ট।
* **কমিট মেসেজ:** `feat(mobile-sync): add 410 gone full-resync recovery and sync status ui indicators`
* **শেখার পয়েন্ট:** ডিস্ট্রিবিউটেড সিস্টেমে ইভেন্ট লগ বা Tombstone চিরকাল রাখা যায় না; `410 Gone` + আনসিঙ্কড পুশ + ফ্রেশ স্ন্যাপশট পুল হলো অফলাইন অ্যাপগুলোর (যেমন Linear বা Notion) স্ট্যান্ডার্ড রিকভারি প্যাটার্ন।

### প্রোডাকশন হার্ডেনিং ও রিলিজ (Production Hardening & CI/CD)

#### [ ] CP29: Docker প্রোডাকশন ইমেজ, GitHub Actions CI, এবং EAS Build কনফিগারেশন (`v2.0.0`)
* **লক্ষ্য:** স্পেসের সেকশন ৭.৬ ও ৯.২ অনুযায়ী ব্যাকএন্ডের মাল্টি-স্টেজ `Dockerfile`, GitHub Actions CI পাইপলাইন এবং মোবাইল অ্যাপের Android (`.apk`/`.aab`) ও iOS (`.ipa`) ক্লাউড বিল্ডের জন্য `eas.json` চূড়ান্ত করা।
* **ধাপে ধাপে করণীয়:**
  1. `apps/api/Dockerfile` (multi-stage build) এবং `.github/workflows/ci.yml` তৈরি করা (যা প্রতিটি পুশে মোবাইল ও ব্যাকএন্ডের `tsc --noEmit`, `prisma validate`, এবং সব টেস্ট রান করবে)।
  2. `apps/mobile/eas.json` তৈরি করা (`development`, `preview` APK, এবং `production` প্রোফাইলসহ)।
* **Done when (যাচাইযোগ্য শর্ত):**
  * `docker build` সফলভাবে সম্পন্ন হয় এবং মোবাইল ও ব্যাকএন্ড উভয় প্রজেক্টের সব টেস্ট ও টাইপচেক ১০০% পাস করে।
* **প্রয়োজনীয় টেস্ট:** সম্পূর্ণ Monorepo টেস্ট ও বিল্ড ভেরিফিকেশন।
* **কমিট মেসেজ:** `chore(release): add production dockerfile, github actions ci, and eas build config`
  *(চূড়ান্ত মাইলস্টোন ট্যাগ: `git tag v2.0.0`)*
* **শেখার পয়েন্ট:** `eas.json`-এ `preview` প্রোফাইলে `"android": { "buildType": "apk" }` দিলে প্লে স্টোরে আপলোড ছাড়াই সরাসরি ফোনে ইনস্টলযোগ্য `.apk` ফাইল ক্লাউডে তৈরি করে ডাউনলোড করা যায়।

## ৪. স্পেসিফিকেশন কভারেজ ম্যাপিং টেবিল (Spec Section $\rightarrow$ Checkpoint Mapping)

স্পেসের (`docs/hishabkhata_app_specificationV2.md`) প্রতিটি সেকশন ও সাব-সেকশন কোন চেকপয়েন্টে কভার করা হয়েছে তার সম্পূর্ণ ম্যাপিং নিচে দেওয়া হলো:

| স্পেস সেকশন (Spec Section) | বিষয়বস্তু (Topic / Requirement) | কভার করা চেকপয়েন্ট (Checkpoints) |
| :--- | :--- | :--- |
| **১.১** | প্রজেক্ট স্কোপ (শুধু Customer ও Cashbook), নিজস্ব ব্র্যান্ডিং (`HisabKhata`), ডিফল্ট `BDT (৳)` ও `INR (₹)`, `en-IN` গ্রুপিং | `CP00`, `CP01`, `CP15` |
| **১.২ – ১.৩** | কালার প্যালেট (`#1355A3`, `#C91C42`, `#108944`, `#FFF5F6`, `#FFC107`) ও টাইপোগ্রাফি | `CP01`, `CP02`, `CP06`, `CP09`, `CP11` |
| **২.১** | কাস্টমার হোম ট্যাব, টপ বার, `CUSTOMERS \| CASHBOOK` হেডার ট্যাব, সামারি কার্ড, সার্চ/ফিল্টার, কাস্টমার লিস্ট, `+ ADD CUSTOMER` | `CP02`, `CP04`, `CP06`, `CP07` |
| **২.২** | কাস্টমারের ব্যক্তিগত লেজার স্ক্রিন, স্ট্যাটাস ব্যানার (`Settled Up` / `You will give` / `You will get`), `[PDF] Report` বাটন, ৩-কলাম লেজার ও রানিং `Bal.` | `CP05a`, `CP09` |
| **২.৩** | কাস্টমার এন্ট্রি ফর্ম, ইন-অ্যাপ ক্যালকুলেটর কিপ্যাড, এন্ট্রি ডিটেইলস, এডিট এবং ডিলিট + ৫-সেকেন্ড Undo | `CP08`, `CP09`, `CP10` |
| **২.৪** | কাস্টমার রিপোর্ট স্ক্রিন, `START DATE` / `END DATE` ফিল্টার, `Opening Balance`, এবং PDF ডাউনলোড ও শেয়ার (`Include Entry Details` মডালসহ) | `CP13`, `CP14` |
| **৩.১** | ক্যাশবুক ড্যাশবোর্ড, `Total Balance` ও `Today's Balance` কার্ড, `Cash in Hand` ও `Online` স্প্লিট, ডেইলি হেডার ও ৩-কলাম লিস্ট | `CP05b`, `CP11` |
| **৩.২** | ক্যাশবুকে `- OUT` ও `+ IN` এন্ট্রি স্ক্রিন, ক্যালকুলেটর কিপ্যাড, `Cash \| Online` টগল, তারিখ পিকার | `CP08`, `CP11` |
| **৩.৩** | ক্যাশবুক এন্ট্রি ডিটেইলস, এডিট, ডিলিট কনফার্মেশন মডাল, ব্যাকআপ ব্যাজ এবং ৫-সেকেন্ড `UNDO` স্ন্যাকবার | `CP12`, `CP28` |
| **৩.৪** | ক্যাশবুক ডেইলি ও কিউমুলেটিভ রিপোর্ট স্ক্রিন (`DATE \| DAILY BALANCE \| TOTAL BALANCE`) ও PDF ডাউনলোড | `CP05b`, `CP14` |
| **৪** | অ্যামাউন্ট স্টোরেজ (`REAL` / `NUMERIC(14,2)`), ২-দশমিক `roundMoney()`, SQL `ROUND(..., 2)`, `ABS(balance) < 0.005`, ISO কারেন্সি কোড ও `formatCurrency.ts` | `CP01`, `CP03`, `CP05a`, `CP05b`, `CP20` |
| **৫.১ – ৫.২** | সম্পূর্ণ স্ক্রিন নেভিগেশন ট্রি এবং ১৪টি রাউট ও প্যারামিটার ম্যাপিং | `CP02`, `CP04`, `CP06`–`CP16` |
| **৬.১** | মাল্টি-বিজনেস (`businesses` টেবিল), `business_id` আইসোলেশন এবং Business Switcher Modal | `CP03`, `CP04`, `CP05a`, `CP05b` |
| **৬.২** | UUID v7 প্রাইমারি কি, `react-native-get-random-values` পলিফিল এবং ডিভাইস লোকাল টাইমজোন (`dateUtils.ts`) | `CP00`, `CP01` |
| **৬.৩** | SQLite `PRAGMA user_version` ক্রমিক মাইগ্রেশন এবং `.db` ব্যাকআপ রিস্টোর ভার্সন ভ্যালিডেশন | `CP02b`, `CP03`, `CP17` |
| **৬.৪** | লোকাল SQLite স্কিমা (৫টি টেবিল ও পারফরম্যান্স ইনডেক্স) ও `better-sqlite3` টেস্ট হারনেস | `CP02b`, `CP03` |
| **৬.৫** | ব্যালেন্স নীতি (Window Function কুয়েরি, লোকাল-অনলি `net_balance`, `recomputeBalance()`, কাস্টমার Soft-Delete Cascade এবং ব্যাকডেটেড এন্ট্রি) | `CP05a`, `CP05b`, `CP07`, `CP09`, `CP27` |
| **৭.১ – ৭.২** | কাস্টম Node.js + Express + Prisma + PostgreSQL স্ট্যাক, Google ID Token + Argon2 Auth, Refresh Token Rotation, ও `business_id` Ownership Middleware | `CP19`, `CP21`, `CP22`, `CP26` |
| **৭.৩** | বাগ-মুক্ত সিঙ্ক প্রোটোকল: `(server_updated_at, id)` কার্সর, `devices` টেবিল ও Tombstone Purge, `410 Gone` রিসিঙ্ক, FK ক্রম, Idempotency ও LWW | `CP20`, `CP23`, `CP24`, `CP27`, `CP28` |
| **৭.৪** | সার্ভার-সাইড PostgreSQL ও Prisma স্কিমা (`Decimal(14,2)`) এবং `set_server_updated_at()` ট্রিগার | `CP20` |
| **৭.৫** | REST API এন্ডপয়েন্ট (`/auth/*`, `POST /sync/push`, `GET /sync/pull`) ও পেলোড ফরম্যাট | `CP21`, `CP23`, `CP24` |
| **৭.৬** | Backend Engineering Checklist (Zod, Rate Limit, Pino, OpenAPI `/docs`, Postgres Container Integration Tests, Docker, CI) | `CP19`, `CP21`–`CP25`, `CP29` |
| **৮.১ – ৮.২** | Must-Have MVP রোডম্যাপ (App Lock, Backup, i18n, Customer Undo, Validation, Empty States) ও Phase 2 রোডম্যাপ | `CP04`, `CP07`–`CP10`, `CP15`–`CP18`, `CP26`–`CP29` |
| **৯.১ – ৯.৩** | ফেজড লাইব্রেরি নির্বাচন (`npx expo install`), `SyncTransport` ইন্টারফেস, Windows + VS Code সেটআপ ও Monorepo ফোল্ডার স্ট্রাকচার | `CP00`–`CP02b`, `CP19`, `CP27`, `CP29` |
| **১০** | Future Work (Reminder, Attach Bills, Coins) এর জন্য এক্সটেনসিবল ডাটাবেজ ও মাইগ্রেশন প্রস্তুতি | `CP03` (`PRAGMA user_version` আর্কিটেকচার) |
