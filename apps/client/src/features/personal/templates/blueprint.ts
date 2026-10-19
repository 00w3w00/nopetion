export type TemplateCategory =
  | "product"
  | "engineering"
  | "design"
  | "marketing"
  | "sales"
  | "customers"
  | "people"
  | "operations"
  | "finance"
  | "strategy";

export interface TemplateBlueprint {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: TemplateCategory;
  tags: string[];
  source: { title: string; url: string };
  purpose: string;
  sections: {
    title: string;
    prompt: string;
    bullets?: string[];
    checklist?: string[];
  }[];
  table?: { title: string; columns: string[]; rows: string[][] };
  tracker?: {
    title: string;
    view: "table" | "board" | "list" | "calendar" | "timeline";
    rows: {
      title: string;
      status: "todo" | "doing" | "done";
      owner?: string;
      value?: number;
    }[];
  };
}
