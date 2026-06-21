import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "প্রাইভেসি নীতি — হিসাব বই" },
      { name: "description", content: "হিসাব বই অ্যাপের প্রাইভেসি নীতি ও ডেটা ব্যবহার সংক্রান্ত তথ্য।" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--brand-cream, #faf7f0)" }}>
      <div className="max-w-3xl mx-auto px-5 py-14">
        <Link to="/" className="text-sm" style={{ color: "var(--brand-emerald-700)" }}>← হোম</Link>
        <h1 className="text-3xl mt-4" style={{ fontFamily: "var(--font-display)" }}>প্রাইভেসি নীতি</h1>
        <p className="text-xs mt-1" style={{ color: "var(--brand-ink-soft)" }}>সর্বশেষ আপডেট: ২০২৫</p>
        <div className="prose prose-sm max-w-none mt-6 space-y-4 text-sm leading-relaxed" style={{ color: "var(--brand-ink)" }}>
          <p>"হিসাব বই" আপনার ব্যক্তিগত আর্থিক তথ্যকে সর্বোচ্চ গুরুত্ব দেয়। এই নীতিতে আমরা ব্যাখ্যা করছি কীভাবে আপনার তথ্য সংগ্রহ, সংরক্ষণ ও ব্যবহার করি।</p>
          <h2 className="text-lg font-semibold mt-6">কী ধরনের তথ্য সংগ্রহ করি</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>অ্যাকাউন্ট তথ্য: নাম, ইমেইল, প্রোফাইল ছবি (ঐচ্ছিক)।</li>
            <li>আর্থিক ডেটা: আপনি যেসব লেনদেন, বাজেট, লক্ষ্য, দেনা-পাওনা ও নোট তৈরি করেন।</li>
            <li>ব্যবহার সংক্রান্ত মেটাডেটা: অ্যাপ ব্যবহারের সময় ও পারফরম্যান্স ডায়াগনস্টিকস।</li>
          </ul>
          <h2 className="text-lg font-semibold mt-6">কীভাবে ব্যবহার করি</h2>
          <p>আপনার ডেটা শুধুমাত্র আপনার নিজের অ্যাকাউন্টের সেবা প্রদানে ব্যবহার হয়। আমরা আপনার আর্থিক ডেটা তৃতীয় পক্ষের কাছে বিক্রি বা শেয়ার করি না।</p>
          <h2 className="text-lg font-semibold mt-6">ডেটা নিরাপত্তা</h2>
          <p>সকল ডেটা এনক্রিপ্টেড সংযোগের (HTTPS) মাধ্যমে স্থানান্তর হয় এবং Row-Level Security (RLS) দ্বারা সুরক্ষিত — শুধু আপনি নিজের ডেটা পড়তে ও লিখতে পারেন।</p>
          <h2 className="text-lg font-semibold mt-6">আপনার অধিকার</h2>
          <p>আপনি যেকোনো সময় আপনার অ্যাকাউন্ট ও সমস্ত ডেটা স্থায়ীভাবে মুছে ফেলতে পারেন সেটিংস পেজ থেকে।</p>
          <h2 className="text-lg font-semibold mt-6">যোগাযোগ</h2>
          <p>প্রাইভেসি সংক্রান্ত যেকোনো প্রশ্নে অ্যাপের সাপোর্ট পেজের মাধ্যমে আমাদের সাথে যোগাযোগ করুন।</p>
        </div>
      </div>
    </div>
  );
}