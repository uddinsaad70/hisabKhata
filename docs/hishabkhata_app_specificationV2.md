# HisabKhata (হিসাবখাতা) — Customer Ledger & Cashbook App Complete Specification

এই ডকুমেন্টটি একটি আধুনিক, অফলাইন-ফার্স্ট **Customer Ledger (বাকি ও দেনা-পাওনার খাতা)** এবং **Cashbook (দৈনিক জমা-খরচ খাতা)** মোবাইল অ্যাপের সম্পূর্ণ UI/UX, লোকাল SQLite ও কাস্টম **Node.js + Express + Prisma + PostgreSQL** ব্যাকএন্ড আর্কিটেকচার এবং টেকনিক্যাল ব্লুপ্রিন্ট। রেফারেন্স ভিডিওর পরিচ্ছন্ন লেআউট ও কালার স্কিম অনুসরণ করে এটি শুধুমাত্র দুটি মূল মডিউল (**১. Customer Ledger** এবং **২. Cashbook**) নিয়ে আমাদের নিজস্ব ব্র্যান্ডিংয়ে (**Windows + VS Code** দিয়ে **Android ও iPhone** উভয় প্ল্যাটফর্মের জন্য) তৈরি করার জন্য চূড়ান্ত করা হয়েছে।

## ১. স্কোপ, ব্র্যান্ডিং ও ভিজ্যুয়াল ডিজাইন সিস্টেম (Scope, Branding & Design System)

### ১.১. প্রজেক্ট স্কোপ ও নিজস্ব ব্র্যান্ডিং (Project Scope & Branding)

* **কোর স্কোপ (Strictly Two Modules):** এটি কোনো থার্ড-পার্টি অ্যাপের হুবহু ক্লোন নয়। অ্যাপটিতে শুধুমাত্র দুটি মূল ফিচার থাকবে: **(ক) Customer Ledger** এবং **(খ) Cashbook**। এর বাইরে কোনো অতিরিক্ত ফিচার (যেমন Suppliers, Inventory, Loans, বা Coins) মূল অ্যাপে থাকবে না।
* **অ্যাপের নাম ও ব্র্যান্ড প্লেসহোল্ডার:** অ্যাপের নিজস্ব নাম হিসেবে **`HisabKhata (হিসাবখাতা)`** (অথবা আপনার পছন্দের যেকোনো কাস্টম নাম) এবং নিজস্ব লেজার-বুক আইকন ব্যবহৃত হবে। অন্য কোনো ব্র্যান্ডের নাম, লোগো বা কপিরাইটেড টেক্সট কোথাও ব্যবহার করা হবে না।
* **ডিফল্ট কারেন্সি ও নাম্বার ফরম্যাট:**
  * **ডিফল্ট কারেন্সি:** ডাটাবেজে ISO কোড হিসেবে **`'BDT'`** (ডিফল্ট) অথবা **`'INR'`** সংরক্ষিত থাকবে এবং UI-তে যথাক্রমে **`৳`** ও **`₹`** হিসেবে প্রদর্শিত হবে। অ্যাপ সেটিংসে `BDT (৳)` এবং `INR (₹)` টগল করার অপশন থাকবে।
  * **নাম্বার ফরম্যাটিং:** উপমহাদেশীয় লক্ষ-হাজার কমা গ্রুপিং (`en-IN` locale, যেমন `৳ 15,12,504` বা `৳ 42,03,148.50`)।

### ১.২. কালার প্যালেট (Reference Color Palette)

| ডিজাইন এলিমেন্ট (Element) | কালার কোড (Hex) | কোথায় ব্যবহৃত হবে (Usage in App) |
| :--- | :--- | :--- |
| **Primary Header Blue** | `#1355A3` | টপ অ্যাপ বার (Top App Bar), কাস্টমার ও ক্যাশবুক হেডার, রিপোর্ট ডাউনলোড/শেয়ার বাটন, কনফার্ম বাটন |
| **Dark Header Accent** | `#0D3F7A` | স্ট্যাটাস বার, বিজনেস সুইচার পিল এবং কাস্টমার ট্যাগ ব্যাকগ্রাউন্ড |
| **Active Tab Indicator** | `#FFC107` | হোম হেডারের ভেতর সক্রিয় ট্যাবের (`CUSTOMERS` বা `CASHBOOK`) নিচের হলুদ/গোল্ডেন বর্ডার লাইন |
| **Primary Red (Out / Gave / Get)** | `#C91C42` | `You will get` ব্যালেন্স, `YOU GAVE ৳` বাটন, Cashbook `- OUT` বাটন, এবং খরচের অ্যামাউন্ট |
| **Light Pink Column Tint** | `#FFF5F6` | লেজার ও ক্যাশবুকের মাঝখানের কলাম (`YOU GAVE` এবং `OUT` কলামের হালকা গোলাপি ব্যাকগ্রাউন্ড) |
| **Primary Green (In / Got / Give)** | `#108944` | `You will give` ব্যালেন্স, `YOU GOT ৳` বাটন, Cashbook `+ IN` বাটন, এবং জমার অ্যামাউন্ট |
| **Light Green Badge Tint** | `#E8F5E9` | এন্ট্রি কার্ডের ভেতরে রানিং ব্যালেন্স ব্যাজ (`Bal. ৳ 79,340`) যখন ব্যালেন্স গ্রীন থাকে |
| **FAB Magenta / Crimson** | `#B8144D` | কাস্টমার ট্যাবের নিচে ডানপাশের `+ ADD CUSTOMER` ফ্লোটিং বাটন |
| **Page Background Grey** | `#F1F3F6` | কার্ডের পেছনের হালকা ধূসর ব্যাকগ্রাউন্ড এবং তারিখ বিভাজক (Date Divider) এরিয়া |
| **Card & Row Surface** | `#FFFFFF` | সামারি কার্ড, কাস্টমার লিস্ট রো, এন্ট্রি রো এবং মডাল ডায়ালগ |
| **Primary Text Dark** | `#1F2937` | কাস্টমারের নাম, এন্ট্রি নোট/ডিটেইলস, এবং মেইন টাইটেল |
| **Secondary Muted Text** | `#6B7280` | সময় (`26 minutes ago`, `06:22 PM`), কলাম হেডার (`ENTRIES`, `YOU GAVE`, `YOU GOT`), এবং সাবটাইটেল |
| **Border & Divider Line** | `#E5E7EB` | প্রতিটি লিস্ট আইটেম এবং কার্ডের ভেতরের পাতলা বিভাজক রেখা |

### ১.৩. টাইপোগ্রাফি (Typography)

* **Font Family:** ইংরেজি ও সংখ্যার জন্য `Inter` বা `Roboto` (Sans-Serif) এবং বাংলা টেক্সটের জন্য `Noto Sans Bengali`।

## ২. মডিউল ১: Customer Ledger (সকল সাব-ফিচারসহ বিস্তারিত বর্ণনা)

Customer মডিউলটি প্রতিটি কাস্টমারের সাথে আলাদাভাবে দেনা-পাওনার খাতা (Ledger) পরিচালনা করার জন্য ব্যবহৃত হয়।

### ২.১. হোম স্ক্রিন ও কাস্টমার লিস্ট (`CUSTOMERS` Tab)

1. **Top App Bar (Blue `#1355A3`):**
   * বাম পাশে অ্যাপের নিজস্ব খাতা আইকন এবং অ্যাক্টিভ ব্যবসার নাম ড্রপডাউন (যেমন `আমার দোকান ⌄` বা `Easha Enterprises ⌄`)। এতে ট্যাপ করলে **Business Switcher Modal** ওপেন হবে।
   * ডান পাশে ক্লাউড সিঙ্ক/ব্যাকআপ স্ট্যাটাস আইকন (কোনো কয়েন ব্যাজ থাকবে না)।
2. **Main Header Tabs (`CUSTOMERS | CASHBOOK`):**
   * হেডারের ভেতরে পাশাপাশি দুটি মূল ট্যাব থাকবে: বামে **`CUSTOMERS`** এবং ডানে **`CASHBOOK`**।
   * যে ট্যাবটি সক্রিয় থাকবে তার নিচে `#FFC107` হলুদ আন্ডারলাইন থাকবে। (কোনো `SUPPLIERS` বা `Parties` ট্যাব থাকবে না)।
3. **Top Summary Card (Floating White Card):**
   * কার্ডের উপরের অংশে মাঝখানে একটি উল্লম্ব দাগ (Vertical Divider) দিয়ে দুটি কলাম:
     * **বাম কলাম (`You will give` / কাস্টমার পাবে):** ধূসর ছোট লেবেল `You will give`, নিচে সবুজ (`#108944`) বোল্ড অক্ষরে মোট অ্যামাউন্ট (যেমন `৳ 15,12,504`)।
     * **ডান কলাম (`You will get` / আপনি পাবেন):** ধূসর ছোট লেবেল `You will get`, নিচে লাল (`#C91C42`) বোল্ড অক্ষরে মোট অ্যামাউন্ট (যেমন `৳ 42,03,148`)।
   * কার্ডের নিচের অংশে অনুভূমিক দাগের নিচে মাঝখানে নীল রঙের বাটন: `[PDF Icon] View Reports >`।
4. **Search & Filter Row:**
   * **Search Box (~৭৫% প্রস্থ):** বাম পাশে `🔍 Search Customer` ইনপুট বক্স। ক্লিক করলে প্লেসহোল্ডার হবে `✕ Name, Mobile no.` এবং সাথে সাথে নাম বা মোবাইল নম্বর লিখে লাইভ সার্চ করা যাবে।
   * **Filters Button (~২৫% প্রস্থ):** ডান পাশে `▽ Filters` আইকন বাটন (`All`, `You will get`, `You will give`, `Settled`, এবং `Most Recent`, `Oldest`, `Highest Amount`, `Name A-Z` সর্টিং)। *(হেডারে `CASHBOOK` ট্যাব থাকায় এই সারিতে আলাদা `[Cashbook]` বাটন থাকবে না)*।
5. **Customer List Rows:**
   * প্রতিটি কাস্টমারের রো-তে ৩টি অংশ থাকবে:
     * **বাম পাশে (Avatar):** গোলাকার অ্যাভাটার (নামের প্রথম দুই শব্দের আদ্যক্ষর যেমন `HV`, `YM`, `GR` হালকা প্যাস্টেল ব্যাকগ্রাউন্ডে)।
     * **মাঝখানে (Name & Time):** উপরে কাস্টমারের নাম বোল্ড ফন্টে (`Hasina vengi`, `Younus Mg`) এবং নিচে সর্বশেষ লেনদেনের আপেক্ষিক সময় (`26 minutes ago`, `6 hours ago`)।
     * **ডান পাশে (Net Balance Only):**
       * ব্যালেন্স শূন্য হলে ধূসর রঙে `৳ 0`।
       * কাস্টমার টাকা পেলে (`You will give`) সবুজ রঙে অ্যামাউন্ট (যেমন `৳ 79,340`)।
       * আপনি কাস্টমারের কাছে টাকা পেলে (`You will get`) লাল রঙে অ্যামাউন্ট (যেমন `৳ 6,350`)। *(নিচে কোনো `REMIND >` লিংক থাকবে না)*।
6. **Floating Action Button (`+ ADD CUSTOMER`):**
   * স্ক্রিনের নিচে ডান কোণায় গাঢ় ম্যাজেন্টা/লাল পিল বাটন `[person+ icon] ADD CUSTOMER`।
   * নতুন কাস্টমার যোগ করার সময় **Customer Name (বাধ্যতামূলক)** এবং **Mobile Number (ঐচ্ছিক)** দিয়ে সেভ করার অপশন।

### ২.২. কাস্টমারের ব্যক্তিগত লেজার স্ক্রিন (Customer Individual Ledger Screen)

তালিকা থেকে যেকোনো কাস্টমারের ওপর ট্যাপ করলে এই স্ক্রিনটি ওপেন হবে:

1. **Top Customer Header (Blue `#1355A3`):**
   * বামে ব্যাক অ্যারো `←`, কাস্টমারের ইনিশিয়াল অ্যাভাটার (`YM`), কাস্টমারের নাম (`Younus Mg`), পাশে হালকা নীল ব্যাজে `Customer` ট্যাগ, এবং নামের নিচে ছোট অক্ষরে `View settings` (কাস্টমারের নাম, ফোন নম্বর এডিট বা কাস্টমার ডিলিট করার অপশন)।
   * ডান কোণায় সরাসরি কল করার জন্য `📞` (Call) আইকন (ফোন নম্বর দেওয়া থাকলে OS ডায়ালার ওপেন করবে)।
2. **Net Balance Status Banner (White Card inside Header):**
   * ব্যালেন্স শূন্য হলে (`ABS(balance) < 0.005`): বাম পাশে সবুজ টিক চিহ্নসহ `[✓] Settled Up` এবং ডান পাশে `৳ 0`।
   * কাস্টমার আপনার কাছে পেলে: বাম পাশে `You will give` এবং ডান পাশে সবুজ রঙে `৳ 79,340`।
   * আপনি কাস্টমারের কাছে পেলে: বাম পাশে `You will get` এবং ডান পাশে লাল রঙে মোট পাওনা টাকা।
3. **Action Sub-Bar (Report Button Only):**
   * হেডারের নিচে মাঝখানে বা ডান পাশে `[PDF Icon] Report` বাটন থাকবে, যা এই কাস্টমারের স্টেটমেন্ট/রিপোর্ট স্ক্রিনে নিয়ে যাবে। *(কোনো `Reminder` বা `SMS` বাটন থাকবে না)*।
