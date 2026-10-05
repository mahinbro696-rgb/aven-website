import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminAuthGate from "@/components/admin/AdminAuthGate";
import "./admin.css";
import "./studio.css";
import "./product-studio.css";

export default function AdminPage() {
  return <AdminAuthGate><AdminDashboard /></AdminAuthGate>;
}
