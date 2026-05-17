import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  monthLabel: z.string().max(64),
});

export type AiSuggestion = {
  type: "alert" | "tip" | "invest";
  title: string;
  detail: string;
};

export const getAiSuggestions = createServerFn({ method: "POST" })
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
    };

    const system = `তুমি একজন বাংলাভাষী আর্থিক পরামর্শক। ব্যবহারকারীর মাসিক হিসাব বিশ্লেষণ করে ৪-৬টি সুনির্দিষ্ট, কার্যকর পরামর্শ দাও।
প্রতিটি পরামর্শে থাকবে:
- type: "alert" (সমস্যা/অতিরিক্ত ব্যয়), "tip" (সাশ্রয়/বাজেট পরামর্শ), অথবা "invest" (সঞ্চয়/বিনিয়োগ পরামর্শ)
- title: সংক্ষিপ্ত শিরোনাম (সর্বোচ্চ ৮ শব্দ)
- detail: ১-২ বাক্যে বিস্তারিত, সংখ্যা/খাতের নাম উল্লেখ করে

শুধু এই JSON ফরম্যাটে উত্তর দাও, অন্য কোনো লেখা নয়:
{"suggestions":[{"type":"alert","title":"...","detail":"..."}]}`;

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
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 8) : [];
    return { suggestions };
  });