4. **Ledger Column Headers & Entry Cards:**
   * ধূসর স্টিকি বার: বামে `ENTRIES` (~৫০% প্রস্থ), মাঝখানে `YOU GAVE` (~২৫% প্রস্থ), ডানে `YOU GOT` (~২৫% প্রস্থ)।
   * তারিখের গ্রুপের মাঝখানে ছোট পিল আকারে তারিখ দেখাবে: যেমন `18 Oct 26 - Today`, `17 Oct 26 - 1 day ago`।
   * **প্রতিটি এন্ট্রি কার্ডে ৩টি কলাম থাকবে:**
     * **বাম কলাম (`ENTRIES`):** উপরে তারিখ ও সময় (`17 Oct 26 • 11:56 AM`), মাঝখানে কুয়েরি থেকে পাওয়া **Running Balance Pill (`Bal. ৳ 79,340`)**, এবং নিচে বিবরণ/নোট (`Younus Mg 41300+7000=48300*125=60380`)।
     * **মাঝখানের কলাম (`YOU GAVE` — হালকা গোলাপি `#FFF5F6` ব্যাকগ্রাউন্ড):** আপনি কাস্টমারকে টাকা বা মাল বাকি দিলে লাল রঙে অ্যামাউন্ট (`৳ 58,500`)।
     * **ডান কলাম (`YOU GOT` — সাদা ব্যাকগ্রাউন্ড):** কাস্টমার আপনাকে টাকা জমা দিলে সবুজ রঙে অ্যামাউন্ট (`৳ 60,380`)।
5. **Bottom Fixed Action Buttons:**
   * বামে লাল বাটন: `YOU GAVE ৳` (`#C91C42`) এবং ডানে সবুজ বাটন: `YOU GOT ৳` (`#108944`)।

### ২.৩. কাস্টমার লেনদেন এন্ট্রি, ইন-অ্যাপ ক্যালকুলেটর এবং ডিলিট-আনডু (Add/Edit/Delete Customer Entry)

* **Amount Input & Built-in Calculator:** `YOU GAVE ৳` বা `YOU GOT ৳` বাটনে ট্যাপ করলে উপরে বড় অক্ষরে টাকার বক্স এবং নিচে কাস্টম ক্যালকুলেটর কিপ্যাড (`C`, `M+`, `M-`, `⌫`, `+`, `-`, `×`, `÷`, `%`, `=`) ওপেন হবে।
* **Details Input & Date Picker:** অ্যামাউন্ট `> 0` হলে নিচে `Enter details (Items, bill no., quantity, etc.)` বক্স এবং লেনদেনের তারিখ পরিবর্তন করার ড্রপডাউন (`📅 18 Oct 26 ▾`) দেখাবে। *(এখানে কোনো `Attach bills` বাটন থাকবে না)*।
* **Entry Details, Edit & Delete with Undo:**
  * যেকোনো এন্ট্রির ওপর ট্যাপ করলে `Entry Details` পেজ ওপেন হবে, যেখান থেকে `✎ EDIT ENTRY` করে তথ্য সংশোধন করা যাবে অথবা `🗑️ DELETE` বাটনে চাপ দিয়ে কনফার্মেশনের মাধ্যমে এন্ট্রি মুছে ফেলা যাবে।
  * **Customer Delete Undo:** এন্ট্রি ডিলিট কনফার্ম করলে কাস্টমার লেজার স্ক্রিনে ফিরে আসবে এবং নিচে ৫ সেকেন্ডের জন্য কালো স্ন্যাকবারে `Entry Deleted` ও পাশে সবুজ **`UNDO`** বাটন দেখাবে (ক্যাশবুকের মতোই কাস্টমার লেজারেও ডিলিট আনডু সুবিধা থাকবে)।

### ২.৪. কাস্টমার রিপোর্ট, তারিখ ফিল্টার এবং PDF ডাউনলোড ও শেয়ার (Customer Report & PDF Share)

* **Start Date & End Date Filter:** হেডারের ভেতরে সাদা বক্সে বামে `📅 START DATE` এবং ডানে `📅 END DATE` ক্যালেন্ডার মডাল (`OK`, `CANCEL`, `REMOVE`)।
* **Search & Filter Dropdown:** `🔍 Search Entries` বক্স এবং ডান পাশে ফিল্টার ড্রপডাউন (`ALL ⌄`, `This Month`, `Last Month`, `Custom Date Range`)।
* **Report Summary Strip:** উপরে `Net Balance` এবং নিচে ৩টি কলামে সামারি: `TOTAL (Entries Count)` | `YOU GAVE` (লাল) | `YOU GOT` (সবুজ)।
* **PDF Download & Share Flow:** নিচে `[PDF] Download` এবং `[Share Icon] Share` বাটন। ট্যাপ করলে `Include in report -> [✓] Entry Details -> OK` বটম শিট পপআপ হয়ে প্রফেশনাল পিডিএফ স্টেটমেন্ট তৈরি হবে এবং ফোনে ডাউনলোড বা WhatsApp/অন্য অ্যাপে শেয়ার করা যাবে।

## ৩. মডিউল ২: Cashbook (সকল সাব-ফিচারসহ বিস্তারিত বর্ণনা)

হোম পেজের হেডার থেকে **`CASHBOOK`** ট্যাবে ট্যাপ করলে প্রতিদিনের নগদ (`Cash`) ও অনলাইন (`Online`) টাকার জমা (`IN`) এবং খরচ (`OUT`) এর হিসাব রাখার এই মডিউলটি ওপেন হবে।

### ৩.১. ক্যাশবুক ড্যাশবোর্ড ও ব্যালেন্স সামারি (`CASHBOOK` Tab)

1. **Top Dual Balance Card (Floating White Card):**
   * **উপরের অংশ (২ কলাম):** বামে `Total Balance` (শুরু থেকে আজ পর্যন্ত সর্বমোট ব্যালেন্স, যেমন `৳ 99,00,130`) এবং ডানে `Today's Balance` (আজকের মোট জমা বিয়োগ আজকের মোট খরচ, যেমন `৳ 9,750`)।
   * **মাঝখানের অংশ (Cash in Hand বনাম Online বিভাজন):** বামে সর্বমোট `Cash in Hand` ও `Online` ব্যালেন্স এবং ডানে আজকের `Cash in Hand` ও `Online` ব্যালেন্স।
   * **নিচের অংশ:** `[PDF Icon] VIEW CASHBOOK REPORT` বাটন।
2. **Daily Header Row (`Date`, `OUT`, `IN` Totals):**
   * বামে তারিখ ও এন্ট্রি সংখ্যা (`18 OCT`, `12 Entries`), মাঝখানে `OUT` কলামের নিচে লাল রঙে আজকের মোট খরচ (`৳ 5,95,700`), ডানে `IN` কলামের নিচে সবুজ রঙে আজকের মোট জমা (`৳ 6,05,450`)।
3. **Cashbook Entry List (3-Column Table):**
   * **বাম কলাম (Time & Details):** উপরে এন্ট্রির সময় (`06:50 PM`) ও পেমেন্ট মোড ব্যাজ (`Cash`/`Online`), এবং নিচে এন্ট্রির বিবরণ (`sadd cash`, `Ranjit paid`)।
   * **মাঝখানের কলাম (`OUT` — হালকা গোলাপি `#FFF5F6` ব্যাকগ্রাউন্ড):** খরচের এন্ট্রি হলে লাল রঙে টাকার পরিমাণ (`৳ 10,000`)।
   * **ডান কলাম (`IN` — সাদা ব্যাকগ্রাউন্ড):** জমার এন্ট্রি হলে সবুজ রঙে টাকার পরিমাণ (`৳ 12,000`)।
4. **Bottom Fixed Action Bar (`- OUT` & `+ IN`):**
   * বামে লাল বাটন `[−] OUT` (`#C91C42`) এবং ডানে সবুজ বাটন `[+] IN` (`#108944`)।

### ৩.২. ক্যাশবুকে নতুন এন্ট্রি যুক্ত করা (`OUT` এবং `IN` Entry Screen)

* **Dynamic Top Bar:** `- OUT` চাপলে লাল রঙে `← OUT entry of ৳ 10,000` এবং `+ IN` চাপলে সবুজ রঙে `← IN entry of ৳ 12,000`।
* **Amount Field & Built-in Calculator Keypad:** উপরে বড় অক্ষরে টাকার বক্স এবং নিচে বিল্ট-ইন ক্যালকুলেটর কিপ্যাড।
* **Payment Mode Selector (`Cash` / `Online`):** `Payment Mode` লেবেলের পাশে দুটি পিল বাটন: `Cash` (ডিফল্ট) | `Online`।
* **Details Input & Date Selector:** টাকা টাইপ করার সাথে সাথে `Enter details` বক্স এবং `[📅 18 Oct 26 ▾]` তারিখ পিকার ভেসে উঠবে। *(এখানে কোনো `Attach bills` বাটন থাকবে না)*। নিচে পূর্ণ-প্রস্থ `SAVE` বাটন।

### ৩.৩. ক্যাশবুক এন্ট্রি ডিটেইলস, এডিট, ডিলিট এবং আনডু (`Entry Details`, `Delete` & `Undo`)

* যেকোনো এন্ট্রির ওপর ট্যাপ করলে `← Entry Details` স্ক্রিন ওপেন হবে, যেখানে সময়, তারিখ, পেমেন্ট মোড, টাকার পরিমাণ, `Details`, ব্যাকআপ স্ট্যাটাস এবং `✎ EDIT ENTRY` বাটন থাকবে।
* স্ক্রিনের নিচে `🗑️ DELETE` বাটনে ট্যাপ করলে কনফার্মেশন পপআপ (`Delete the entry from this date?` -> `CANCEL` / `CONFIRM`) আসবে।
* `CONFIRM` করলে এন্ট্রিটি সফট-ডিলিট হবে, সাথে সাথে ব্যালেন্স আপডেট হবে এবং নিচে ৫ সেকেন্ডের জন্য কালো স্ন্যাকবারে `Entry Deleted` ও ডান পাশে সবুজ `UNDO` বাটন দেখাবে।

### ৩.৪. ক্যাশবুক রিপোর্ট ও তারিখ অনুযায়ী ব্যালেন্স (`Cashbook Report`)

* **Date Range & Duration Filter Header:** প্রথম সারিতে `[📅 01 OCT 26]` (Start Date) ও `[📅 31 OCT 26]` (End Date) এবং দ্বিতীয় সারিতে `Select report duration: THIS MONTH ▾` ড্রপডাউন (`This Month`, `Last Month`, `Today`, `Custom Date Range`)।
* **3-Column Daily Summary Table:** `DATE` | `DAILY BALANCE` (ওই দিনের মোট `IN` বিয়োগ মোট `OUT`) | `TOTAL BALANCE` (ওই দিন শেষে ক্রমযোজিত ব্যালেন্স `>`)।
* **Download PDF Footer:** স্ক্রিনের নিচে নীল রঙের পূর্ণ-প্রস্থ `[PDF Icon] DOWNLOAD` বাটন।

## ৪. অ্যামাউন্ট স্টোরেজ, কারেন্সি ISO কোড ও দশমিক নির্ভুলতার নিয়ম (Amount & Currency Rules)

আর্থিক হিসাব দশমিকে (যেমন `৳ 125.50` বা ক্যালকুলেটরে ভাগের ফল) হতে পারে। তাই টাকার অ্যামাউন্ট লোকাল SQLite-এ **`REAL`** হিসেবে এবং সার্ভার PostgreSQL-এ **`NUMERIC(14, 2)`** হিসেবে সংরক্ষিত হবে (সর্বোচ্চ ২ দশমিক ঘর পর্যন্ত)।

IEEE-754 floating-point ত্রুটি (যেমন `0.1 + 0.2 = 0.30000000000000004`) শতভাগ এড়াতে নিচের **৫টি বাধ্যতামূলক নিয়ম** কোডবেসে অনুসরণ করতে হবে:

1. **ইনপুট ও ক্যালকুলেটর রেজাল্ট সেভের আগেই ২ ঘরে Round-Half-Up:** ডাটাবেজে `INSERT` বা `UPDATE` করার আগে প্রতিটি অ্যামাউন্ট `roundMoney()` ফাংশন দিয়ে ২ দশমিক ঘরে রাউন্ড করতে হবে।
2. **প্রতিটি SQL `SUM` ও ব্যালেন্স কুয়েরিতে `ROUND(..., 2)`:** SQLite-এ যোগ-বিয়োগ করার সময় সবসময় `ROUND(SUM(...), 2)` ব্যবহার করতে হবে।
3. **`Settled Up` বা শূন্য ব্যালেন্স চেক:** কখনোই `balance === 0` দিয়ে চেক করা যাবে না; সবসময় `Math.abs(balance) < 0.005` (TypeScript-এ) এবং `ABS(balance) < 0.005` বা `ROUND(balance, 2) = 0` (SQL-এ) ব্যবহার করতে হবে।
4. **সার্ভার PostgreSQL-এ `NUMERIC(14, 2)`:** PostgreSQL টেবিলে কখনোই `REAL` বা `DOUBLE PRECISION` ব্যবহার করা যাবে না; বাধ্যতামূলকভাবে `NUMERIC(14, 2)` ব্যবহার করতে হবে।
5. **কারেন্সি স্টোরেজ (ISO কোড) বনাম ডিসপ্লে সিম্বল (`utils/formatCurrency.ts`):** ডাটাবেজের `businesses.currency` কলামে সিম্বলের বদলে স্ট্যান্ডার্ড ISO কোড (`'BDT'` অথবা `'INR'`) স্টোর হবে। শুধুমাত্র UI ডিসপ্লে এবং PDF জেনারেশনের সময় `formatCurrency()` ফাংশনে `'BDT' -> '৳'` এবং `'INR' -> '₹'` ম্যাপ করা হবে।

### কোড উদাহরণ (`utils/formatCurrency.ts`)

