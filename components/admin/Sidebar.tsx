"use client";
import { motion } from "framer-motion";
type Props = { active: string; setActive: (value: string) => void };
const menu = [{ name: "Dashboard", icon: "⌂" }, { name: "Products", icon: "✦" }, { name: "Orders", icon: "🛒" }, { name: "Settings", icon: "⚙" }];
export default function Sidebar({ active, setActive }: Props) {
  return <motion.aside initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-20 md:w-64 shrink-0 min-h-screen bg-zinc-950 border-r border-yellow-500/20 p-2 md:p-5">
    <h1 className="text-xl md:text-4xl font-bold text-yellow-400 tracking-wide mb-8 text-center">AVEN</h1>
    <nav aria-label="Admin navigation" className="space-y-3">{menu.map((item) => <button type="button" key={item.name} aria-label={item.name} aria-current={active === item.name ? "page" : undefined} onClick={() => setActive(item.name)} className={`w-full flex flex-col md:flex-row items-center gap-2 md:gap-4 p-2 md:p-4 rounded-xl transition ${active === item.name ? "bg-yellow-500 text-black font-bold" : "text-gray-300 hover:bg-zinc-800"}`}><span aria-hidden="true">{item.icon}</span><span className="text-[9px] md:text-sm">{item.name}</span></button>)}</nav>
  </motion.aside>;
}
