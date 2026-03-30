declare module "lucide-react" {
  import type { FC, SVGProps } from "react";

  export interface LucideProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
  }

  export type LucideIcon = FC<LucideProps>;

  export const BookOpen: LucideIcon;
  export const Camera: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const Cpu: LucideIcon;
  export const Database: LucideIcon;
  export const Download: LucideIcon;
  export const FileText: LucideIcon;
  export const FolderArchive: LucideIcon;
  export const Globe: LucideIcon;
  export const ImageIcon: LucideIcon;
  export const LayoutDashboard: LucideIcon;
  export const Loader2: LucideIcon;
  export const MapPin: LucideIcon;
  export const Maximize2: LucideIcon;
  export const MessageSquare: LucideIcon;
  export const PanelRightClose: LucideIcon;
  export const PanelRightOpen: LucideIcon;
  export const PenTool: LucideIcon;
  export const Plus: LucideIcon;
  export const Search: LucideIcon;
  export const Settings: LucideIcon;
  export const Shirt: LucideIcon;
  export const Sliders: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Tag: LucideIcon;
  export const Trash2: LucideIcon;
  export const User: LucideIcon;
  export const Users: LucideIcon;
  export const Zap: LucideIcon;
}