```typescript
export type CurrencyCode = 'BDT' | 'INR';

export const CURRENCY_SYMBOL_MAP: Record<CurrencyCode, string> = {
  BDT: '৳',
  INR: '₹',
};

export function getCurrencySymbol(code: CurrencyCode = 'BDT'): string {
  return CURRENCY_SYMBOL_MAP[code] ?? '৳';
}

/**
 * ১. ডাটাবেজে সেভ বা ক্যালকুলেটর রেজাল্ট চূড়ান্ত করার আগে ২ দশমিক ঘরে Round-Half-Up
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * (Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100);
}

/**
 * ২. ব্যালেন্স শূন্য (Settled Up) কিনা তা নিরাপদে চেক করার ফাংশন
 */
export function isSettled(balance: number): boolean {
  return Math.abs(balance) < 0.005;
}

/**
 * ৩. en-IN গ্রুপিং ও ISO CurrencyCode সহ ডিসপ্লে ফরম্যাটার
 * উদাহরণ: formatCurrency(4203148, 'BDT') -> "৳ 42,03,148"
 * উদাহরণ: formatCurrency(1250.5, 'BDT')  -> "৳ 1,250.50"
 */
export function formatCurrency(
  amount: number,
  currencyCode: CurrencyCode = 'BDT',
  showAbsolute: boolean = true
): string {
  const symbol = getCurrencySymbol(currencyCode);
  const rounded = roundMoney(isSettled(amount) ? 0 : amount);
  const target = showAbsolute ? Math.abs(rounded) : rounded;
  const hasFraction = Math.abs(target % 1) > 0.001;

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(target);

  return `${symbol} ${formatted}`;
}
```

> **ভবিষ্যতে `INTEGER` (পয়সা/Poisha)-তে মাইগ্রেশন নোট:** যদি কখনো সম্পূর্ণ ইন্টিজার হিসাব (যেমন `৳ 125.50` = `12550` পয়সা) ব্যবহারের প্রয়োজন হয়, তবে একটিমাত্র SQLite মাইগ্রেশন স্ক্রিপ্টে নতুন কলাম `amount_minor INTEGER` যোগ করে `UPDATE customer_entries SET amount_minor = CAST(ROUND(amount * 100, 0) AS INTEGER);` চালিয়ে কোনো ডেটা লস ছাড়াই রূপান্তর করা যাবে।

## ৫. স্ক্রিন নেভিগেশন হায়ারার্কি ও রাউটিং ম্যাপ (Updated Screen Navigation Hierarchy)

হোম হেডারে **`CUSTOMERS | CASHBOOK`** ট্যাব যুক্ত করা এবং `SUPPLIERS`, `REMIND`, ও `Attach bills` বাদ দেওয়ার পর অ্যাপের আপডেট করা নেভিগেশন ট্রি নিচে দেওয়া হলো:

### ৫.১. ভিজ্যুয়াল নেভিগেশন ট্রি (Screen-to-Screen Flow Tree)

```text
[App Launch]
├── First Launch (No Business Exists) ➔ Onboarding Create Business Screen [Route: /onboarding]
├── App Lock Enabled ➔ PIN / Biometric Unlock Screen [Route: /lock]
└── Main App [Route: /(tabs)] (Bottom Bar: "Home / খাতা" | "More / সেটিংস")
    │
    ├── Bottom Tab 1: Home Workspace [Route: /(tabs)/index]
    │   ├── Top App Bar:
    │   │   ├── Business Switcher ("আমার দোকান ⌄") ➔ [Bottom Sheet Modal: Switch / + Add New Business / Edit Business]
    │   │   └── Top Header Tabs: [ TAB A: CUSTOMERS ]  |  [ TAB B: CASHBOOK ]
    │   │
    │   ├── [TAB A: CUSTOMERS VIEW] (Default Active Header Tab)
    │   │   ├── Top Summary Card Button: "[PDF] View Reports >"
    │   │   │   └── ➔ All Customers Statement Report Screen [Route: /customer/report-all]
    │   │   ├── Search & Filter Row:
    │   │   │   ├── "🔍 Search Customer" ➔ Live In-Screen Filter (Name / Mobile)
    │   │   │   └── "▽ Filters" ➔ [Bottom Sheet Modal: Filter Status & Sort Order]
    │   │   ├── FAB Button ("+ ADD CUSTOMER"):
    │   │   │   └── ➔ Add Customer Screen [Route: /customer/add]
    │   │   │       └── On "SAVE" ➔ Navigates to Customer Individual Ledger [Route: /customer/[id]]
    │   │   └── Tap any Customer Row:
    │   │       └── ➔ Customer Individual Ledger Screen [Route: /customer/[id]]
    │   │           ├── 1. Header "View settings" ➔ Customer Settings Screen [Route: /customer/[id]/settings]
    │   │           │   ├── Edit Name / Phone ➔ Save & Return to `/customer/[id]`
    │   │           │   └── Delete Customer ➔ [Confirm Modal] ➔ Cascade Soft Delete Customer + Entries & Return to `/(tabs)/index`
    │   │           ├── 2. Header "📞 Call" Icon ➔ Opens OS Phone Dialer (`tel:...`)
    │   │           ├── 3. Sub-Bar "[PDF] Report" Button:
    │   │           │   └── ➔ Customer Report Screen [Route: /customer/[id]/report]
    │   │           │       ├── Tap "START DATE" / "END DATE" ➔ [Calendar Picker Modal]
    │   │           │       ├── Tap "ALL ⌄" Dropdown ➔ [Duration Filter]
    │   │           │       └── Tap "[PDF] Download" or "[Share] Share"
    │   │           │           └── ➔ [Bottom Sheet: Include "Entry Details" Checkbox ➔ OK] ➔ PDF Generate/Share
    │   │           ├── 4. Bottom Buttons ("YOU GAVE ৳" [Red] / "YOU GOT ৳" [Green]):
    │   │           │   └── ➔ Customer Calculator Entry Screen [Route: /customer/[id]/entry-form?type=GAVE|GOT]
    │   │           │       ├── Custom Calculator Keypad + Details Input + Date Picker ("📅 18 Oct 26 ▾")
    │   │           │       └── Tap "SAVE" ➔ Saves Entry (2-decimal rounded) & Returns to `/customer/[id]`
    │   │           └── 5. Tap any Existing Customer Entry Card:
    │   │               └── ➔ Customer Entry Details Screen [Route: /customer/[id]/entry/[entryId]]
    │   │                   ├── Tap "✎ EDIT ENTRY" ➔ Opens `/customer/[id]/entry-form?entryId=[entryId]`
    │   │                   └── Tap "🗑️ DELETE" ➔ [Confirm Delete Modal: CANCEL / CONFIRM]
    │   │                       └── On "CONFIRM" ➔ Soft-deletes, Returns to `/customer/[id]` + Shows "Entry Deleted [UNDO]" Snackbar (5s)
    │   │
    │   └── [TAB B: CASHBOOK VIEW] (Switched via Header Tab `CASHBOOK` or Route `/(tabs)/index?tab=cashbook`)
    │       ├── 1. Top Card Button: "[PDF] VIEW CASHBOOK REPORT"
    │       │   └── ➔ Cashbook Daily Report Screen [Route: /cashbook/report]
    │       │       ├── Tap "START DATE" / "END DATE" ➔ [Calendar Picker Modal]
    │       │       ├── Tap "THIS MONTH ▾" Dropdown ➔ [Select Duration]
    │       │       ├── Tap any Date Row in Table ➔ Opens Day Entries View
    │       │       └── Tap "[PDF] DOWNLOAD" Footer Button ➔ Generates & Shares Cashbook PDF Report
    │       ├── 2. Bottom Fixed Buttons ("- OUT" [Red] / "+ IN" [Green]):
    │       │   └── ➔ Cashbook Calculator Entry Screen [Route: /cashbook/entry-form?type=OUT|IN]
    │       │       ├── Custom Calculator Keypad + Payment Mode Pill (`Cash` | `Online`) + Details + Date Picker
    │       │       └── Tap "SAVE" ➔ Saves Entry & Returns to Cashbook View
    │       └── 3. Tap any Existing Cashbook Entry Row:
    │           └── ➔ Cashbook Entry Details Screen [Route: /cashbook/entry/[entryId]]
    │               ├── Tap "✎ EDIT ENTRY" ➔ Opens `/cashbook/entry-form?entryId=[entryId]`
    │               └── Tap "🗑️ DELETE" ➔ [Confirm Delete Modal: CANCEL / CONFIRM]
    │                   └── On "CONFIRM" ➔ Soft-deletes, Returns to Cashbook View + Shows "Entry Deleted [UNDO]" Snackbar (5s)
    │
    └── Bottom Tab 2: More & Settings [Route: /(tabs)/more]
        ├── Business Profile Edit & Currency Toggle (`BDT ৳` / `INR ₹`)
        ├── Language Toggle (`বাংলা` / `English`)
        ├── App Lock Settings (PIN / Biometric Fingerprint Toggle)
        ├── Local Backup & Export/Import (Export CSV/JSON, Backup/Restore `.db` file with `user_version` check)
        └── Cloud Sync & Account Login (Phase 2: Custom Node.js API Sign-In & Sync Status)
```

### ৫.২. স্ক্রিন রাউট ও প্যারামিটার টেবিল (Screen Route & Parameter Mapping)

| ক্রম | স্ক্রিনের নাম (Screen Name) | রাউট পাথ (Expo Router Path) | প্রয়োজনীয় প্যারামিটার (Params) | ব্যাক বাটন চাপলে কোথায় ফিরবে (Back Target) |
| :--- | :--- | :--- | :--- | :--- |
| ১ | **Home (`CUSTOMERS` \| `CASHBOOK`)** | `/(tabs)/index.tsx` | `tab` (`customers` \| `cashbook`) | অ্যাপ থেকে বের হওয়ার কনফার্মেশন |
| ২ | **More & Settings** | `/(tabs)/more.tsx` | নেই | `/(tabs)/index` (`CUSTOMERS` ট্যাব) |
| ৩ | **Onboarding / First Business** | `/onboarding.tsx` | নেই | অ্যাপ বন্ধ (প্রথমবার বিজনেস তৈরি বাধ্যতামূলক) |
| ৪ | **App Lock (PIN / Biometric)** | `/lock.tsx` | নেই | অ্যাপ আনলক হলে আগের স্ক্রিন |
| ৫ | **Add New Customer** | `/customer/add.tsx` | নেই | `/(tabs)/index?tab=customers` |
| ৬ | **Customer Individual Ledger** | `/customer/[id]/index.tsx` | `id` (Customer UUID) | `/(tabs)/index?tab=customers` |
| ৭ | **Customer Add/Edit Entry** | `/customer/[id]/entry-form.tsx` | `id`, `type` (`GAVE` \| `GOT`), `entryId` (optional) | `/customer/[id]` অথবা `/customer/[id]/entry/[entryId]` |
| ৮ | **Customer Entry Details** | `/customer/[id]/entry/[entryId].tsx` | `id`, `entryId` (Entry UUID) | `/customer/[id]` (ডিলিট হলে `UNDO` স্ন্যাকবারসহ) |
| ৯ | **Customer Report & PDF** | `/customer/[id]/report.tsx` | `id`, `startDate`, `endDate` | `/customer/[id]` |
| ১০ | **Customer Profile Settings** | `/customer/[id]/settings.tsx` | `id` | `/customer/[id]` |
| ১১ | **All Customers Report** | `/customer/report-all.tsx` | `startDate`, `endDate` | `/(tabs)/index?tab=customers` |
| ১২ | **Cashbook Add/Edit Entry** | `/cashbook/entry-form.tsx` | `type` (`OUT` \| `IN`), `entryId` (optional) | `/(tabs)/index?tab=cashbook` বা ডিটেইলস স্ক্রিন |
| ১৩ | **Cashbook Entry Details** | `/cashbook/entry/[entryId].tsx` | `entryId` (Entry UUID) | `/(tabs)/index?tab=cashbook` (`UNDO` স্ন্যাকবারসহ) |
| ১৪ | **Cashbook Daily Report** | `/cashbook/report.tsx` | `startDate`, `endDate`, `duration` | `/(tabs)/index?tab=cashbook` |

## ৬. লোকাল ডাটাবেজ আর্কিটেকচার: SQLite স্কিমা, মাইগ্রেশন ও ব্যালেন্স লজিক (Local Database Specification)

### ৬.১. মাল্টি-বিজনেস (`businesses` টেবিল) এবং ডেটা আইসোলেশন লজিক

* একজন ব্যবসায়ী যেন একই অ্যাপে একাধিক দোকানের বা প্রতিষ্ঠানের হিসাব আলাদা রাখতে পারেন, সেজন্য রুট টেবিল হিসেবে **`businesses`** থাকবে।
* `customers`, `customer_entries`, এবং `cashbook_entries` — প্রতিটি টেবিলে বাধ্যতামূলকভাবে **`business_id`** কলাম থাকবে।
* **UI ও স্টেট লজিক:** টপ অ্যাপ বারে ব্যবসার নামের ওপর (`আমার দোকান ⌄`) ট্যাপ করলে একটি বটম শিট ওপেন হবে, যেখানে সব ব্যবসার তালিকা, প্রতিটি ব্যবসার সক্রিয় কাস্টমার সংখ্যা এবং `+ নতুন ব্যবসা যোগ করুন` বাটন থাকবে। ইউজার ব্যবসা পরিবর্তন করলে Zustand স্টোরে `activeBusinessId` পরিবর্তিত হবে এবং অ্যাপের সমস্ত SQL কুয়েরি স্বয়ংক্রিয়ভাবে `WHERE business_id = :activeBusinessId AND is_deleted = 0` দ্বারা ফিল্টার হবে।

### ৬.২. UUID v7 (`react-native-get-random-values`) এবং ডিভাইস লোকাল টাইমজোন নীতি

* **UUID v7 ও Crypto Polyfill:** অটো-ইনক্রিমেন্ট (`INTEGER AUTOINCREMENT`) ব্যবহার করলে অফলাইনে একাধিক ডিভাইসে তৈরি হওয়া রেকর্ডের আইডি সংঘর্ষ (ID Collision) হয়। তাই সব প্রাইমারি কি (`id`) হবে **UUID v7** (টাইমস্ট্যাম্প-ভিত্তিক সর্টেবল UUID)।
  * **বাধ্যতামূলক সেটআপ নোট:** React Native-এর JS রানটাইমে ডিফল্টভাবে `crypto.getRandomValues()` থাকে না, যা ছাড়া `uuid` প্যাকেজ ক্র্যাশ করে। তাই ডে-১ থেকেই `react-native-get-random-values` ইনস্টল করতে হবে এবং অ্যাপের এন্ট্রি ফাইল (`app/_layout.tsx` বা `index.js`)-এর **একদম প্রথম লাইনে** `import 'react-native-get-random-values';` যুক্ত করতে হবে।
