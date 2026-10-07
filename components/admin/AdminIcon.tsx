type IconName = "overview" | "products" | "categories" | "orders" | "settings" | "arrow" | "shield";

const paths: Record<IconName, string> = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  products: "M12 3 3 8l9 5 9-5-9-5Z M3 8v9l9 5 9-5V8 M12 13v9 M7.5 5.5l9 5",
  categories: "M3 5h7l2 3h9v12H3V5Z M7 12h10 M7 16h6",
  orders: "M8 5H5v16h14V5h-3 M8 3h8v4H8z M8 12h8 M8 16h5",
  settings: "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z M8 12l3 3 5-6",
};

export default function AdminIcon({ name, className }: { name: IconName; className?: string }) {
  return <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
