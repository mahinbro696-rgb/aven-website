import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminAuthGate from "@/components/admin/AdminAuthGate";
import "./admin.css";

export default function AdminPage() {
  return <AdminAuthGate><AdminDashboard /></AdminAuthGate>;
}
