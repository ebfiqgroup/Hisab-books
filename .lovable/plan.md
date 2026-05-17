## লক্ষ্য
অ্যাপের সব পেজ ও কম্পোনেন্টের হার্ডকোডেড বাংলা টেক্সট `useLanguage().t()` দিয়ে বাংলা/ইংরেজি দুই ভাষায় কাজ করানো।

## পদ্ধতি (গুরুত্বপূর্ণ সিদ্ধান্ত)

প্রতিটি স্ট্রিং-এর জন্য `dict`-এ key যোগ করার বদলে `t()`-কে **inline দ্বি-ভাষিক signature** দেব:

```ts
t("বাংলা টেক্সট", "English text")  // overload
t("nav.dashboard")                  // পুরোনো TKey lookup (backward compatible)
```

এতে প্রতিটি পেজে শুধু একটিমাত্র সিম্পল রিপ্লেস লাগে এবং কোনো বিশাল central dict রক্ষণাবেক্ষণ করতে হয় না।

### ধাপ ১ — `useLanguage.tsx` আপডেট
- `t` signature: `(bn: string, en?: string) => string`
  - `en` দেওয়া থাকলে: `lang === "bn" ? bn : en`
  - না দেওয়া থাকলে: আগের মতো `dict[lang][bn as TKey] ?? bn`

### ধাপ ২ — সব পেজ/কম্পোনেন্টে সুইপ
নিচের ফাইলগুলোয় ইউজার-মুখী হার্ডকোডেড বাংলা স্ট্রিং (titles, labels, buttons, placeholders, toasts, empty states, confirm dialogs) `t("…","…")`-এ মোড়ানো হবে:

**Routes:**
- `_authenticated/app.tsx` (ড্যাশবোর্ড)
- `_authenticated/income.tsx`, `expense.tsx`, `transactions.tsx`
- `_authenticated/budget.tsx`, `goals.tsx`, `debts.tsx`
- `_authenticated/report.tsx`, `calendar.tsx`
- `_authenticated/support.tsx`, `settings.tsx`
- `_authenticated/admin.tsx`, `admin.user.$userId.tsx`, `audit.tsx`
- `auth.tsx`, `reset-password.tsx`, `index.tsx`, `demo.tsx`

**Components:**
- `dashboard/TxnDialog.tsx`, `dashboard/CategoryManager.tsx`, `dashboard/AiSuggestions.tsx`
- `admin/UserProfileEditor.tsx`, `admin/UserDataManager.tsx`
- `RefCodeBadge.tsx`

### ধাপ ৩ — সংখ্যা/তারিখ
`toBn()` ফাংশন বাংলা সংখ্যা দেয়; ইংরেজি মোডে original English digits ব্যবহার হবে — `finance.ts`-এ `toBn`-কে lang-aware করা হবে না (পরিধির বাইরে); শুধু লেবেলগুলো অনুবাদ হবে।

### ধাপ ৪ — যাচাই
- Build পাস করছে কিনা
- ভাষা টগল করলে সব পেজে টেক্সট পাল্টায় কিনা (preview-তে চেক)

## পরিধির বাইরে
- ব্যবহারকারী-জেনারেটেড ডেটা (category names, notes, goal labels) অনুবাদ হবে না
- DB-stored strings, error messages from Supabase
- Number formatting (toBn) lang-aware করা