* **টাইমজোন নীতি (`entry_date` বনাম `timestamp` — কোনো হার্ডকোডেড টাইমজোন নয়):**
  * অ্যাপে `'Asia/Dhaka'` বা অন্য কোনো টাইমজোন হার্ড-কোড করা যাবে না। `entry_date` (`'YYYY-MM-DD'`) সবসময় **ইউজারের ফোনের বর্তমান লোকাল টাইমজোন** অনুযায়ী হিসাব হবে।
  * উদাহরণস্বরূপ, বাংলাদেশে (`UTC+6`) থাকা কোনো ইউজার রাত ১২:৩০ মিনিটে (১৯ অক্টোবর) এন্ট্রি দিলে UTC-তে তখন ১৮ অক্টোবর সন্ধ্যা ৬:৩০ হলেও ডিভাইসের লোকাল ক্যালেন্ডার অনুযায়ী `entry_date` হবে `'2026-10-19'`, এবং `timestamp` হবে UTC Epoch Milliseconds (`Date.now()`)।

#### কোড উদাহরণ (`utils/dateUtils.ts`)

```typescript
/**
 * ডিভাইসের লোকাল টাইমজোন অনুযায়ী 'YYYY-MM-DD' তারিখ রিটার্ন করে (কোনো হার্ডকোডেড টাইমজোন ছাড়াই)
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * ডিভাইসের লোকাল টাইম অনুযায়ী ডিসপ্লে টাইম (যেমন '06:50 PM')
 */
export function getLocalTimeString(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
```

### ৬.৩. SQLite স্কিমা মাইগ্রেশন (`PRAGMA user_version`) এবং `.db` রিস্টোর ভ্যালিডেশন

ভবিষ্যতে অ্যাপ আপডেটের সময় ইউজারের পুরনো ডেটা অক্ষত রেখে নতুন কলাম বা টেবিল যোগ করার জন্য SQLite-এর বিল্ট-ইন **`PRAGMA user_version`** ভিত্তিক ক্রমিক (Sequential) মাইগ্রেশন ব্যবহৃত হবে:

```typescript
// db/migrations.ts
import { type SQLiteDatabase } from 'expo-sqlite';

export const LATEST_SCHEMA_VERSION = 1;

const MIGRATIONS: Record<number, (db: SQLiteDatabase) => Promise<void>> = {
  1: async (db) => {
    await db.execAsync(INITIAL_V1_SCHEMA_SQL);
  },
  // ভবিষ্যতে v2 আসলে:
  // 2: async (db) => {
  //   await db.execAsync(`ALTER TABLE customers ADD COLUMN due_date TEXT NULL;`);
  // },
};

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  let currentVersion = row?.user_version ?? 0;

  if (currentVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `BACKUP_VERSION_TOO_NEW: ডাটাবেজ ফাইলের ভার্সন (v${currentVersion}) বর্তমান অ্যাপের ভার্সনের (v${LATEST_SCHEMA_VERSION}) চেয়ে নতুন। অনুগ্রহ করে অ্যাপটি আপডেট করুন।`
    );
  }

  while (currentVersion < LATEST_SCHEMA_VERSION) {
    const nextVersion = currentVersion + 1;
    const migrateFn = MIGRATIONS[nextVersion];
    if (!migrateFn) throw new Error(`Missing migration for version ${nextVersion}`);

    await db.withTransactionAsync(async () => {
      await migrateFn(db);
      await db.execAsync(`PRAGMA user_version = ${nextVersion};`);
    });
    currentVersion = nextVersion;
  }
}
```

* **`.db` ব্যাকআপ ফাইল রিস্টোর করার নিয়ম (`db/backupService.ts`):**
  1. ইউজার যখন কোনো `.db` ব্যাকআপ ফাইল সিলেক্ট করবেন, তখন মূল ডাটাবেজ ওভাররাইট করার আগে সেটি একটি অস্থায়ী পাথে (`temp_restore.db`) কপি করে ওপেন করা হবে এবং তার `PRAGMA user_version` ও `PRAGMA integrity_check` পরীক্ষা করা হবে।
  2. যদি ব্যাকআপ ফাইলের `user_version < LATEST_SCHEMA_VERSION` হয় (পুরনো অ্যাপের ব্যাকআপ), তবে রিস্টোর করার পর স্বয়ংক্রিয়ভাবে `runMigrations()` চালিয়ে সর্বশেষ ভার্সনে আপগ্রেড করে নেওয়া হবে।
  3. যদি ব্যাকআপ ফাইলের `user_version > LATEST_SCHEMA_VERSION` হয় (নতুন ভার্সনের অ্যাপ থেকে নেওয়া ব্যাকআপ পুরনো অ্যাপে রিস্টোর করার চেষ্টা), তবে **রিস্টোর ব্লক করা হবে** এবং ইউজারকে স্পষ্ট বাংলা/ইংরেজি সতর্কবার্তা দেখানো হবে যে আগে অ্যাপটি আপডেট করতে হবে।

### ৬.৪. লোকাল SQLite স্কিমা (`db/schema.ts`)

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ১. ব্যবসা টেবিল (Businesses Table)
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,                                -- UUID v7
  owner_user_id TEXT,                                 -- Phase 1-এ NULL; Phase 2-এ Server users.id (UUID)
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT' CHECK (currency IN ('BDT', 'INR')), -- ISO Currency Code
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  is_synced INTEGER NOT NULL DEFAULT 0
);

-- ২. কাস্টমার টেবিল (Customers Table)
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,                                -- UUID v7
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  avatar_initials TEXT NOT NULL,
  net_balance REAL NOT NULL DEFAULT 0,                -- Local-Only Derived Cache (কখনোই সার্ভারে সিঙ্ক হবে না)
  last_transaction_at INTEGER,                        -- Local-Only Derived Cache
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  is_synced INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- ৩. কাস্টমার লেজার এন্ট্রি টেবিল (Customer Entries Table)
CREATE TABLE IF NOT EXISTS customer_entries (
  id TEXT PRIMARY KEY,                                -- UUID v7
  business_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('GAVE', 'GOT')), -- 'GAVE' = You Gave (-), 'GOT' = You Got (+)
  amount REAL NOT NULL CHECK (amount > 0),            -- ২ দশমিক ঘরে রাউন্ডেড
  details TEXT,
  entry_date TEXT NOT NULL,                           -- Device Local Date 'YYYY-MM-DD'
  entry_time TEXT NOT NULL,                           -- Display Time '11:56 AM'
  timestamp INTEGER NOT NULL,                         -- UTC Epoch ms
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  is_synced INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- ৪. ক্যাশবুক এন্ট্রি টেবিল (Cashbook Entries Table)
CREATE TABLE IF NOT EXISTS cashbook_entries (
  id TEXT PRIMARY KEY,                                -- UUID v7
  business_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('OUT', 'IN')),   -- 'OUT' = খরচ (-), 'IN' = জমা (+)
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('CASH', 'ONLINE')),
  amount REAL NOT NULL CHECK (amount > 0),            -- ২ দশমিক ঘরে রাউন্ডেড
  details TEXT,
  entry_date TEXT NOT NULL,                           -- Device Local Date 'YYYY-MM-DD'
  entry_time TEXT NOT NULL,                           -- Display Time '06:50 PM'
  timestamp INTEGER NOT NULL,                         -- UTC Epoch ms
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  is_synced INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- ৫. সিঙ্ক স্টেট টেবিল (Sync Metadata Table — Local Only, Server Cursor Tracking)
CREATE TABLE IF NOT EXISTS sync_state (
  business_id TEXT PRIMARY KEY,                       -- প্রতিটি ব্যবসার কার্সর আলাদা বা 'GLOBAL'
  device_id TEXT NOT NULL,                            -- এই ফোনের ইউনিক UUID v7
  last_pulled_cursor TEXT,                            -- Format: "2026-10-19T00:00:00.000Z_0192a..." (server_updated_at + id)
  last_pushed_at INTEGER NOT NULL DEFAULT 0
);

-- ৬. লোকাল পারফরম্যান্স ইনডেক্স (Indexes for Multi-Year Instant Queries)
CREATE INDEX IF NOT EXISTS idx_customers_biz_updated
  ON customers(business_id, is_deleted, last_transaction_at DESC);

