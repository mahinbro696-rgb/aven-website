import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminAuthGate from "@/components/admin/AdminAuthGate";
import "./admin.css";
import "./studio.css";
import "./product-studio.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Secure admin", robots: { index: false, follow: false, nocache: true } };

export default function AdminPage() {
  return <AdminAuthGate><AdminDashboard /></AdminAuthGate>;
}
