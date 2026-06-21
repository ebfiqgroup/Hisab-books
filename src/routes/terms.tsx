import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "শর্তাবলি — হিসাব বই" },
      { name: "description", content: "হিসাব বই ব্যবহারের শর্তাবলি ও ব্যবহারকারী চুক্তি।" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--brand-cream, #faf7f0)" }}>
      <div className="max-w-3xl mx-auto px-5 py-14">
        <Link to="/" className="text-sm" style={{ color: "var(--brand-emerald-700)" }}>← হোম</Link>
        <h1 className="text-3xl mt-4" style={{ fontFamily: "var(--font-display)" }}>ব্যবহারের শর্তাবলি</h1>
        <p className="text-xs mt-1" style={{ color: "var(--brand-ink-soft)" }}>সর্বশেষ আপডেট: ২০২৫</p>
        <div className="prose prose-sm max-w-none mt-6 space-y-4 text-sm leading-relaxed" style={{ color: "var(--brand-ink)" }}>
          <p>"হিসাব বই" ব্যবহারের আগে অনুগ্রহ করে এই শর্তাবলি ভালোভাবে পড়ুন। অ্যাকাউন্ট তৈরি বা ব্যবহার করলে আপনি এই শর্তে সম্মত হয়েছেন বলে গণ্য হবে।</p>
          <h2 className="text-lg font-semibold mt-6">অ্যাকাউন্ট</h2>
          <p>আপনার অ্যাকাউন্টের পাসওয়ার্ড গোপন রাখার দায়িত্ব আপনার। অননুমোদিত অ্যাক্সেস সন্দেহ হলে অবিলম্বে আমাদের জানান।</p>
          <h2 className="text-lg font-semibold mt-6">ব্যবহারের সীমা</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>অ্যাপটি ব্যক্তিগত ও পারিবারিক আর্থিক ব্যবস্থাপনার জন্য।</li>
            <li>স্বয়ংক্রিয় স্ক্রেপিং, রিভার্স-ইঞ্জিনিয়ারিং বা সিস্টেম অপব্যবহার নিষিদ্ধ।</li>
            <li>অন্য ব্যবহারকারীর ক্ষতি বা আইনবিরোধী কার্যকলাপ নিষিদ্ধ।</li>
          </ul>
          <h2 className="text-lg font-semibold mt-6">ডেটা ও দায়বদ্ধতা</h2>
          <p>অ্যাপটি "যেমন আছে" ভিত্তিতে সরবরাহ করা হয়েছে। আর্থিক সিদ্ধান্তের চূড়ান্ত দায়িত্ব ব্যবহারকারীর। আমরা নির্ভুলতার জন্য চেষ্টা করি, তবে কোনো ক্ষতির জন্য দায়ী থাকব না।</p>
          <h2 className="text-lg font-semibold mt-6">পরিবর্তন</h2>
          <p>সময় সময় এই শর্তাবলি আপডেট হতে পারে। গুরুত্বপূর্ণ পরিবর্তন হলে অ্যাপের ভেতরে নোটিশ দেওয়া হবে।</p>
        </div>
      </div>
    </div>
  );
}