CREATE INDEX IF NOT EXISTS idx_cust_entries_ledger
  ON customer_entries(business_id, customer_id, is_deleted, entry_date ASC, timestamp ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_cashbook_biz_date
  ON cashbook_entries(business_id, is_deleted, entry_date ASC, payment_mode, timestamp ASC);

CREATE INDEX IF NOT EXISTS idx_unsynced_businesses ON businesses(is_synced) WHERE is_synced = 0;
CREATE INDEX IF NOT EXISTS idx_unsynced_customers ON customers(is_synced) WHERE is_synced = 0;
CREATE INDEX IF NOT EXISTS idx_unsynced_cust_entries ON customer_entries(is_synced) WHERE is_synced = 0;
CREATE INDEX IF NOT EXISTS idx_unsynced_cashbook_entries ON cashbook_entries(is_synced) WHERE is_synced = 0;
```

### ৬.৫. ব্যালেন্স নীতি, Window Function এবং Customer Soft-Delete নিয়ম

অ্যাপের সমস্ত হিসাবের একমাত্র **Source of Truth হলো `customer_entries` এবং `cashbook_entries` টেবিল**।

#### ১. Cashbook-এর সকল ব্যালেন্স ও ডেইলি রিপোর্ট কুয়েরি (No Cached Columns)

```sql
-- (ক) ক্যাশবুক ড্যাশবোর্ড সামারি (Total Balance, Today's Balance, Cash in Hand ও Online Split)
SELECT
  ROUND(COALESCE(SUM(CASE WHEN payment_mode = 'CASH'   THEN (CASE WHEN type = 'IN' THEN amount ELSE -amount END) ELSE 0 END), 0), 2) AS total_cash,
  ROUND(COALESCE(SUM(CASE WHEN payment_mode = 'ONLINE' THEN (CASE WHEN type = 'IN' THEN amount ELSE -amount END) ELSE 0 END), 0), 2) AS total_online,
  ROUND(COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 0), 2) AS total_balance,
  ROUND(COALESCE(SUM(CASE WHEN entry_date = :todayDate AND payment_mode = 'CASH'   THEN (CASE WHEN type = 'IN' THEN amount ELSE -amount END) ELSE 0 END), 0), 2) AS today_cash,
  ROUND(COALESCE(SUM(CASE WHEN entry_date = :todayDate AND payment_mode = 'ONLINE' THEN (CASE WHEN type = 'IN' THEN amount ELSE -amount END) ELSE 0 END), 0), 2) AS today_online,
  ROUND(COALESCE(SUM(CASE WHEN entry_date = :todayDate THEN (CASE WHEN type = 'IN' THEN amount ELSE -amount END) ELSE 0 END), 0), 2) AS today_balance
FROM cashbook_entries
WHERE business_id = :businessId AND is_deleted = 0;

-- (খ) ক্যাশবুক রিপোর্ট: তারিখ অনুযায়ী Daily Balance এবং Cumulative Total Balance (Window Function)
WITH daily_summary AS (
  SELECT
    entry_date,
    ROUND(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 2) AS daily_balance
  FROM cashbook_entries
  WHERE business_id = :businessId AND is_deleted = 0
  GROUP BY entry_date
),
cumulative_summary AS (
  SELECT
    entry_date,
    daily_balance,
    ROUND(SUM(daily_balance) OVER (ORDER BY entry_date ASC), 2) AS total_balance
  FROM daily_summary
)
SELECT entry_date, daily_balance, total_balance
FROM cumulative_summary
WHERE entry_date BETWEEN :startDate AND :endDate
ORDER BY entry_date DESC;
```

#### ২. Customer Ledger-এর রানিং ব্যালেন্স (`Bal.`) কুয়েরি (Window Function)

```sql
SELECT
  id,
  type,
  amount,
  details,
  entry_date,
  entry_time,
  timestamp,
  ROUND(
    SUM(CASE WHEN type = 'GOT' THEN amount ELSE -amount END)
    OVER (
      PARTITION BY customer_id
      ORDER BY entry_date ASC, timestamp ASC, id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ),
    2
  ) AS running_balance
FROM customer_entries
WHERE business_id = :businessId
  AND customer_id = :customerId
  AND is_deleted = 0
ORDER BY entry_date DESC, timestamp DESC, id DESC;
```

#### ৩. `customers.net_balance` নীতি (Local-Only Cache, Never Synced)

* **`net_balance` কখনোই সিঙ্ক হবে না:** `customers.net_balance` এবং `customers.last_transaction_at` শুধুমাত্র ফোনের লোকাল হোম স্ক্রিন দ্রুত রেন্ডার করার জন্য Derived Cache। এগুলো কখনোই `/sync/push` বা `/sync/pull`-এর পেলোডে থাকবে না এবং সার্ভারের PostgreSQL `customers` টেবিলেও এই কলাম দুটি রাখার প্রয়োজন নেই।
* **`recomputeBalance()` কখনোই `updated_at` বা `is_synced` পরিবর্তন করবে না:** যখন কোনো কাস্টমারের এন্ট্রি যোগ/এডিট/ডিলিট হবে অথবা সার্ভার থেকে নতুন এন্ট্রি `pull` হবে, তখন `recomputeBalance()` শুধুমাত্র `net_balance` ও `last_transaction_at` আপডেট করবে। এটি কাস্টমার রো-এর `updated_at` বা `is_synced` স্পর্শ করবে না—যাতে শুধু ব্যালেন্স পরিবর্তনের কারণে অযথা কাস্টমারের প্রোফাইল রো সার্ভারে বারবার পুশ না হয়:

```typescript
export async function recomputeBalance(db: SQLiteDatabase, businessId: string, customerId: string) {
  await db.runAsync(
    `UPDATE customers
     SET net_balance = COALESCE((
           SELECT ROUND(SUM(CASE WHEN type = 'GOT' THEN amount ELSE -amount END), 2)
           FROM customer_entries
           WHERE business_id = ? AND customer_id = ? AND is_deleted = 0
         ), 0),
         last_transaction_at = (
           SELECT MAX(timestamp)
           FROM customer_entries
           WHERE business_id = ? AND customer_id = ? AND is_deleted = 0
         )
     WHERE id = ? AND business_id = ?;`,
    [businessId, customerId, businessId, customerId, customerId, businessId]
  );
}
```

* **ক্যাশ ছাড়া `GROUP BY` বনাম লোকাল ক্যাশের পারফরম্যান্স তুলনা:** কম্পোজিট ইনডেক্স থাকলে ৫০,০০০ এন্ট্রিতে সরাসরি `LEFT JOIN + GROUP BY` কুয়েরি চলতে ২–৫ মিলিসেকেন্ড সময় লাগে, আর লোকাল `net_balance` ক্যাশ কলাম থাকলে `< ১ মিলিসেকেন্ড` লাগে।

#### ৪. কাস্টমার Soft-Delete করার নিয়ম (`ON DELETE CASCADE` কেন কাজ করে না)

* **কেন `ON DELETE CASCADE` সফট-ডিলিটে কাজ করে না:** SQLite ও PostgreSQL-এ `FOREIGN KEY ... ON DELETE CASCADE` শুধুমাত্র ফিজিক্যাল `DELETE FROM customers` চালালে কাজ করে। কিন্তু আমাদের অফলাইন সিঙ্ক আর্কিটেকচারে ডিলিট মানে হলো `UPDATE customers SET is_deleted = 1`। ফলে কাস্টমার সফট-ডিলিট করলে তার অধীনে থাকা `customer_entries` স্বয়ংক্রিয়ভাবে ডিলিট হয় না।
* **আমাদের নির্বাচিত পদ্ধতি (Cascading Tombstone in Transaction + JOIN Guard):**
  আমরা **উভয় সুরক্ষা (Belt & Suspenders)** ব্যবহার করব, তবে মূল নীতি হিসেবে **কাস্টমার সফট-ডিলিট করার সময় একই ট্রানজেকশনে তার সব সক্রিয় এন্ট্রিগুলোকেও সফট-ডিলিট (`is_deleted = 1, is_synced = 0, updated_at = now`) করে দেওয়া হবে** এবং পাশাপাশি সব রিপোর্ট কুয়েরিতে `INNER JOIN customers c ON c.id = ce.customer_id AND c.is_deleted = 0` থাকবে।
  * **কেন এই পদ্ধতিটি সেরা?** যদি শুধু কুয়েরিতে JOIN দিয়ে এন্ট্রি লুকিয়ে রাখা হতো, তবে সার্ভারে এবং লোকাল ডিবিতে হাজার হাজার অনাথ (Orphan) এন্ট্রি `is_deleted = 0` অবস্থায় আজীবন থেকে যেত এবং কখনোই Tombstone Purge হতো না। আর একই ট্রানজেকশনে এন্ট্রিগুলোকেও `is_deleted = 1` করে দিলে সেগুলো সিঙ্ক হয়ে অন্য ডিভাইসেও ডিলিট হয়ে যাবে এবং রিটেনশন শেষে সার্ভার থেকেও পরিষ্কার হয়ে যাবে।

#### ৫. ব্যাকডেটেড এন্ট্রি (Backdated Entry) ও এডিটে ব্যালেন্স কীভাবে ঠিক থাকে (উদাহরণসহ)

ধরা যাক, কাস্টমার `Younus Mg`-এর খাতায় দুটি এন্ট্রি আছে:
* **১০ অক্টোবর:** `GAVE ৳ 1,000` $\implies$ `Bal. -1,000` (`You will get ৳ 1,000`)
* **১৫ অক্টোবর:** `GOT ৳ 400` $\implies$ `Bal. -600` (`You will get ৳ 600`)

এখন ১৮ অক্টোবরে বসে ইউজার যদি **১২ অক্টোবরের (Backdated)** একটি এন্ট্রি যোগ করেন (`GOT ৳ 300`):
* যেহেতু রানিং ব্যালেন্স স্টোর করা নেই এবং Window Function-এ `ORDER BY entry_date ASC, timestamp ASC, id ASC` দেওয়া আছে, তাই সাথে সাথেই কুয়েরিতে ১০ অক্টোবরের পরে ১২ অক্টোবরের এন্ট্রি বসে যাবে (`10 Oct: Bal. ৳ 1,000 Red` $\rightarrow$ `12 Oct: Bal. ৳ 700 Red` $\rightarrow$ `15 Oct: Bal. ৳ 300 Red`) এবং `recomputeBalance()`-এর মাধ্যমে নেট ব্যালেন্সও `৳ 300` হয়ে যাবে।

## ৭. ফেজ ২ কাস্টম ব্যাকএন্ড আর্কিটেকচার: Node.js + Express + Prisma + PostgreSQL

ফেজ ১ (MVP) সম্পূর্ণ লোকাল-অনলি এবং লগইন ছাড়া থাকবে। ফেজ ২-তে ক্লাউড ব্যাকআপ ও মাল্টি-ডিভাইস সিঙ্কের জন্য কোনো থার্ড-পার্টি BaaS-এর ওপর নির্ভর না করে আমাদের নিজস্ব **Node.js + TypeScript + Express + Prisma + PostgreSQL** ব্যাকএন্ড ব্যবহৃত হবে।

### ৭.১. ব্যাকএন্ড টেক স্ট্যাক ও কেন এটি প্রচলিত BaaS-এর চেয়ে দ্রুত

* **কোর স্ট্যাক:** [Node.js](https://www.google.com/search?q=https%3A%2F%2Fnodejs.org%2Fen%2Fdownload) + TypeScript + [Express.js](https://www.google.com/search?q=https%3A%2F%2Fexpressjs.com%2F) + [Prisma ORM](https://www.google.com/search?q=https%3A%2F%2Fwww.prisma.io%2Fdocs) + **PostgreSQL** (যেকোনো Managed Postgres যেমন Neon, Railway, Render, DigitalOcean বা AWS RDS-এ হোস্ট করা যাবে, যেখানে PgBouncer / Connection Pooler স্ট্রিং ব্যবহৃত হবে)।
* **অথরাইজেশন মডেল:** ডাটাবেজ-লেভেল Row Level Security (RLS)-এর ওপর কোনো নির্ভরতা থাকবে না; সমস্ত অথেনটিকেশন ও অথরাইজেশন আমাদের নিজস্ব **Express API Middleware**-এ নিয়ন্ত্রিত হবে।
* **পারফরম্যান্স নোট (কেন নিজস্ব Node.js API বেশি দ্রুত):**
  1. **Single Round-Trip Batch Sync:** ক্লায়েন্ট থেকে ৪টি আলাদা টেবিলের জন্য ৪ বার নেটওয়ার্ক কল না করে, মাত্র ১টি `POST /sync/push` বা `GET /sync/pull` রিকোয়েস্টে সব টেবিলের ডেটা একসাথে আদান-প্রদান করা হয়।
  2. **Zero RLS Overhead:** প্রতি রো-তে RLS পলিসি ইভ্যালুয়েশনের বদলে মিডলওয়্যারে একবার ইউজার ও `business_id` ওনারশিপ চেক করে সরাসরি ইনডেক্সড কুয়েরি চালানো হয়।

### ৭.২. অথেনটিকেশন ও অথরাইজেশন ডিজাইন (Auth & Ownership Middleware)

* **লগইন মেকানিজম:**
  1. **Google Sign-In (`POST /auth/google`):** মোবাইল অ্যাপ থেকে পাওয়া Google `idToken` সার্ভারে অফিশিয়াল [google-auth-library](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fgoogleapis%2Fgoogle-auth-library-nodejs) দিয়ে ভেরিফাই করা হবে (১০০% ফ্রি)।
  2. **Email + Password (`POST /auth/register`, `POST /auth/login`):** পাসওয়ার্ড সার্ভারে **`argon2`** (অথবা `bcrypt`) দিয়ে হ্যাশ করে স্টোর করা হবে।
  3. **Sign in with Apple (iOS নোট):** iPhone-এ Google Sign-In থাকলে App Store গাইডলাইন অনুযায়ী iOS বিল্ডে `Sign in with Apple` টোকেন ভেরিফিকেশন অপশনও রাখা হবে।
* **JWT Access Token + Refresh Token Rotation:**
  * লগইন সফল হলে সার্ভার একটি স্বল্পমেয়াদি **Access Token (JWT, মেয়াদ ১৫ মিনিট)** এবং একটি দীর্ঘমেয়াদি **Refresh Token (মেয়াদ ৩০ দিন, হ্যাশ করে `refresh_tokens` টেবিলে সংরক্ষিত)** দেবে।
  * মোবাইলে টোকেন দুটি `expo-secure-store`-এ সুরক্ষিত থাকবে। প্রতিবার `/auth/refresh` কল হলে পুরনো Refresh Token বাতিল (Revoke) করে নতুন জোড়া টোকেন দেওয়া হবে (**Refresh Token Rotation**)।
* **লগইন অপশনগুলোর ট্রেড-অফ টেবিল (Bangladesh Context):**

| লগইন পদ্ধতি (Auth Method) | সুবিধা (Pros) | অসুবিধা / খরচ (Cons in Bangladesh) |
| :--- | :--- | :--- |
| **১. Phone OTP (SMS)** | সাধারণ ব্যবসায়ীদের কাছে পরিচিত। | বাংলাদেশে SMS গেটওয়েতে প্রতিটি OTP পাঠাতে **৳০.৩০–৳০.৫০+** খরচ হয়, যা শুরুতে অপ্রয়োজনীয় খরচের বোঝা। |
| **২. Google Sign-In (Server Verified)** | **১০০% ফ্রি**, পাসওয়ার্ড মনে রাখার ঝামেলা নেই; বাংলাদেশের প্রায় প্রতিটি Android ফোনে Google অ্যাকাউন্ট লগইন করাই থাকে। | iOS App Store-এ রিলিজের সময় এর পাশাপাশি Sign in with Apple রাখা বাধ্যতামূলক। |
| **৩. Email + Password (Argon2)** | আমাদের নিজস্ব Node.js সার্ভারে **সম্পূর্ণ ফ্রি**, যেকোনো ডিভাইসে নির্ভরযোগ্যভাবে কাজ করে। | কিছু ইউজার পাসওয়ার্ড ভুলে যেতে পারেন (রিসেট ফ্লো রাখতে হবে)। |

> **সুপারিশ:** **Google Sign-In (প্রাইমারি) + Email/Password (ফলব্যাক)** ব্যবহার করা হবে।

* **Authorization Middleware নিয়ম:**
  প্রতিটি প্রোটেক্টেড রিকোয়েস্টে মিডলওয়্যার আগে JWT ভেরিফাই করে `req.userId` বের করবে। এরপর রিকোয়েস্টের পেলোড বা কুয়েরিতে থাকা প্রতিটি `business_id` সত্যিই ওই `req.userId`-এর মালিকানাধীন কিনা (`SELECT id FROM businesses WHERE id IN (...) AND owner_user_id = req.userId`) তা চেক করবে। অন্য কারো `business_id` পাঠালে সাথে সাথে `403 Forbidden` রিটার্ন করবে।
* **ফেজ ১ থেকে ফেজ ২ ট্রানজিশন নোট (স্কিমা ও সার্ভার কাজের স্পষ্টীকরণ):**
  * **লোকাল SQLite-এ** ডে-১ থেকেই `owner_user_id` এবং সিঙ্ক কলামগুলো থাকায় ফেজ ২-তে লোকাল অ্যাপে কোনো ব্রেকিং স্কিমা রিরাইট লাগবে না। ইউজার প্রথমবার লগইন করলে লোকালে `UPDATE businesses SET owner_user_id = :serverUserId, is_synced = 0, updated_at = :now WHERE owner_user_id IS NULL;` চালিয়ে সব লোকাল ডেটা ইউজারের সার্ভার অ্যাকাউন্টের (`users.id`) সাথে যুক্ত করা হবে।
  * তবে **সার্ভার-সাইডে (Phase 2)** আলাদাভাবে Prisma স্কিমা মাইগ্রেশন, PostgreSQL-এ `server_updated_at` ট্রিগার সেটআপ, `devices` ও `refresh_tokens` টেবিল তৈরি এবং Auth/Sync মিডলওয়্যার তৈরি করতে হবে।

### ৭.৩. বাগ-মুক্ত সিঙ্ক প্রোটোকল (Production-Grade Sync Mechanics)

অফলাইন সিঙ্কের ক্লাসিক বাগগুলো এড়াতে নিচের ৫টি নিয়ম বাধ্যতামূলকভাবে কার্যকর থাকবে:

#### ১. Pull কার্সরে ক্লায়েন্ট ঘড়ির বদলে সার্ভার-টাইম `(server_updated_at, id)` ব্যবহার

* **কেন ক্লায়েন্টের `updated_at` দিয়ে Pull কার্সর চালানো যাবে না:** কোনো ইউজারের ফোনের ঘড়ি যদি ভুলবশত ১০ মিনিট পিছিয়ে থাকে এবং তিনি একটি এন্ট্রি এডিট করে সার্ভারে পুশ করেন, তবে অন্য ডিভাইস যে ইতিমধ্যে বর্তমান সময়ে Pull করে ফেলেছে, সে আর কখনোই ওই পিছিয়ে থাকা ঘড়ির এডিটটি খুঁজে পাবে না!
* **সমাধান:** সার্ভারের প্রতিটি সিঙ্ক টেবিলে (`businesses`, `customers`, `customer_entries`, `cashbook_entries`) আলাদা **`server_updated_at TIMESTAMPTZ`** কলাম থাকবে, যা ক্লায়েন্ট কখনোই পাঠাতে পারবে না; সার্ভারে প্রতিটি `INSERT` বা `UPDATE`-এর সময় PostgreSQL Trigger / `now()` দিয়ে সার্ভার নিজে এই সময় বসাবে।
* **Pull Cursor:** ক্লায়েন্ট যখন `GET /sync/pull` কল করবে, তখন কার্সর হিসেবে **`(server_updated_at, id)`** জোড়া ব্যবহৃত হবে। আর ক্লায়েন্টের পাঠানো `updated_at` শুধুমাত্র **Last-Write-Wins (LWW) Conflict Resolution**-এর সময় কোন এডিটটি নতুন তা তুলনা করতে ব্যবহৃত হবে (সার্ভারে ৫ মিনিটের বেশি ভবিষ্যৎ ক্লায়েন্ট টাইমস্ট্যাম্প আসলে তা সার্ভার টাইমে Clamp করা হবে)।

#### ২. Tombstone Purge নিয়ম এবং `410 Gone` ফুল-রিসিঙ্ক (`Zombie Entry` প্রতিরোধ)

* **কেন অন্ধভাবে "৩০ দিন পর Purge" করলে বাগ হয়:** ধরা যাক ইউজারের একটি পুরনো ট্যাবলেট ৪৫ দিন বন্ধ ছিল। এর মধ্যে ইউজার মূল ফোনে একটি এন্ট্রি ডিলিট করেছেন (`is_deleted = 1`) এবং ৩০ দিন পর সার্ভার সেই Tombstone রো-টি ডাটাবেজ থেকে মুছে (Purge) ফেলেছে। এখন ৪৫ দিন পর পুরনো ট্যাবলেটটি অন হয়ে সিঙ্ক করলে সে কখনোই জানবে না যে এন্ট্রিটি ডিলিট হয়েছিল—ফলে ডিলিট হওয়া এন্ট্রিটি ট্যাবলেটে জীবিত থেকে যাবে বা আবার সার্ভারে পুশ হয়ে জীবিত (Zombie Resurrection) হয়ে যাবে!
* **সঠিক Tombstone Purge ও `410 Gone` নিয়ম:**
  1. সার্ভারে একটি **`devices`** টেবিল থাকবে যেখানে প্রতিটি ডিভাইসের `device_id`, `user_id`, এবং `last_pulled_at` (`server_updated_at`) সংরক্ষিত থাকবে।
  2. কোনো সফট-ডিলিট হওয়া রো (`is_deleted = 1`) সার্ভার থেকে শুধুমাত্র তখনই স্থায়ীভাবে Purge করা যাবে যখন **ওই ইউজারের সকল সক্রিয় ডিভাইসের `last_pulled_at` ওই রো-এর `server_updated_at` পার করে গেছে**, অথবা রো-টি ডিলিট হওয়ার পর **৯০ দিন (Retention Window)** পার হয়ে গেছে।
  3. যদি কোনো ডিভাইস ৯০ দিনের বেশি অফলাইনে থাকার পর পুরনো কার্সর নিয়ে `GET /sync/pull` কল করে (অর্থাৎ `cursor.server_updated_at < now() - 90 days`), তবে সার্ভার **`HTTP 410 Gone` (`{ "error": "CURSOR_EXPIRED_FULL_RESYNC_REQUIRED" }`)** রিটার্ন করবে।
  4. ক্লায়েন্ট `410 Gone` পেলে প্রথমে নিজের আনসিঙ্কড রো (`is_synced = 0`) পুশ করে নেবে, এরপর লোকাল সিঙ্কড ক্যাশ ক্লিয়ার করে শুরু থেকে (`cursor = null`) ফ্রেশ Pull করে নেবে।

#### ৩. Push/Pull মেকানিক্স: FK ক্রম, Idempotency ও Conflict রিপোর্ট

* **Foreign Key (FK) ক্রম:** রেফারেন্সিয়াল ইন্টিগ্রিটি বজায় রাখতে Push এবং Pull উভয় ক্ষেত্রেই টেবিলের ডেটা সবসময় এই নির্দিষ্ট ক্রমে প্রসেস হবে:
  **`1. businesses` $\rightarrow$ `2. customers` $\rightarrow$ `3. customer_entries` $\rightarrow$ `4. cashbook_entries`**।
* **Idempotent Push (`Idempotency-Key`):** নেটওয়ার্ক ড্রপের কারণে একই `POST /sync/push` রিকোয়েস্ট দুইবার সার্ভারে গেলে যেন কোনো ক্ষতি না হয়, সেজন্য প্রতিটি রো UUID প্রাইমারি কি দিয়ে `ON CONFLICT (id) DO UPDATE` (Upsert) হবে এবং হেডারে `Idempotency-Key` থাকবে।
* **Conflict Resolution ও রেসপন্স তালিকা:** পুশ করার সময় সার্ভারে যদি দেখা যায় `server_row.updated_at > incoming_row.updated_at`, তবে সার্ভারের রো-টিই জয়ী হবে। সার্ভার রেসপন্সে স্পষ্টভাবে জানিয়ে দেবে কোন কোন আইডি গৃহীত হয়েছে (`accepted`) এবং কোন কোন আইডি কনফ্লিক্টের কারণে প্রত্যাখ্যাত হয়েছে (`rejected_conflicts` সহ সার্ভারের সর্বশেষ ভার্সন, যাতে ক্লায়েন্ট সাথে সাথে লোকাল কপি আপডেট করে `is_synced = 1` করে দিতে পারে)।

### ৭.৪. সার্ভার-সাইড PostgreSQL ও Prisma স্কিমা (`apps/api/prisma/schema.prisma`)

সার্ভারের PostgreSQL ডাটাবেজে `users`, `refresh_tokens`, `devices`, `businesses`, `customers`, `customer_entries`, এবং `cashbook_entries` টেবিল থাকবে। এখানে সব টাকার অ্যামাউন্ট **`Decimal` (`@db.Decimal(14, 2)`)**, প্রতিটি সিঙ্ক টেবিলে **`serverUpdatedAt`** এবং কম্পোজিট কার্সর ইনডেক্স থাকবে (`customers` টেবিলে কোনো `net_balance` নেই):

```prisma
// apps/api/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // Pooled connection string (e.g. PgBouncer)
  directUrl = env("DIRECT_DATABASE_URL") // Direct connection for migrations
}

