import type { TemplateCategory } from "./blueprint";

export const templateCategories: {
  id: TemplateCategory | "essentials";
  label: string;
  icon: string;
}[] = [
  { id: "essentials", label: "Essentials", icon: "✨" },
  { id: "product", label: "Product & research", icon: "🔬" },
  { id: "engineering", label: "Engineering & IT", icon: "💻" },
  { id: "design", label: "Design", icon: "🎨" },
  { id: "marketing", label: "Marketing", icon: "📣" },
  { id: "sales", label: "Sales", icon: "🤝" },
  { id: "customers", label: "Customer success", icon: "💬" },
  { id: "people", label: "People & hiring", icon: "🌱" },
  { id: "operations", label: "Operations", icon: "⚙️" },
  { id: "finance", label: "Finance", icon: "📊" },
  { id: "strategy", label: "Business strategy", icon: "🧭" },
];
