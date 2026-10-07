"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Color {
  name: string;
  image?: string;
}

interface OrderFormProps {
  productName: string;
  colors?: Color[];
  defaultColor?: string;
  triggerLabel?: string;
}

export default function OrderForm({
  productName,
  colors = [],
  defaultColor = "",
  triggerLabel = "এখনই অর্ডার করুন",
}: OrderFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const firstColor = defaultColor || colors[0]?.name || "";

  const [form, setForm] = useState({
    name: "",
    phone: "",
    district: "",
    address: "",
    color: firstColor,
    quantity: 1,
  });

  useEffect(() => {
    if (!open) return;

    setForm((current) => ({
      ...current,
      color: defaultColor || current.color || colors[0]?.name || "",
    }));
  }, [colors, defaultColor, open]);

  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: name === "quantity" ? Math.max(1, Number(value)) : value,
    }));
  };

  const submitOrder = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          product: productName,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Order failed");
      }

      setMessage("অর্ডার সফলভাবে গ্রহণ করা হয়েছে।");
      setForm({
        name: "",
        phone: "",
        district: "",
        address: "",
        color: defaultColor || colors[0]?.name || "",
        quantity: 1,
      });
    } catch {
      setMessage("অর্ডার পাঠানো যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setOpen(false);
    setMessage("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="gold-btn min-h-12 w-full px-4 text-sm"
      >
        {triggerLabel}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="AVEN অর্ডার ফর্ম"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeModal();
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 26, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-[#d7b45b]/20 bg-[#0b0b0b] p-5 text-white shadow-[0_30px_100px_rgba(0,0,0,0.7)] sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7b45b]">
                    AVEN Order
                  </p>
                  <h2 className="mt-2 text-2xl font-black">{productName}</h2>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-white/65 transition hover:text-white"
                  aria-label="অর্ডার ফর্ম বন্ধ করুন"
                >
                  ×
                </button>
              </div>

              {message ? (
                <div className="mt-6 rounded-2xl border border-[#d7b45b]/20 bg-[#d7b45b]/8 p-5">
                  <p className="font-bold text-[#f1d98d]">{message}</p>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="outline-btn mt-5 w-full"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              ) : (
                <form onSubmit={submitOrder} className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-xs font-semibold text-white/55">
                      নাম
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="আপনার নাম"
                        className="aven-input"
                        autoComplete="name"
                        required
                      />
                    </label>

                    <label className="grid gap-2 text-xs font-semibold text-white/55">
                      ফোন নম্বর
                      <input
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="01XXXXXXXXX"
                        className="aven-input"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                      />
                    </label>
                  </div>

                  <label className="grid gap-2 text-xs font-semibold text-white/55">
                    জেলা
                    <input
                      name="district"
                      value={form.district}
                      onChange={handleChange}
                      placeholder="আপনার জেলা"
                      className="aven-input"
                      required
                    />
                  </label>

                  <label className="grid gap-2 text-xs font-semibold text-white/55">
                    সম্পূর্ণ ঠিকানা
                    <textarea
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      placeholder="বাসা/রোড/এলাকা সহ সম্পূর্ণ ঠিকানা"
                      className="aven-input min-h-24 resize-y"
                      required
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-xs font-semibold text-white/55">
                      রঙ
                      {colors.length > 0 ? (
                        <select
                          name="color"
                          value={form.color}
                          onChange={handleChange}
                          className="aven-input"
                          required
                        >
                          {colors.map((color) => (
                            <option
                              key={color.name}
                              value={color.name}
                              className="bg-[#111]"
                            >
                              {color.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          name="color"
                          value={form.color}
                          onChange={handleChange}
                          placeholder="রঙ"
                          className="aven-input"
                        />
                      )}
                    </label>

                    <label className="grid gap-2 text-xs font-semibold text-white/55">
                      পরিমাণ
                      <input
                        name="quantity"
                        type="number"
                        min="1"
                        max="20"
                        value={form.quantity}
                        onChange={handleChange}
                        className="aven-input"
                        required
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="gold-btn mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "অর্ডার পাঠানো হচ্ছে..." : "অর্ডার নিশ্চিত করুন"}
                  </button>

                  <p className="text-center text-[11px] leading-5 text-white/28">
                    অর্ডারের তথ্য AVEN-এর order management system-এ পাঠানো হবে।
                  </p>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