enum CurrencyCode {
  BDT
  INR
}

enum CustomerEntryType {
  GAVE
  GOT
}

enum CashbookEntryType {
  OUT
  IN
}

enum PaymentMode {
  CASH
  ONLINE
}

model User {
  id            String         @id @default(uuid()) @db.Uuid
  email         String         @unique
  name          String?
  passwordHash  String?        @map("password_hash")
  googleSub     String?        @unique @map("google_sub")
  appleSub      String?        @unique @map("apple_sub")
  createdAt     DateTime       @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime       @updatedAt @map("updated_at") @db.Timestamptz(3)

  refreshTokens RefreshToken[]
  devices       Device[]
  businesses    Business[]

  @@map("users")
}

model RefreshToken {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  deviceId    String    @map("device_id") @db.Uuid
  tokenHash   String    @unique @map("token_hash")
  expiresAt   DateTime  @map("expires_at") @db.Timestamptz(3)
  revokedAt   DateTime? @map("revoked_at") @db.Timestamptz(3)
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, deviceId])
  @@map("refresh_tokens")
}

model Device {
  id               String   @id @db.Uuid // Client generated device_id (UUID v7)
  userId           String   @map("user_id") @db.Uuid
  deviceName       String?  @map("device_name")
  platform         String?  // 'android' | 'ios'
  lastPulledCursor String?  @map("last_pulled_cursor")
  lastPulledAt     DateTime? @map("last_pulled_at") @db.Timestamptz(3)
  lastSeenAt       DateTime @default(now()) @map("last_seen_at") @db.Timestamptz(3)

  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, lastPulledAt])
  @@map("devices")
}

model Business {
  id              String          @id @db.Uuid // UUID v7 from client
  ownerUserId     String          @map("owner_user_id") @db.Uuid
  name            String
  currency        CurrencyCode    @default(BDT)
  createdAt       BigInt          @map("created_at")        // Client UTC ms
  updatedAt       BigInt          @map("updated_at")        // Client UTC ms (for LWW)
  serverUpdatedAt DateTime        @default(now()) @map("server_updated_at") @db.Timestamptz(6)
  isDeleted       Boolean         @default(false) @map("is_deleted")

  owner           User            @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  customers       Customer[]
  customerEntries CustomerEntry[]
  cashbookEntries CashbookEntry[]

  @@index([ownerUserId, serverUpdatedAt, id])
  @@map("businesses")
}

model Customer {
  id              String          @id @db.Uuid // UUID v7
  businessId      String          @map("business_id") @db.Uuid
  name            String
  phone           String?
  avatarInitials  String          @map("avatar_initials")
  // Note: net_balance is NEVER stored on server; derived on client from customer_entries
  createdAt       BigInt          @map("created_at")
  updatedAt       BigInt          @map("updated_at")
  serverUpdatedAt DateTime        @default(now()) @map("server_updated_at") @db.Timestamptz(6)
  isDeleted       Boolean         @default(false) @map("is_deleted")

  business        Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  entries         CustomerEntry[]

  @@index([businessId, serverUpdatedAt, id])
  @@map("customers")
}

model CustomerEntry {
  id              String            @id @db.Uuid // UUID v7
  businessId      String            @map("business_id") @db.Uuid
  customerId      String            @map("customer_id") @db.Uuid
  type            CustomerEntryType
  amount          Decimal           @db.Decimal(14, 2)
  details         String?
  entryDate       String            @map("entry_date") @db.VarChar(10) // 'YYYY-MM-DD'
  entryTime       String            @map("entry_time") @db.VarChar(16) // '11:56 AM'
  timestamp       BigInt
  createdAt       BigInt            @map("created_at")
  updatedAt       BigInt            @map("updated_at")
  serverUpdatedAt DateTime          @default(now()) @map("server_updated_at") @db.Timestamptz(6)
  isDeleted       Boolean           @default(false) @map("is_deleted")

  business        Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
  customer        Customer          @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([businessId, serverUpdatedAt, id])
  @@index([customerId, isDeleted, entryDate])
  @@map("customer_entries")
}

model CashbookEntry {
  id              String            @id @db.Uuid // UUID v7
  businessId      String            @map("business_id") @db.Uuid
  type            CashbookEntryType
  paymentMode     PaymentMode       @map("payment_mode")
  amount          Decimal           @db.Decimal(14, 2)
  details         String?
  entryDate       String            @map("entry_date") @db.VarChar(10)
  entryTime       String            @map("entry_time") @db.VarChar(16)
  timestamp       BigInt
  createdAt       BigInt            @map("created_at")
  updatedAt       BigInt            @map("updated_at")
  serverUpdatedAt DateTime          @default(now()) @map("server_updated_at") @db.Timestamptz(6)
  isDeleted       Boolean           @default(false) @map("is_deleted")

  business        Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId, serverUpdatedAt, id])
  @@map("cashbook_entries")
}
```

#### PostgreSQL `server_updated_at` Database Trigger (Migration SQL)

সার্ভারে র-এসকিউএল বা Prisma যেভাবেই আপডেট হোক না কেন, `server_updated_at` যেন সবসময় সার্ভারের ঘড়ি অনুযায়ী স্বয়ংক্রিয়ভাবে আপডেট হয়, সেজন্য নিচের PostgreSQL ট্রিগারটি মাইগ্রেশনে যুক্ত থাকবে:

```sql
CREATE OR REPLACE FUNCTION set_server_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.server_updated_at = clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_businesses_server_ts BEFORE INSERT OR UPDATE ON businesses
FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

CREATE TRIGGER trg_customers_server_ts BEFORE INSERT OR UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

CREATE TRIGGER trg_customer_entries_server_ts BEFORE INSERT OR UPDATE ON customer_entries
FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

