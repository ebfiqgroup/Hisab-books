import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  curIncome: z.number(),
  curExpense: z.number(),
  prevIncome: z.number(),
  prevExpense: z.number(),
  receivable: z.number(),
  payable: z.number(),
  expenseByCategory: z.array(z.object({ category: z.string(), amount: z.number() })).max(30),
  incomeByCategory: z.array(z.object({ category: z.string(), amount: z.number() })).max(30),
  goals: z.array(z.object({ label: z.string(), target: z.number(), current: z.number() })).max(10),
  budgets: z.array(z.object({ category: z.string(), limit: z.number(), spent: z.number() })).max(30).optional(),
  monthLabel: z.string().max(64),
  config: z.object({
    types: z.array(z.enum(["alert", "tip", "invest"])).min(1),
    expenseRatioPct: z.number().min(10).max(200),
    lowCashTk: z.number().min(0).max(10_000_000),
    goalLagPct: z.number().min(0).max(100),
  }).optional(),
});

export type AiSuggestion = {
  type: "alert" | "tip" | "invest";
  title: string;
  detail: string;
  reason?: string;
  steps?: string[];
};

export const getAiSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const summary = {
      মাস: data.monthLabel,
      বর্তমান_মাস: { আয়: data.curIncome, ব্যয়: data.curExpense, অবশিষ্ট: data.curIncome - data.curExpense },
      গত_মাস: { আয়: data.prevIncome, ব্যয়: data.prevExpense, অবশিষ্ট: data.prevIncome - data.prevExpense },
      পাওনা: data.receivable,
      দেনা: data.payable,
      ব্যয়ের_খাত: data.expenseByCategory,
      আয়ের_খাত: data.incomeByCategory,
      লক্ষ্যসমূহ: data.goals,
      বাজেটসমূহ: data.budgets ?? [],
    };

    const cfg = data.config ?? { types: ["alert", "tip", "invest"], expenseRatioPct: 80, lowCashTk: 5000, goalLagPct: 20 };
    const typeList = cfg.types.join(", ");
    const rules: string[] = [];
    if (cfg.types.includes("alert")) {
      rules.push(`- ব্যয় আয়ের ${cfg.expenseRatioPct}% এর বেশি হলে "alert" দাও।`);
      rules.push(`- অবশিষ্ট নগদ ৳${cfg.lowCashTk} এর কম হলে "alert" দাও।`);
    }
    if (cfg.types.includes("tip")) {
      rules.push(`- যে খাতে অস্বাভাবিক বেশি ব্যয় হয়েছে সেখানে সাশ্রয়ের "tip" দাও।`);
    }
    if (cfg.types.includes("invest")) {
      rules.push(`- লক্ষ্যের অগ্রগতি প্রত্যাশার চেয়ে ${cfg.goalLagPct}% পিছিয়ে থাকলে "alert" বা "invest" দাও।`);
      rules.push(`- পর্যাপ্ত অবশিষ্ট থাকলে বিনিয়োগের "invest" পরামর্শ দাও।`);
    }

    const system = `তুমি একজন বাংলাভাষী আর্থিক পরামর্শক। ব্যবহারকারীর মাসিক হিসাব বিশ্লেষণ করে ৪-৬টি সুনির্দিষ্ট, কার্যকর পরামর্শ দাও।

শুধুমাত্র এই type-গুলো ব্যবহার করো: ${typeList}
- "alert" = সমস্যা/অতিরিক্ত ব্যয়/নগদ সংকট/লক্ষ্য পিছিয়ে
- "tip" = সাশ্রয়/বাজেট পরামর্শ
- "invest" = সঞ্চয়/বিনিয়োগ পরামর্শ

ব্যবহারকারীর কনফিগার করা থ্রেশহোল্ড অনুসরণ করো:
${rules.join("\n")}

বিশেষ নিয়ম — বাজেট/লক্ষ্য মিস:
- কোনো বাজেট (বাজেটসমূহ-এ spent > limit) অতিক্রম হলে অবশ্যই একটি "alert" দাও।
- কোনো লক্ষ্যের অগ্রগতি (current/target) প্রত্যাশার চেয়ে পিছিয়ে থাকলে অবশ্যই একটি "alert" দাও।
- এই ধরনের পরামর্শে অবশ্যই "reason" (কেন মিস হয়েছে, সংখ্যাসহ) এবং "steps" (৩-৪টি সুনির্দিষ্ট অ্যাকশনেবল পদক্ষেপ) দাও।

প্রতিটি পরামর্শে থাকবে:
- type: উপরের অনুমোদিত list থেকে একটি
- title: সংক্ষিপ্ত শিরোনাম (সর্বোচ্চ ৮ শব্দ)
- detail: ১-২ বাক্যে বিস্তারিত, সংখ্যা/খাতের নাম উল্লেখ করে
- reason (ঐচ্ছিক, তবে বাজেট/লক্ষ্য মিসে আবশ্যক): ব্যর্থতার কারণ এক বাক্যে
- steps (ঐচ্ছিক, তবে বাজেট/লক্ষ্য মিসে আবশ্যক): ৩-৪টি ছোট, কার্যকর পদক্ষেপের array — প্রতিটি ক্রিয়াপদ দিয়ে শুরু (যেমন "কমান", "সরান", "বরাদ্দ করুন")

শুধু এই JSON ফরম্যাটে উত্তর দাও, অন্য কোনো লেখা নয়:
{"suggestions":[{"type":"alert","title":"...","detail":"...","reason":"...","steps":["...","..."]}]}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: "নিম্নলিখিত আর্থিক তথ্য বিশ্লেষণ করো:\n" + JSON.stringify(summary, null, 2) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("AI অনুরোধের সীমা পার হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।");
    if (res.status === 402) throw new Error("AI ক্রেডিট শেষ হয়ে গেছে। সেটিংস থেকে ক্রেডিট যুক্ত করুন।");
    if (!res.ok) throw new Error(`AI সাজেশন আনতে সমস্যা: ${res.status}`);

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { suggestions?: AiSuggestion[] } = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const allowed = new Set(cfg.types);
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((s) => s && allowed.has(s.type)).slice(0, 8)
      : [];
    return { suggestions };
  });