CREATE TRIGGER trg_cashbook_entries_server_ts BEFORE INSERT OR UPDATE ON cashbook_entries
FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();
```

### ৭.৫. REST API এন্ডপয়েন্ট ও রিকোয়েস্ট/রেসপন্স উদাহরণ (API Contract)

#### ১. Auth Endpoints

* `POST /auth/google` — Body: `{ "idToken": "...", "deviceId": "0192a...", "deviceName": "Redmi Note 13", "platform": "android" }`
* `POST /auth/register` — Body: `{ "name": "...", "email": "...", "password": "...", "deviceId": "..." }`
* `POST /auth/login` — Body: `{ "email": "...", "password": "...", "deviceId": "..." }`
* `POST /auth/refresh` — Body: `{ "refreshToken": "...", "deviceId": "..." }`

**Auth Response (`200 OK`):**
```json
{
  "user": {
    "id": "0192a8b0-7c12-7000-8000-000000000001",
    "email": "merchant@example.com",
    "name": "Easha Enterprises"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "rt_9f8e7d6c5b4a..."
}
```

#### ২. Batch Push Endpoint (`POST /sync/push`)

* **Headers:** `Authorization: Bearer <accessToken>`, `Idempotency-Key: <uuid-v7>`
* **সীমা:** প্রতি রিকোয়েস্টে সর্বোচ্চ `200` রো (বড় ব্যাচ হলে ক্লায়েন্ট ২০০টি করে ভেঙে পাঠাবে)।
* **Request Body:**
```json
{
  "deviceId": "0192a8b0-0000-7000-8000-111111111111",
  "changes": {
    "businesses": [
      {
        "id": "0192a8b1-1111-7000-8000-000000000001",
        "name": "আমার দোকান",
        "currency": "BDT",
        "createdAt": 1792300000000,
        "updatedAt": 1792300000000,
        "isDeleted": false
      }
    ],
    "customers": [
      {
        "id": "0192a8b2-2222-7000-8000-000000000002",
        "businessId": "0192a8b1-1111-7000-8000-000000000001",
        "name": "Younus Mg",
        "phone": "01700000000",
        "avatarInitials": "YM",
        "createdAt": 1792300100000,
        "updatedAt": 1792300100000,
        "isDeleted": false
      }
    ],
    "customerEntries": [
      {
        "id": "0192a8b3-3333-7000-8000-000000000003",
        "businessId": "0192a8b1-1111-7000-8000-000000000001",
        "customerId": "0192a8b2-2222-7000-8000-000000000002",
        "type": "GOT",
        "amount": "60380.00",
        "details": "Cash paid",
        "entryDate": "2026-10-18",
        "entryTime": "11:56 AM",
        "timestamp": 1792300200000,
        "createdAt": 1792300200000,
        "updatedAt": 1792300200000,
        "isDeleted": false
      }
    ],
    "cashbookEntries": []
  }
}
```

* **Response (`200 OK`):**
```json
{
  "accepted": {
    "businesses": ["0192a8b1-1111-7000-8000-000000000001"],
    "customers": ["0192a8b2-2222-7000-8000-000000000002"],
    "customerEntries": ["0192a8b3-3333-7000-8000-000000000003"],
    "cashbookEntries": []
  },
  "rejectedConflicts": {
    "businesses": [],
    "customers": [],
    "customerEntries": [],
    "cashbookEntries": []
  },
  "serverTime": "2026-10-18T19:00:01.234567Z"
}
```

#### ৩. Paginated Pull Endpoint (`GET /sync/pull`)

* **Query Params:** `GET /sync/pull?deviceId=0192a...&cursor=2026-10-18T18:00:00.000000Z_0192a8b3-3333-7000-8000-000000000003&limit=200`
* **Cursor Logic:** সার্ভার `(server_updated_at, id) > (:cursorTs, :cursorId)` শর্তে ডেটা ফেচ করবে এবং শেষে ডিভাইসের `last_pulled_at` আপডেট করবে। কার্সর ৯০ দিনের পুরনো হলে `410 Gone` দেবে।
* **Response (`200 OK`):**
```json
{
  "changes": {
    "businesses": [],
    "customers": [],
    "customerEntries": [
      {
        "id": "0192a8b4-4444-7000-8000-000000000004",
        "businessId": "0192a8b1-1111-7000-8000-000000000001",
        "customerId": "0192a8b2-2222-7000-8000-000000000002",
        "type": "GAVE",
        "amount": "1500.50",
        "details": "Baki",
        "entryDate": "2026-10-18",
        "entryTime": "07:15 PM",
        "timestamp": 1792329300000,
        "createdAt": 1792329300000,
        "updatedAt": 1792329300000,
        "serverUpdatedAt": "2026-10-18T19:05:10.112233Z",
        "isDeleted": false
      }
    ],
    "cashbookEntries": []
  },
  "nextCursor": "2026-10-18T19:05:10.112233Z_0192a8b4-4444-7000-8000-000000000004",
  "hasMore": false
}
```

### ৭.৬. Backend Engineering Checklist (Non-Functional Requirements)

1. **Request Validation (`zod`):** প্রতিটি API রিকোয়েস্ট বডি, কুয়েরি প্যারামিটার এবং UUID/Amount ফরম্যাট Express মিডলওয়্যারে `zod` স্কিমা দিয়ে ভ্যালিডেট করতে হবে।
2. **Rate Limiting & Security Headers:** `helmet`, `cors`, এবং `express-rate-limit` ব্যবহার করতে হবে (যেমন `/auth/*` এন্ডপয়েন্টে প্রতি ১৫ মিনিটে সর্বোচ্চ ১০টি রিকোয়েস্ট এবং `/sync/*`-এ প্রতি মিনিটে ৬০টি রিকোয়েস্ট)।
3. **Structured Logging (`pino`):** প্রতিটি রিকোয়েস্টে `requestId`, `userId`, `deviceId`, এবং execution duration সহ JSON ফরম্যাটে লগ (`pino` + `pino-http`) করতে হবে (কখনোই লগে পাসওয়ার্ড বা টোকেন প্রিন্ট করা যাবে না)।
4. **OpenAPI 3.1 / Swagger Documentation:** `zod-to-openapi` বা `@asteasolutions/zod-to-openapi` ব্যবহার করে `/docs` রাউটে স্বয়ংক্রিয় Swagger UI জেনারেট করতে হবে।
5. **Integration Tests (PostgreSQL Container):** `vitest` + `supertest` এবং একটি আসল টেস্ট PostgreSQL ডাটাবেজে (Docker container-এ) সিঙ্কের ৪টি মূল টেস্ট কেস বাধ্যতামূলকভাবে লিখতে হবে: (ক) Idempotent Push, (খ) LWW Conflict Resolution, (গ) Cursor Pagination (`hasMore`), এবং (ঘ) Cross-User `business_id` Authorization (`403 Forbidden`)।
6. **Docker, CI & Deployment:** মাল্টি-স্টেজ `Dockerfile` এবং লোকাল ডেভেলপমেন্টের জন্য `docker-compose.yml` (Postgres 16 সহ) থাকবে। GitHub Actions CI-তে প্রতিটি PR-এ `tsc --noEmit`, `prisma validate`, এবং integration test রান হবে।

## ৮. অপরিহার্য ফিচার তালিকা ও অগ্রাধিকার (Prioritized Feature Roadmap)

### ৮.১. Must-Have (MVP — Phase 1-এই থাকতে হবে)

1. **App PIN / Biometric Lock:** দোকানের ফোন অন্য কারো হাতে গেলে হিসাব নিরাপদ রাখতে ৪-ডিজিট PIN এবং ফিঙ্গারপ্রিন্ট/FaceID লক (`expo-local-authentication` + `expo-secure-store`)।
2. **ডেটা এক্সপোর্ট/ইমপোর্ট (CSV/JSON) ও লোকাল `.db` ব্যাকআপ-রিস্টোর:** এক ক্লিকে পুরো ডাটাবেজ (`.db`, `PRAGMA user_version` চেকসহ) বা JSON/CSV ব্যাকআপ ফাইল তৈরি করে নিজের Google Drive বা WhatsApp-এ রাখা এবং রিস্টোর করার সুবিধা।
3. **বাংলা / ইংরেজি ভাষা (`bn` / `en`) ও কারেন্সি (`BDT ৳` / `INR ₹`) সেটিংস:** সেটিংস থেকে এক ট্যাপে পুরো অ্যাপের ভাষা এবং কারেন্সি পরিবর্তন করার সুবিধা।
4. **Customer Entry ডিলিটেও Undo সুবিধা:** ক্যাশবুকের মতোই কাস্টমার লেজারেও কোনো এন্ট্রি ডিলিট করলে নিচে ৫ সেকেন্ডের জন্য `Entry Deleted [UNDO]` স্ন্যাকবার দেখানো।
5. **কঠোর ইনপুট ভ্যালিডেশন (Input Validation):**
   * `amount > 0` এবং সর্বোচ্চ সীমা (`amount <= 99,99,99,999.99`) চেক।
   * **ভবিষ্যতের তারিখ নীতি (Future Date Policy):** এন্ট্রি করার সময় তারিখ পিকারে আজকের পরের কোনো ভবিষ্যৎ তারিখ (`entry_date > today`) সিলেক্ট করা ব্লক থাকবে।
   * **ডুপ্লিকেট ফোন নম্বর সতর্কবার্তা:** নতুন কাস্টমার যোগ করার সময় একই বিজনেসে ওই মোবাইল নম্বর আগে থেকেই থাকলে সতর্কবার্তা দেখানো।
6. **Empty State ও প্রথমবারের অনবোর্ডিং:** অ্যাপ প্রথমবার ওপেন করলে ব্যবসার নাম ও কারেন্সি (`BDT`) সেট করার অনবোর্ডিং স্ক্রিন; এবং কাস্টমার বা এন্ট্রি না থাকলে ভিজ্যুয়াল Empty State নির্দেশিকা।

### ৮.২. Phase 2 (পরবর্তী ধাপে যুক্ত হবে)

1. **কাস্টম ক্লাউড সিঙ্ক ও লগইন:** আমাদের নিজস্ব Node.js + Express + Prisma + PostgreSQL ব্যাকএন্ডের সাথে ব্যাকগ্রাউন্ড সিঙ্ক।
2. **লোকাল ডাটাবেজ এনক্রিপশন (SQLCipher):** ফোনের লোকাল SQLite ফাইল পাসওয়ার্ড/কি দিয়ে এনক্রিপ্ট করা।
3. **এন্ট্রি অডিট ও এডিট হিস্ট্রি (Edit Audit Log):** কোনো এন্ট্রির টাকা বা তারিখ কবে, কখন পরিবর্তন করা হয়েছে তার লগ দেখানো।
4. **ক্র্যাশ ও এরর রিপোর্টিং:** `@sentry/react-native` দিয়ে প্রোডাকশন ক্র্যাশ ট্র্যাকিং।
5. **Play Store ও App Store কমপ্লায়েন্স:** ইন-অ্যাপ Privacy Policy লিংক, Google Play Data Safety ফর্ম এবং অ্যাকাউন্ট ও ডেটা ডিলিট করার অপশন (`DELETE /auth/account`)।
6. **ফোনবুক কন্টাক্ট ইমপোর্ট (`expo-contacts`):** কাস্টমার যোগ করার সময় ফোনের কন্টাক্ট লিস্ট থেকে নাম ও নম্বর সিলেক্ট করার সুবিধা।

## ৯. কোডিং স্ট্যাক, সেটআপ নোট ও প্রজেক্ট ফোল্ডার স্ট্রাকচার (Tech Stack & Monorepo Structure)

### ৯.১. ফেজ অনুযায়ী মোবাইল লাইব্রেরি নির্বাচন (Phased Mobile Library Selection)

* **ডে-১ আবশ্যক (Day-1 Core):**
  * Framework & Routing: `expo`, `react-native`, `typescript`, [expo-router](https://www.google.com/search?q=https%3A%2F%2Fdocs.expo.dev%2Fdevelop%2Fapp-navigation%2F)
  * Database & UUID v7: [expo-sqlite](https://www.google.com/search?q=https%3A%2F%2Fdocs.expo.dev%2Fversions%2Flatest%2Fsdk%2Fsqlite%2F), `uuid`, **`react-native-get-random-values`** *(এন্ট্রি ফাইলের সবার উপরে ইম্পোর্ট করা বাধ্যতামূলক)*
* **ফিচার তৈরির সময় পর্যায়ক্রমে যুক্ত হবে (Add When Needed):**
  * **High-Performance Lists:** `@shopify/flash-list`
  * **Animations & Gestures:** `react-native-reanimated`, `react-native-gesture-handler`
  * **UI State Only:** `zustand` *(শুধুমাত্র `activeBusinessId`, ফিল্টার/সর্ট স্টেট এবং Undo স্ন্যাকবার স্টেট; ডাটাবেজের ডেটা এখানে রাখা যাবে না)*
  * **Forms & Validation:** `react-hook-form` + `zod` (সাধারণ ফর্মের জন্য; ক্যালকুলেটর কিপ্যাড কাস্টম লোকাল স্টেটে থাকবে)
  * **Localization:** `i18next`, `react-i18next`, `expo-localization`
  * **PDF, Backup & Security:** [expo-print](https://www.google.com/search?q=https%3A%2F%2Fdocs.expo.dev%2Fversions%2Flatest%2Fsdk%2Fprint%2F), [expo-sharing](https://www.google.com/search?q=https%3A%2F%2Fdocs.expo.dev%2Fversions%2Flatest%2Fsdk%2Fsharing%2F), [expo-file-system](https://www.google.com/search?q=https%3A%2F%2Fdocs.expo.dev%2Fversions%2Flatest%2Fsdk%2Ffilesystem%2F), `expo-document-picker`, `expo-local-authentication`, `expo-secure-store`
* **Drizzle ORM (ঐচ্ছিক / Optional on Mobile):**
  * Expo-তে `.sql` মাইগ্রেশন বান্ডেল করার ঝামেলার চেয়ে আমাদের `PRAGMA user_version` ও Raw SQL (`db.getAllAsync`) অনেক বেশি হালকা ও নির্ভরযোগ্য। রানিং ব্যালেন্স ও রিপোর্টের Window Function সবসময় Raw SQL-এই থাকবে।
* **Mobile `syncService.ts` Interface Abstraction:**
  মোবাইল অ্যাপে সিঙ্ক লজিক একটি পরিষ্কার ইন্টারফেসের পেছনে থাকবে, যাতে ভবিষ্যতে ব্যাকএন্ডের ইউআরএল বা মেকানিজম বদলালেও অ্যাপের কোনো UI বা DB কোড স্পর্শ করতে না হয়:
  ```typescript
  export interface SyncTransport {
    push(payload: SyncPushRequest, idempotencyKey: string): Promise<SyncPushResponse>;
    pull(deviceId: string, cursor: string | null, limit: number): Promise<SyncPullResponse>;
  }
  ```

### ৯.২. Windows + VS Code ডেভেলপমেন্ট ও iOS/Android বিল্ড নোট

1. **শুধু VS Code ও Node.js:** আপনার Windows পিসিতে ভারী Android Studio ছাড়াই শুধুমাত্র [Node.js](https://www.google.com/search?q=https%3A%2F%2Fnodejs.org%2Fen%2Fdownload) ও VS Code দিয়ে পুরো মোবাইল অ্যাপ এবং Node.js ব্যাকএন্ড ডেভেলপমেন্ট করা যাবে।
2. **Windows-এ iPhone টেস্টিংয়ের নিয়ম:** যেহেতু iOS Simulator শুধুমাত্র macOS-এ চলে, তাই Windows পিসি থেকে iOS টেস্ট করার উপায় হলো **আসল iPhone-এ [Expo Go](https://www.google.com/search?q=https%3A%2F%2Fexpo.dev%2Fgo) অ্যাপ ইনস্টল করে** লোকাল Wi-Fi বা `--tunnel` দিয়ে QR কোড স্ক্যান করে টেস্ট করা।
3. **Development Build (`expo-dev-client`):** ভবিষ্যতে যদি নেটিভ Google Sign-In বা SQLCipher এনক্রিপশন যুক্ত করা হয় যা স্ট্যান্ডার্ড Expo Go-তে সাপোর্ট করে না, তখন [EAS Build](https://www.google.com/search?q=https%3A%2F%2Fdocs.expo.dev%2Fbuild%2Fintroduction%2F) দিয়ে ক্লাউডে একটি **Development Build** তৈরি করে ফোনে ইনস্টল করে নিতে হবে।
4. **App Store ও Play Store রিলিজ খরচ:** অ্যাপটি পাবলিকলি Apple App Store-এ রিলিজ করতে হলে **Apple Developer Program অ্যাকাউন্ট (~$99/বছর)** এবং Google Play Store-এ রিলিজ করতে হলে **Google Play Console অ্যাকাউন্ট ($25 এককালীন)** প্রয়োজন হবে।

### ৯.৩. আপডেট করা প্রজেক্ট ফোল্ডার স্ট্রাকচার (Mobile + API Monorepo Layout)

```text
hisabkhata/
├── apps/
│   ├── mobile/                               # React Native + Expo Mobile App
│   │   ├── app/                              # Expo Router Screens
│   │   │   ├── _layout.tsx                   # 1st line: import 'react-native-get-random-values'; + DB Migrations
│   │   │   ├── onboarding.tsx                # প্রথমবার ব্যবসা তৈরির স্ক্রিন
│   │   │   ├── lock.tsx                      # PIN / Biometric Unlock Screen
│   │   │   ├── (tabs)/
│   │   │   │   ├── _layout.tsx               # Bottom Bar (Home | More)
│   │   │   │   ├── index.tsx                 # Home Screen (Header Tabs: CUSTOMERS | CASHBOOK)
│   │   │   │   └── more.tsx                  # Settings (Language, Currency BDT/INR, Backup, Lock, Sync)
│   │   │   ├── customer/
│   │   │   │   ├── add.tsx                   # + ADD CUSTOMER Form
│   │   │   │   ├── report-all.tsx            # All Customers PDF Report Screen
│   │   │   │   └── [id]/
│   │   │   │       ├── index.tsx             # Customer Individual Ledger (Window Function Bal.)
│   │   │   │       ├── entry-form.tsx        # YOU GAVE / YOU GOT Custom Calculator Screen
│   │   │   │       ├── report.tsx            # Customer Date-Filtered Report & PDF Share
│   │   │   │       ├── settings.tsx          # Customer Edit / Cascade Soft Delete
│   │   │   │       └── entry/
│   │   │   │           └── [entryId].tsx     # Customer Entry Details (Edit / Delete + Undo)
│   │   │   └── cashbook/
│   │   │       ├── entry-form.tsx            # Cashbook - OUT / + IN Custom Calculator Screen
│   │   │       ├── report.tsx                # Cashbook Daily & Cumulative Report Screen
│   │   │       └── entry/
│   │   │           └── [entryId].tsx         # Cashbook Entry Details (Edit / Delete + Undo)
│   │   ├── components/
│   │   │   ├── BusinessSwitcherModal.tsx     # ব্যবসা পরিবর্তন ও নতুন ব্যবসা যোগ করার মডাল
│   │   │   ├── CalculatorKeypad.tsx          # কাস্টম ক্যালকুলেটর কিপ্যাড (C, M+, M-, +, -, ×, ÷, =)
│   │   │   ├── DateRangePickerModal.tsx      # START DATE ও END DATE ক্যালেন্ডার মডাল
│   │   │   ├── DeleteConfirmModal.tsx        # ডিলিট কনফার্মেশন বটম শিট
│   │   │   └── UndoSnackbar.tsx              # কাস্টমার ও ক্যাশবুক উভয়ের জন্য "Entry Deleted [UNDO]"
│   │   ├── db/
│   │   │   ├── schema.ts                     # SQLite V1 DDL (businesses, customers, entries, sync_state)
│   │   │   ├── migrations.ts                 # PRAGMA user_version ক্রমিক মাইগ্রেশন রানার
│   │   │   ├── businessQueries.ts            # মাল্টি-বিজনেস CRUD কুয়েরি
│   │   │   ├── customerQueries.ts            # কাস্টমার লেজার, cascade soft-delete ও recomputeBalance()
│   │   │   ├── cashbookQueries.ts            # ক্যাশবুক SUM ও Window Function রিপোর্ট কুয়েরি
│   │   │   ├── backupService.ts              # লোকাল CSV/JSON ও .db ব্যাকআপ/রিস্টোর (version validation সহ)
│   │   │   └── syncService.ts                # SyncTransport ইন্টারফেস, Push/Pull ও 410 Gone রিসিঙ্ক হ্যান্ডলার
│   │   ├── store/
│   │   │   └── uiStore.ts                    # Zustand (শুধুমাত্র activeBusinessId, filter, snackbar state)
│   │   ├── i18n/
│   │   │   ├── index.ts
│   │   │   ├── bn.json
│   │   │   └── en.json
│   │   ├── utils/
│   │   │   ├── formatCurrency.ts             # roundMoney(), isSettled(), formatCurrency('BDT' | 'INR')
│   │   │   ├── dateUtils.ts                  # Device local timezone YYYY-MM-DD ও time হেল্পার
│   │   │   └── pdfGenerator.ts               # কাস্টমার ও ক্যাশবুক PDF স্টেটমেন্ট জেনারেটর (expo-print)
│   │   ├── app.json
│   │   ├── eas.json
│   │   └── package.json
│   │
│   └── api/                                  # Phase 2: Custom Node.js + Express + Prisma Backend
│       ├── prisma/
│       │   ├── schema.prisma                 # PostgreSQL Schema (NUMERIC(14,2), server_updated_at)
│       │   └── migrations/                   # SQL Migrations + set_server_updated_at() Trigger
│       ├── src/
│       │   ├── index.ts                      # Express App Entry, Helmet, CORS, Pino Logger
│       │   ├── config/
│       │   │   └── env.ts                    # Zod-validated Environment Variables
│       │   ├── middleware/
│       │   │   ├── authMiddleware.ts         # JWT Verification
│       │   │   ├── ownershipMiddleware.ts    # Checks business_id belongs to req.userId
│       │   │   └── rateLimiter.ts            # Auth & Sync Rate Limiters
│       │   ├── auth/
│       │   │   ├── auth.routes.ts            # /auth/google, /register, /login, /refresh
│       │   │   ├── auth.service.ts           # Google ID Token verify, Argon2 hash, Refresh rotation
│       │   │   └── auth.schema.ts            # Zod Request Schemas
│       │   ├── sync/
│       │   │   ├── sync.routes.ts            # POST /sync/push, GET /sync/pull
│       │   │   ├── sync.service.ts           # Batch Upsert (LWW), Cursor Pull, 410 Gone & Purge Job
│       │   │   └── sync.schema.ts            # Zod Batch Validation Schemas
│       │   └── docs/
│       │       └── openapi.ts                # OpenAPI 3.1 / Swagger Spec Generator
│       ├── tests/
│       │   ├── auth.integration.test.ts      # Register, Login, Refresh Token Rotation Tests
│       │   └── sync.integration.test.ts      # Push, Pull Cursor, LWW Conflict & 403 Ownership Tests
│       ├── Dockerfile
│       ├── docker-compose.yml                # Local Postgres 16 + API Container
│       ├── tsconfig.json
│       └── package.json
└── package.json                              # Workspace Root
```

## ১০. Future Work (ভবিষ্যতে যেসব বাদ দেওয়া ফিচার যেভাবে যুক্ত করা যাবে)

মূল অ্যাপটি হালকা ও দ্রুত রাখার জন্য বাদ দেওয়া ফিচারগুলো ভবিষ্যতে নিচের আর্কিটেকচারে যোগ করা যাবে:

1. **Payment Reminder (`REMIND >`, WhatsApp, SMS ও Due Date):**
   * **স্কিমা আপডেট:** `PRAGMA user_version` মাইগ্রেশনের মাধ্যমে `customers` টেবিলে একটি ঐচ্ছিক `due_date TEXT NULL` কলাম যোগ করা হবে।
   * **WhatsApp ও SMS Deep Link:** কোনো সার্ভার ছাড়াই `Linking.openURL('whatsapp://send?phone=+880...&text=...')` এবং `Linking.openURL('sms:+880...?body=...')` ব্যবহার করে এক ক্লিকে কাস্টমারকে বকেয়া টাকার পরিমাণ ও ব্যবসার নামসহ মেসেজ পাঠানো যাবে।
   * **লোকাল নোটিফিকেশন:** `expo-notifications` ব্যবহার করে নির্ধারিত `due_date`-এর দিন সকালে দোকানদারের ফোনে তাগাদা দেওয়ার রিমাইন্ডার নোটিফিকেশন দেখানো যাবে।
2. **Attach Bills (`📷 Attach bills` রশিদ ও বিলের ছবি যুক্ত করা):**
   * **ইমেজ পিকার ও কম্প্রেশন:** `expo-image-picker` দিয়ে ক্যামেরা বা গ্যালারি থেকে রশিদের ছবি তুলে `expo-image-manipulator` দিয়ে ক্লায়েন্ট-সাইডেই রিসাইজ ও কমপ্রেস করে মাত্র **৫০–৮০ KB (`WebP`/`JPEG`)** সাইজে নামিয়ে আনা হবে।
   * **লোকাল ও S3-Compatible ক্লাউড স্টোরেজ:** অফলাইনে দেখার জন্য ফোনের `expo-file-system` ডিরেক্টরিতে সেভ থাকবে এবং ব্যাকগ্রাউন্ডে আমাদের নিজস্ব Node.js API থেকে Pre-signed Upload URL নিয়ে **[Cloudflare R2](https://www.google.com/search?q=https%3A%2F%2Fdevelopers.cloudflare.com%2Fr2%2F)** (১০ GB/মাস ফ্রি, জিরো ব্যান্ডউইথ চার্জ) বা AWS S3-তে আপলোড হবে।
   * **স্কিমা মাইগ্রেশন:** পরবর্তীতে কোনো ডেটা না হারিয়েই `ALTER TABLE customer_entries ADD COLUMN bill_local_uri TEXT NULL;` এবং `ADD COLUMN bill_cloud_url TEXT NULL;` চালিয়ে এটি যুক্ত করা যাবে।
3. **কয়েন বা রিওয়ার্ড ব্যাজ (Coins / Gamification Badge):**
   * ভবিষ্যতে ইউজার এনগেজমেন্ট বাড়াতে চাইলে টপ বারে কয়েন/পয়েন্ট ব্যাজ যুক্ত করা যাবে—যেখানে প্রতিদিন নিয়মিত হিসাব লিখলে (Daily Streak) বা সময়মতো ব্যাকআপ নিলে পয়েন্ট জমা হবে।

## ১১. আগের ভার্সন থেকে কী কী বদলেছে (Changelog)

1. **কাস্টম Node.js + PostgreSQL ব্যাকএন্ড (Supabase সম্পূর্ণ অপসারণ):** সব Supabase রেফারেন্স সরিয়ে ফেজ ২-এর জন্য `Node.js + TypeScript + Express + Prisma + PostgreSQL` আর্কিটেকচার, JWT + Refresh Token Rotation, Google ID Token ভেরিফিকেশন এবং `business_id` ওনারশিপ মিডলওয়্যার যুক্ত করা হয়েছে।
2. **Pull কার্সরে `server_updated_at` যুক্ত:** ক্লায়েন্টের ঘড়ি পিছিয়ে থাকার বাগ এড়াতে সার্ভার টেবিলে DB Trigger-ভিত্তিক `server_updated_at` কলাম এবং `(server_updated_at, id)` জোড়ার ওপর Paginated Pull কার্সর নির্ধারণ করা হয়েছে (ক্লায়েন্ট `updated_at` শুধু LWW conflict-এ ব্যবহৃত হবে)।
3. **Device-Aware Tombstone Purge ও `410 Gone`:** অন্ধভাবে ৩০ দিন পর Purge করার নিয়ম বাদ দিয়ে `devices` টেবিলের কার্সর ট্র্যাকিং, ৯০ দিনের রিটেনশন এবং পুরনো কার্সরে `410 Gone` ও ফুল-রিসিঙ্ক মেকানিজম যোগ করা হয়েছে।
4. **`net_balance` সিঙ্ক থেকে বাদ ও `recomputeBalance()` ফিক্স:** `customers.net_balance` সার্ভার স্কিমা ও সিঙ্ক পেলোড থেকে বাদ দেওয়া হয়েছে এবং `recomputeBalance()` যেন কাস্টমার রো-এর `updated_at` বা `is_synced` না বদলায় তা নিশ্চিত করা হয়েছে।
5. **Customer Soft-Delete Cascade:** সফট-ডিলিটে `ON DELETE CASCADE` কাজ না করার কারণ ব্যাখ্যা করে কাস্টমার ডিলিটের একই ট্রানজেকশনে তার এন্ট্রিগুলোও Tombstone (`is_deleted = 1`) করার নিয়ম যুক্ত করা হয়েছে।
6. **সার্ভার Prisma/SQL স্কিমা ও API Contract:** `users`, `refresh_tokens`, `devices`, `businesses`, `customers`, `customer_entries`, ও `cashbook_entries` সহ সম্পূর্ণ Prisma স্কিমা (`Decimal(14,2)`), `/auth/*` ও `/sync/*` JSON উদাহরণ এবং Backend Engineering Checklist যোগ করা হয়েছে।
7. **SQLite `PRAGMA user_version` ও `.db` রিস্টোর গার্ড:** লোকাল SQLite-এ ক্রমিক স্কিমা মাইগ্রেশন এবং `.db` ব্যাকআপ রিস্টোরের সময় ভার্সন চেক ও নতুন ভার্সন ব্লক করার লজিক যুক্ত করা হয়েছে।
8. **UUID v7 Polyfill, ডিভাইস টাইমজোন ও ISO কারেন্সি কোড:** ডে-১ স্ট্যাকে `react-native-get-random-values`, হার্ডকোডেড `'Asia/Dhaka'` সরিয়ে ডিভাইসের লোকাল টাইমজোন ভিত্তিক `dateUtils.ts`, এবং ডাটাবেজে সিম্বলের বদলে `'BDT'`/`'INR'` ISO কোড সংরক্ষণ যুক্ত করা হয়েছে।
9. **Monorepo ফোল্ডার স্ট্রাকচার ও `SyncTransport` ইন্টারফেস:** মোবাইলে `syncService.ts` ইন্টারফেসের পেছনে রাখা হয়েছে এবং ফোল্ডার ট্রিতে `apps/mobile` ও `apps/api` উভয় অংশ যোগ করা হয়েছে।
